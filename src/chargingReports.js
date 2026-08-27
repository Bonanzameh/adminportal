const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cron = require('node-cron');
const config = require('./config');
const { getAppSettings } = require('./settingsStore');
const { sendPdf } = require('./mailer');
const { appendSentRecord } = require('./sendLogStore');
const {
  getSessions,
  getDailyTotals,
  getRates,
  getReports,
  getReportById,
  saveReport
} = require('./chargingStore');
const {
  computeQuarterSnapshot,
  quarterBounds,
  quarterFromDate,
  getDateInTimezone,
  getTimeInTimezone,
  addDays
} = require('./chargingAccounting');
const { buildQuarterlyChargingPdf } = require('./chargingPdf');

function reportError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function publicReport(report) {
  if (!report) return null;
  return {
    id: report.id,
    period_key: report.period_key,
    period_start: report.period_start,
    period_end: report.period_end,
    status: report.status,
    revision: report.revision,
    file_name: report.file_name,
    generated_at: report.generated_at,
    finalized_at: report.finalized_at || null,
    sent_at: report.sent_at || null,
    recipient: report.recipient || null,
    needs_review: Boolean(report.needs_review),
    review_reason: report.review_reason || '',
    totals: report.snapshot?.totals || null,
    session_count: report.snapshot?.session_count || 0,
    download_url: `/api/charging/reports/${encodeURIComponent(report.id)}/download`
  };
}

function reportContentHash({ title, indication, snapshot }) {
  const stableSnapshot = {
    period_key: snapshot.period_key,
    period_start: snapshot.period_start,
    period_end: snapshot.period_end,
    attribution_rule: snapshot.attribution_rule,
    entries: snapshot.entries,
    totals: snapshot.totals,
    session_count: snapshot.session_count,
    excluded_pre_opening_balance_count: snapshot.excluded_pre_opening_balance_count,
    opening_balance_cutoff_date: snapshot.opening_balance_cutoff_date,
    missing_rate_session_ids: snapshot.missing_rate_session_ids,
    meter_continuity_issues: snapshot.meter_continuity_issues,
    reconciliation: snapshot.reconciliation,
    rate_source_url: snapshot.rate_source_url
  };
  return crypto.createHash('sha256')
    .update(JSON.stringify({ title, indication, snapshot: stableSnapshot }))
    .digest('hex');
}

async function generateQuarterlyReport({ year, quarter, finalize = false, force = false }) {
  const bounds = quarterBounds(year, quarter);
  const status = finalize ? 'final' : 'provisional';
  const id = `ev-charging-${bounds.key}-${status}`;
  const previous = getReportById(id);
  if (previous && !force && !previous.needs_review) return publicReport(previous);

  const settings = getAppSettings();
  const snapshot = computeQuarterSnapshot({
    year: bounds.year,
    quarter: bounds.quarter,
    sessions: getSessions(),
    dailyTotals: getDailyTotals(),
    rates: getRates(),
    settings
  });

  if (finalize && snapshot.missing_rate_session_ids.length) {
    throw reportError('The report cannot be finalized until every entry has a CREG rate.');
  }
  if (finalize && snapshot.entries.length === 0) {
    throw reportError('The report cannot be finalized because this quarter has no charging entries.');
  }

  const title = settings.chargingReportTitle || 'Terugbetaling opladen wagen';
  const indication = settings.chargingReportIndication || '';
  const contentHash = reportContentHash({ title, indication, snapshot });
  if (previous?.content_hash === contentHash) {
    if (previous.needs_review) {
      previous.needs_review = false;
      previous.review_reason = '';
      previous.updated_at = new Date().toISOString();
      saveReport(previous);
    }
    return publicReport(previous);
  }

  const generatedAt = new Date().toISOString();
  const report = {
    id,
    schema_version: 1,
    period_key: bounds.key,
    period_start: bounds.start,
    period_end: bounds.end,
    status,
    revision: Number(previous?.revision || 0) + 1,
    title,
    indication,
    content_hash: contentHash,
    snapshot,
    generated_at: generatedAt,
    finalized_at: finalize ? generatedAt : null,
    sent_at: null,
    recipient: null,
    needs_review: false,
    review_reason: '',
    updated_at: generatedAt
  };

  const pdf = await buildQuarterlyChargingPdf(report);
  report.file_name = pdf.fileName;
  saveReport(report);
  return publicReport(report);
}

async function sendQuarterlyReport(id) {
  const report = getReportById(id);
  if (!report) throw reportError('Charging report not found.', 404);
  if (report.status !== 'final') throw reportError('Finalize the report before sending it.');
  if (report.needs_review) throw reportError('Review and regenerate this report before sending it.');
  if (report.sent_at) throw reportError('This report has already been sent.', 409);

  const settings = getAppSettings();
  const recipient = settings.chargingReportRecipient || settings.defaultRecipient;
  if (!recipient) throw reportError('Set a charging report recipient or default recipient in Settings.');
  const filePath = path.join(config.outputDir, path.basename(report.file_name));
  if (!fs.existsSync(filePath)) throw reportError('The report PDF is missing. Regenerate the report first.', 404);

  const subject = `EV charging reimbursement - ${report.period_key}`;
  await sendPdf({
    to: recipient,
    subject,
    text: '',
    filePath,
    fileName: report.file_name
  });

  const sentAt = new Date().toISOString();
  report.sent_at = sentAt;
  report.recipient = recipient;
  report.updated_at = sentAt;
  saveReport(report);
  appendSentRecord({
    id: `charging_${report.period_key}_${report.revision}`,
    requestId: `charging-report-${report.id}-r${report.revision}`,
    documentType: 'EV_CHARGING_REIMBURSEMENT',
    recipient,
    fileName: report.file_name,
    subject,
    channel: 'charging',
    sentAt
  });
  return publicReport(report);
}

function getCandidateQuarters(settings) {
  const keys = new Map();
  getSessions().forEach((session) => {
    const value = quarterFromDate(String(session.start || '').slice(0, 10));
    if (value) keys.set(`${value.year}-Q${value.quarter}`, value);
  });
  const opening = quarterFromDate(settings.chargingOpeningBalanceDate || '');
  if (opening && Number(settings.chargingOpeningBalanceKwh || 0) > 0) {
    keys.set(`${opening.year}-Q${opening.quarter}`, opening);
  }
  return [...keys.values()];
}

function isFinalizationDue(bounds, timezone, now) {
  const today = getDateInTimezone(now, timezone);
  const time = getTimeInTimezone(now, timezone);
  const lastDay = addDays(bounds.end, -1);
  return today >= bounds.end || (today === lastDay && time >= '23:58');
}

async function finalizeDueQuarterlyReports() {
  const settings = getAppSettings();
  if (!settings.chargingAutoFinalize) return { skipped: true, reason: 'Automatic finalization disabled.' };
  const timezone = settings.chargingTimezone || 'Europe/Brussels';
  const finalized = [];
  const failures = [];
  for (const candidate of getCandidateQuarters(settings)) {
    const bounds = quarterBounds(candidate.year, candidate.quarter);
    if (!isFinalizationDue(bounds, timezone, new Date())) continue;
    const existing = getReports().find((item) => item.id === `ev-charging-${bounds.key}-final`);
    if (existing && !existing.needs_review) continue;
    try {
      finalized.push(await generateQuarterlyReport({
        year: candidate.year,
        quarter: candidate.quarter,
        finalize: true,
        force: Boolean(existing)
      }));
    } catch (error) {
      failures.push({ period_key: bounds.key, error: error.message });
    }
  }
  return { skipped: false, finalized, failures };
}

function startChargingReportScheduler() {
  cron.schedule('* * * * *', async () => {
    try {
      await finalizeDueQuarterlyReports();
    } catch (error) {
      console.error('[charging-report] error:', error.message);
    }
  });

  setTimeout(() => {
    finalizeDueQuarterlyReports().catch((error) => {
      console.error('[charging-report] startup error:', error.message);
    });
  }, 2000);
}

module.exports = {
  publicReport,
  generateQuarterlyReport,
  sendQuarterlyReport,
  finalizeDueQuarterlyReports,
  startChargingReportScheduler
};
