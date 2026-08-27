const fs = require('fs');
const path = require('path');
const config = require('./config');
const { quarterKeyFromDate } = require('./chargingAccounting');

function ensureDirAndFile(filePath, fallbackData) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    writeJson(filePath, fallbackData);
  }
}

function readJson(filePath, fallbackData) {
  ensureDirAndFile(filePath, fallbackData);
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(parsed) ? parsed : fallbackData;
  } catch (_err) {
    return fallbackData;
  }
}

function writeJson(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tempPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.tmp`);
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, filePath);
}

function getSessions() {
  return readJson(config.chargingSessionsFile, []);
}

function materialSession(record) {
  const copy = { ...record };
  delete copy.first_received_at;
  delete copy.received_at;
  delete copy.updated_at;
  return copy;
}

function upsertSession(session) {
  const sessions = getSessions();
  const index = sessions.findIndex((item) => item.session_id === session.session_id);
  const now = new Date().toISOString();

  if (index === -1) {
    const record = {
      ...session,
      first_received_at: now,
      received_at: now,
      updated_at: now
    };
    sessions.push(record);
    sessions.sort((a, b) => String(b.start).localeCompare(String(a.start)));
    writeJson(config.chargingSessionsFile, sessions);
    return { action: 'created', record, changed: true };
  }

  const previous = sessions[index];
  const definedPatch = Object.fromEntries(
    Object.entries(session).filter(([, value]) => value !== undefined)
  );
  const record = {
    ...previous,
    ...definedPatch,
    first_received_at: previous.first_received_at || now,
    received_at: now,
    updated_at: now
  };
  const changed = JSON.stringify(materialSession(previous)) !== JSON.stringify(materialSession(record));
  sessions[index] = record;
  sessions.sort((a, b) => String(b.start).localeCompare(String(a.start)));
  writeJson(config.chargingSessionsFile, sessions);
  return { action: changed ? 'updated' : 'unchanged', record, changed };
}

function getDailyTotals() {
  return readJson(config.chargingDailyTotalsFile, []);
}

function upsertDailyTotal(summary) {
  const totals = getDailyTotals();
  const index = totals.findIndex((item) => item.date === summary.date);
  const now = new Date().toISOString();
  const previous = index >= 0 ? totals[index] : null;
  const record = {
    ...(previous || {}),
    ...summary,
    first_received_at: previous?.first_received_at || now,
    received_at: now,
    updated_at: now
  };

  if (index >= 0) totals[index] = record;
  else totals.push(record);

  totals.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  writeJson(config.chargingDailyTotalsFile, totals);
  return { action: previous ? 'updated' : 'created', record };
}

function getRates() {
  return readJson(config.chargingRatesFile, [])
    .sort((a, b) => String(a.period_start).localeCompare(String(b.period_start)));
}

function saveRate(rate) {
  const rates = getRates();
  const index = rates.findIndex((item) => item.period_start === rate.period_start);
  const now = new Date().toISOString();
  const previous = index >= 0 ? rates[index] : null;
  const record = {
    ...rate,
    created_at: previous?.created_at || now,
    updated_at: now
  };

  if (index >= 0) rates[index] = record;
  else rates.push(record);

  rates.sort((a, b) => String(a.period_start).localeCompare(String(b.period_start)));
  writeJson(config.chargingRatesFile, rates);
  return { action: previous ? 'updated' : 'created', record };
}

function deleteRate(periodStart) {
  const rates = getRates();
  const filtered = rates.filter((item) => item.period_start !== periodStart);
  if (filtered.length === rates.length) return false;
  writeJson(config.chargingRatesFile, filtered);
  return true;
}

function getReports() {
  return readJson(config.chargingReportsFile, [])
    .sort((a, b) => String(b.period_key).localeCompare(String(a.period_key)));
}

function getReportById(id) {
  return getReports().find((item) => item.id === id) || null;
}

function saveReport(report) {
  const reports = getReports();
  const index = reports.findIndex((item) => item.id === report.id);
  if (index >= 0) reports[index] = report;
  else reports.push(report);
  writeJson(config.chargingReportsFile, reports);
  return report;
}

function markFinalReportNeedsReview(startDate, reason) {
  const periodKey = quarterKeyFromDate(startDate);
  if (!periodKey) return false;
  const reports = getReports();
  let changed = false;

  reports.forEach((report) => {
    if (report.period_key === periodKey && report.status === 'final' && !report.needs_review) {
      report.needs_review = true;
      report.review_reason = reason;
      report.updated_at = new Date().toISOString();
      changed = true;
    }
  });

  if (changed) writeJson(config.chargingReportsFile, reports);
  return changed;
}

function markReportsForRateRange(periodStart, periodEnd) {
  const reports = getReports();
  let changed = false;
  reports.forEach((report) => {
    if (report.status !== 'final') return;
    const overlaps = report.period_start < periodEnd && report.period_end > periodStart;
    if (overlaps) {
      report.needs_review = true;
      report.review_reason = 'A CREG rate covering this quarter changed.';
      report.updated_at = new Date().toISOString();
      changed = true;
    }
  });
  if (changed) writeJson(config.chargingReportsFile, reports);
}

function markAllFinalReportsNeedsReview(reason) {
  const reports = getReports();
  let changed = false;
  reports.forEach((report) => {
    if (report.status === 'final') {
      report.needs_review = true;
      report.review_reason = reason;
      report.updated_at = new Date().toISOString();
      changed = true;
    }
  });
  if (changed) writeJson(config.chargingReportsFile, reports);
}

module.exports = {
  getSessions,
  upsertSession,
  getDailyTotals,
  upsertDailyTotal,
  getRates,
  saveRate,
  deleteRate,
  getReports,
  getReportById,
  saveReport,
  markFinalReportNeedsReview,
  markReportsForRateRange,
  markAllFinalReportsNeedsReview
};
