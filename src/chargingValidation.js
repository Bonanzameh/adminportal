const { isDateString, localDateFromTimestamp } = require('./chargingAccounting');

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function cleanString(value, field, { required = false, max = 250 } = {}) {
  if (value === undefined || value === null) {
    if (required) throw validationError(`${field} is required.`);
    return undefined;
  }
  const result = String(value).trim();
  if (required && !result) throw validationError(`${field} is required.`);
  if (result.length > max) throw validationError(`${field} is too long.`);
  return result;
}

function cleanNumber(value, field, { required = false, min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw validationError(`${field} is required.`);
    return undefined;
  }
  const result = Number(value);
  if (!Number.isFinite(result) || result < min || result > max) {
    throw validationError(`${field} must be a number between ${min} and ${max}.`);
  }
  return result;
}

function cleanTimestamp(value, field) {
  const result = cleanString(value, field, { required: true, max: 40 });
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(result)
    ? `${result}:00`
    : result;
  if (!localDateFromTimestamp(normalized)) {
    throw validationError(`${field} must use local ISO format YYYY-MM-DDTHH:mm:ss.`);
  }
  return normalized;
}

function validateSchema(payload, expectedEvent) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw validationError('A JSON object is required.');
  }
  if (Number(payload.schema_version) !== 1) {
    throw validationError('Only schema_version 1 is supported.');
  }
  if (payload.event !== expectedEvent) {
    throw validationError(`event must be ${expectedEvent}.`);
  }
}

function normalizeSession(payload, defaults = {}) {
  const start = cleanTimestamp(payload.start, 'start');
  const end = cleanTimestamp(payload.end, 'end');
  if (end < start) throw validationError('end must be after start.');

  const energyKwh = cleanNumber(payload.energy_kwh, 'energy_kwh', { required: true, min: 0, max: 1000 });
  const solarKwh = cleanNumber(payload.solar_kwh, 'solar_kwh', { min: 0, max: 1000 });
  const gridKwh = cleanNumber(payload.grid_kwh, 'grid_kwh', { min: 0, max: 1000 });
  const meterStart = cleanNumber(payload.meter_start_kwh, 'meter_start_kwh', { min: 0 });
  const meterEnd = cleanNumber(payload.meter_end_kwh, 'meter_end_kwh', { min: 0 });
  const socEnd = cleanNumber(payload.soc_end_pct, 'soc_end_pct', { min: -1, max: 100 });
  const qualityIssues = [];

  if (Number.isFinite(solarKwh) && Number.isFinite(gridKwh)) {
    const splitDifference = Math.abs((solarKwh + gridKwh) - energyKwh);
    if (splitDifference > 0.05) qualityIssues.push('solar_grid_split_mismatch');
  }
  if (Number.isFinite(meterStart) && Number.isFinite(meterEnd) && meterEnd < meterStart) {
    qualityIssues.push('meter_totaliser_decreased');
  }

  return {
    schema_version: 1,
    event: 'charging_session',
    session_id: cleanString(payload.session_id, 'session_id', { required: true, max: 200 }),
    start,
    end,
    timezone: cleanString(payload.timezone ?? defaults.timezone, 'timezone', { required: true, max: 80 }),
    energy_kwh: energyKwh,
    solar_kwh: solarKwh,
    grid_kwh: gridKwh,
    meter_start_kwh: meterStart,
    meter_end_kwh: meterEnd,
    soc_end_pct: socEnd,
    charger: cleanString(payload.charger ?? defaults.charger, 'charger', { max: 120 }),
    vehicle: cleanString(payload.vehicle ?? defaults.vehicle, 'vehicle', { max: 160 }),
    quality_issues: qualityIssues
  };
}

function validateChargingSession(payload) {
  validateSchema(payload, 'charging_session');
  return normalizeSession(payload);
}

function validateDailySummary(payload) {
  validateSchema(payload, 'daily_summary');
  const date = cleanString(payload.date, 'date', { required: true, max: 10 });
  if (!isDateString(date)) throw validationError('date must use YYYY-MM-DD format.');

  return {
    schema_version: 1,
    event: 'daily_summary',
    date,
    timezone: cleanString(payload.timezone, 'timezone', { required: true, max: 80 }),
    energy_kwh_day: cleanNumber(payload.energy_kwh_day, 'energy_kwh_day', { required: true, min: 0 }),
    energy_kwh_month: cleanNumber(payload.energy_kwh_month, 'energy_kwh_month', { required: true, min: 0 }),
    energy_kwh_quarter: cleanNumber(payload.energy_kwh_quarter, 'energy_kwh_quarter', { required: true, min: 0 }),
    energy_kwh_year: cleanNumber(payload.energy_kwh_year, 'energy_kwh_year', { required: true, min: 0 }),
    meter_total_kwh: cleanNumber(payload.meter_total_kwh, 'meter_total_kwh', { required: true, min: 0 }),
    meter_solar_total_kwh: cleanNumber(payload.meter_solar_total_kwh, 'meter_solar_total_kwh', { min: 0 }),
    charger: cleanString(payload.charger, 'charger', { max: 120 }),
    vehicle: cleanString(payload.vehicle, 'vehicle', { max: 160 })
  };
}

function validateSessionResync(payload) {
  validateSchema(payload, 'session_resync');
  if (!Array.isArray(payload.sessions)) throw validationError('sessions must be an array.');
  if (payload.sessions.length > 50) throw validationError('sessions may contain at most 50 records.');
  const defaults = {
    timezone: payload.timezone,
    charger: payload.charger,
    vehicle: payload.vehicle
  };
  return payload.sessions.map((session) => normalizeSession(session, defaults));
}

function validateManualSessionUpdate(payload, sessionId) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw validationError('A JSON object is required.');
  }
  if (typeof payload.manual_override !== 'boolean') {
    throw validationError('manual_override must be true or false.');
  }

  return {
    session: normalizeSession({
      ...payload,
      session_id: sessionId
    }),
    manualOverride: payload.manual_override,
    overrideNote: cleanString(payload.manual_override_note, 'manual_override_note', { max: 500 }) || ''
  };
}

module.exports = {
  validationError,
  validateChargingSession,
  validateDailySummary,
  validateSessionResync,
  validateManualSessionUpdate
};
