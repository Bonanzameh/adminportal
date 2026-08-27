const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  computeQuarterSnapshot,
  quarterKeyFromDate,
  findMissingDailySummaries
} = require('../src/chargingAccounting');
const { validateSessionResync } = require('../src/chargingValidation');

const baseSettings = {
  chargingTimezone: 'Europe/Brussels',
  chargingOpeningBalanceKwh: 140.778,
  chargingOpeningBalanceDate: '2026-07-01',
  chargingOpeningBalanceNote: 'Opening quarter balance'
};

const q3Rate = {
  period_start: '2026-07-01',
  period_end: '2026-10-01',
  eur_per_kwh: 0.307,
  source_note: 'CREG Q3 2026'
};

test('attributes a cross-quarter session to its local start date', () => {
  assert.equal(quarterKeyFromDate('2026-06-30T23:55:00'), '2026-Q2');
  const snapshot = computeQuarterSnapshot({
    year: 2026,
    quarter: 2,
    sessions: [{
      session_id: 'cross-quarter',
      start: '2026-06-30T23:55:00',
      end: '2026-07-01T01:00:00',
      energy_kwh: 8
    }],
    dailyTotals: [],
    rates: [{ period_start: '2026-04-01', period_end: '2026-07-01', eur_per_kwh: 0.3 }],
    settings: { ...baseSettings, chargingOpeningBalanceKwh: 0 }
  });
  assert.equal(snapshot.session_count, 1);
  assert.equal(snapshot.period_key, '2026-Q2');
});

test('includes opening balance and rounds only the final reimbursement total', () => {
  const snapshot = computeQuarterSnapshot({
    year: 2026,
    quarter: 3,
    sessions: [{
      session_id: 'session-1',
      start: '2026-08-25T18:19:46',
      end: '2026-08-26T07:12:03',
      energy_kwh: 16.274,
      solar_kwh: 3.118,
      grid_kwh: 13.156
    }, {
      session_id: 'session-2',
      start: '2026-08-27T01:00:00',
      end: '2026-08-27T03:00:00',
      energy_kwh: 10,
      solar_kwh: 1,
      grid_kwh: 9
    }],
    dailyTotals: [],
    rates: [q3Rate],
    settings: baseSettings
  });

  assert.equal(snapshot.totals.energy_kwh, 167.052);
  assert.equal(snapshot.totals.amount_eur, 51.28);
  assert.equal(snapshot.entries[0].kind, 'opening_balance');
  assert.deepEqual(snapshot.missing_rate_session_ids, []);
});

test('opening balance excludes sessions already covered by its cutoff date', () => {
  const snapshot = computeQuarterSnapshot({
    year: 2026,
    quarter: 3,
    sessions: [{
      session_id: 'old-corrupted-history',
      start: '2026-08-25T18:19:46',
      end: '2026-08-26T07:12:03',
      energy_kwh: 999
    }, {
      session_id: 'new-session',
      start: '2026-08-27T18:00:00',
      end: '2026-08-27T20:00:00',
      energy_kwh: 10
    }],
    dailyTotals: [],
    rates: [q3Rate],
    settings: {
      ...baseSettings,
      chargingOpeningBalanceDate: '2026-08-26'
    }
  });

  assert.equal(snapshot.session_count, 1);
  assert.equal(snapshot.excluded_pre_opening_balance_count, 1);
  assert.equal(snapshot.totals.energy_kwh, 150.778);
});

test('reconciles the ledger against the latest quarter heartbeat', () => {
  const snapshot = computeQuarterSnapshot({
    year: 2026,
    quarter: 3,
    sessions: [{
      session_id: 'session-1',
      start: '2026-08-25T18:19:46',
      end: '2026-08-26T07:12:03',
      energy_kwh: 16.274
    }],
    dailyTotals: [{ date: '2026-08-26', energy_kwh_quarter: 157.052 }],
    rates: [q3Rate],
    settings: baseSettings
  });
  assert.equal(snapshot.reconciliation.difference_kwh, 0);
});

test('flags missing daily heartbeats without treating them as zero consumption', () => {
  const missing = findMissingDailySummaries(
    [{ date: '2026-08-23' }, { date: '2026-08-25' }],
    'Europe/Brussels',
    new Date('2026-08-27T12:00:00Z')
  );
  assert.deepEqual(missing, ['2026-08-24', '2026-08-26']);
});

test('accepts a reduced resync record', () => {
  const sessions = validateSessionResync({
    schema_version: 1,
    event: 'session_resync',
    timezone: 'Europe/Brussels',
    charger: 'charger',
    vehicle: 'vehicle',
    sessions: [{
      session_id: 'resync-1',
      start: '2026-08-25T18:19:46',
      end: '2026-08-26T07:12:03',
      energy_kwh: 16.274,
      solar_kwh: 3.118,
      grid_kwh: 13.156,
      soc_end_pct: -1
    }]
  });
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].meter_start_kwh, undefined);
  assert.equal(sessions[0].timezone, 'Europe/Brussels');
});

test('reduced resync does not erase meter fields from a richer session', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adminportal-store-test-'));
  const previousDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = tempDir;
  delete require.cache[require.resolve('../src/config')];
  delete require.cache[require.resolve('../src/chargingStore')];
  const { upsertSession, getSessions } = require('../src/chargingStore');

  upsertSession({
    session_id: 'same-session',
    start: '2026-08-25T18:19:46',
    end: '2026-08-26T07:12:03',
    energy_kwh: 16.274,
    meter_start_kwh: 123.451,
    meter_end_kwh: 139.725
  });
  upsertSession({
    session_id: 'same-session',
    start: '2026-08-25T18:19:46',
    end: '2026-08-26T07:12:03',
    energy_kwh: 16.274,
    meter_start_kwh: undefined,
    meter_end_kwh: undefined
  });

  assert.equal(getSessions()[0].meter_start_kwh, 123.451);
  assert.equal(getSessions()[0].meter_end_kwh, 139.725);
  fs.rmSync(tempDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
});
