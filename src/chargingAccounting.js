const CREG_RATE_SOURCE_URL = 'https://www.creg.be/nl/consumenten/prijzen-en-tarieven/creg-tarief-voor-terugbetaling-thuisladen-bedrijfswagens';

function isDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function localDateFromTimestamp(value) {
  const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/);
  return match && isDateString(match[1]) ? match[1] : null;
}

function quarterFromDate(dateString) {
  if (!isDateString(dateString)) return null;
  const year = Number(dateString.slice(0, 4));
  const month = Number(dateString.slice(5, 7));
  return { year, quarter: Math.floor((month - 1) / 3) + 1 };
}

function quarterKeyFromDate(dateOrTimestamp) {
  const dateString = String(dateOrTimestamp || '').slice(0, 10);
  const value = quarterFromDate(dateString);
  return value ? `${value.year}-Q${value.quarter}` : null;
}

function quarterBounds(year, quarter) {
  const normalizedYear = Number(year);
  const normalizedQuarter = Number(quarter);
  if (!Number.isInteger(normalizedYear) || normalizedYear < 2000 || normalizedYear > 2200) {
    const error = new Error('Year must be between 2000 and 2200.');
    error.statusCode = 400;
    throw error;
  }
  if (![1, 2, 3, 4].includes(normalizedQuarter)) {
    const error = new Error('Quarter must be between 1 and 4.');
    error.statusCode = 400;
    throw error;
  }

  const startMonth = (normalizedQuarter - 1) * 3 + 1;
  const nextQuarterMonth = startMonth + 3;
  const endYear = nextQuarterMonth > 12 ? normalizedYear + 1 : normalizedYear;
  const endMonth = nextQuarterMonth > 12 ? nextQuarterMonth - 12 : nextQuarterMonth;
  return {
    year: normalizedYear,
    quarter: normalizedQuarter,
    key: `${normalizedYear}-Q${normalizedQuarter}`,
    start: `${normalizedYear}-${String(startMonth).padStart(2, '0')}-01`,
    end: `${endYear}-${String(endMonth).padStart(2, '0')}-01`
  };
}

function getDateInTimezone(date = new Date(), timezone = 'Europe/Brussels') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function getTimeInTimezone(date = new Date(), timezone = 'Europe/Brussels') {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.hour}:${value.minute}`;
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function round(value, decimals = 3) {
  if (!Number.isFinite(value)) return null;
  const multiplier = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

function findRateForDate(rates, dateString) {
  return rates.find((rate) => dateString >= rate.period_start && dateString < rate.period_end) || null;
}

function findMissingDailySummaries(dailyTotals, timezone, now = new Date()) {
  if (!dailyTotals.length) return [];
  const today = getDateInTimezone(now, timezone);
  const yesterday = addDays(today, -1);
  const earliestTracked = [...dailyTotals]
    .map((item) => item.date)
    .filter(isDateString)
    .sort()[0];
  const start = earliestTracked > addDays(yesterday, -13) ? earliestTracked : addDays(yesterday, -13);
  if (start > yesterday) return [];

  const received = new Set(dailyTotals.map((item) => item.date));
  const missing = [];
  for (let cursor = start; cursor <= yesterday; cursor = addDays(cursor, 1)) {
    if (!received.has(cursor)) missing.push(cursor);
  }
  return missing;
}

function meterContinuityIssues(sessions) {
  const ordered = [...sessions].sort((a, b) => String(a.start).localeCompare(String(b.start)));
  const issues = [];
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (!Number.isFinite(previous.meter_end_kwh) || !Number.isFinite(current.meter_start_kwh)) continue;
    const difference = round(current.meter_start_kwh - previous.meter_end_kwh, 3);
    if (Math.abs(difference) > 0.05) {
      issues.push({
        previous_session_id: previous.session_id,
        next_session_id: current.session_id,
        difference_kwh: difference
      });
    }
  }
  return issues;
}

function computeQuarterSnapshot({ year, quarter, sessions, dailyTotals, rates, settings }) {
  const bounds = quarterBounds(year, quarter);
  const openingKwh = Number(settings.chargingOpeningBalanceKwh || 0);
  const openingDate = settings.chargingOpeningBalanceDate || '';
  const openingApplies = openingKwh > 0 && openingDate >= bounds.start && openingDate < bounds.end;
  const allQuarterSessions = sessions
    .filter((session) => {
      const date = localDateFromTimestamp(session.start);
      return date && date >= bounds.start && date < bounds.end;
    })
    .sort((a, b) => String(a.start).localeCompare(String(b.start)));
  const excludedSessions = openingApplies
    ? allQuarterSessions.filter((session) => localDateFromTimestamp(session.start) <= openingDate)
    : [];
  const quarterSessions = openingApplies
    ? allQuarterSessions.filter((session) => localDateFromTimestamp(session.start) > openingDate)
    : allQuarterSessions;

  const entries = quarterSessions.map((session) => {
    const date = localDateFromTimestamp(session.start);
    const rate = findRateForDate(rates, date);
    const energy = Number(session.energy_kwh);
    return {
      kind: 'session',
      session_id: session.session_id,
      date,
      start: session.start,
      end: session.end,
      energy_kwh: energy,
      solar_kwh: Number.isFinite(session.solar_kwh) ? session.solar_kwh : null,
      grid_kwh: Number.isFinite(session.grid_kwh) ? session.grid_kwh : null,
      meter_start_kwh: Number.isFinite(session.meter_start_kwh) ? session.meter_start_kwh : null,
      meter_end_kwh: Number.isFinite(session.meter_end_kwh) ? session.meter_end_kwh : null,
      vehicle: session.vehicle || '',
      rate_period_start: rate?.period_start || null,
      rate_period_end: rate?.period_end || null,
      rate_source_note: rate?.source_note || '',
      rate_eur_per_kwh: rate ? Number(rate.eur_per_kwh) : null,
      amount_eur: rate ? round(energy * Number(rate.eur_per_kwh), 2) : null,
      amount_eur_unrounded: rate ? energy * Number(rate.eur_per_kwh) : null,
      quality_issues: session.quality_issues || []
    };
  });

  if (openingApplies) {
    const rate = findRateForDate(rates, openingDate);
    entries.unshift({
      kind: 'opening_balance',
      session_id: 'opening-balance',
      date: openingDate,
      start: `${openingDate}T00:00:00`,
      end: `${openingDate}T00:00:00`,
      energy_kwh: openingKwh,
      solar_kwh: null,
      grid_kwh: null,
      vehicle: '',
      rate_period_start: rate?.period_start || null,
      rate_period_end: rate?.period_end || null,
      rate_source_note: rate?.source_note || '',
      rate_eur_per_kwh: rate ? Number(rate.eur_per_kwh) : null,
      amount_eur: rate ? round(openingKwh * Number(rate.eur_per_kwh), 2) : null,
      amount_eur_unrounded: rate ? openingKwh * Number(rate.eur_per_kwh) : null,
      note: settings.chargingOpeningBalanceNote || 'Opening balance'
    });
  }

  const totals = entries.reduce((result, entry) => {
    result.energy_kwh += Number(entry.energy_kwh || 0);
    result.solar_kwh += Number(entry.solar_kwh || 0);
    result.grid_kwh += Number(entry.grid_kwh || 0);
    if (Number.isFinite(entry.amount_eur_unrounded)) result.amount_eur += entry.amount_eur_unrounded;
    return result;
  }, { energy_kwh: 0, solar_kwh: 0, grid_kwh: 0, amount_eur: 0 });

  Object.keys(totals).forEach((key) => {
    totals[key] = round(totals[key], key === 'amount_eur' ? 2 : 3);
  });

  const quarterDailyTotals = dailyTotals
    .filter((item) => item.date >= bounds.start && item.date < bounds.end)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const latestDaily = quarterDailyTotals[0] || null;
  let reconciliation = null;
  if (latestDaily && Number.isFinite(latestDaily.energy_kwh_quarter)) {
    const ledgerAtHeartbeat = entries
      .filter((entry) => entry.date <= latestDaily.date)
      .reduce((sum, entry) => sum + Number(entry.energy_kwh || 0), 0);
    reconciliation = {
      date: latestDaily.date,
      ledger_kwh: round(ledgerAtHeartbeat, 3),
      ha_quarter_kwh: round(Number(latestDaily.energy_kwh_quarter), 3),
      difference_kwh: round(ledgerAtHeartbeat - Number(latestDaily.energy_kwh_quarter), 3)
    };
  }

  return {
    schema_version: 1,
    period_key: bounds.key,
    period_start: bounds.start,
    period_end: bounds.end,
    attribution_rule: 'Session start timestamp',
    entries,
    totals,
    session_count: quarterSessions.length,
    excluded_pre_opening_balance_count: excludedSessions.length,
    opening_balance_cutoff_date: openingApplies ? openingDate : null,
    missing_rate_session_ids: entries
      .filter((entry) => !Number.isFinite(entry.rate_eur_per_kwh))
      .map((entry) => entry.session_id),
    meter_continuity_issues: meterContinuityIssues(quarterSessions),
    reconciliation,
    latest_daily_summary: latestDaily,
    rate_source_url: CREG_RATE_SOURCE_URL
  };
}

module.exports = {
  CREG_RATE_SOURCE_URL,
  isDateString,
  localDateFromTimestamp,
  quarterFromDate,
  quarterKeyFromDate,
  quarterBounds,
  getDateInTimezone,
  getTimeInTimezone,
  addDays,
  round,
  findRateForDate,
  findMissingDailySummaries,
  computeQuarterSnapshot
};
