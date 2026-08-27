const crypto = require('crypto');
const express = require('express');
const path = require('path');
const config = require('./config');
const { getAppSettings } = require('./settingsStore');
const {
  getSessions,
  upsertSession,
  updateSessionManually,
  getDailyTotals,
  upsertDailyTotal,
  getRates,
  saveRate,
  deleteRate,
  getReports,
  getReportById,
  markFinalReportNeedsReview,
  markReportsForRateRange
} = require('./chargingStore');
const {
  CREG_RATE_SOURCE_URL,
  isDateString,
  quarterFromDate,
  getDateInTimezone,
  findMissingDailySummaries,
  computeQuarterSnapshot
} = require('./chargingAccounting');
const {
  validateChargingSession,
  validateDailySummary,
  validateSessionResync,
  validateManualSessionUpdate
} = require('./chargingValidation');
const {
  publicReport,
  generateQuarterlyReport,
  sendQuarterlyReport
} = require('./chargingReports');

function secureTokenMatches(expected, received) {
  const expectedBuffer = Buffer.from(String(expected || ''), 'utf8');
  const receivedBuffer = Buffer.from(String(received || ''), 'utf8');
  return expectedBuffer.length > 0
    && expectedBuffer.length === receivedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function requireHomeAssistantToken(req, res, next) {
  const configuredToken = getAppSettings().chargingApiToken;
  if (!configuredToken) {
    return res.status(503).json({ error: 'Charging API token is not configured.' });
  }
  const match = String(req.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  if (!match || !secureTokenMatches(configuredToken, match[1].trim())) {
    res.set('WWW-Authenticate', 'Bearer');
    return res.status(401).json({ error: 'Invalid or missing bearer token.' });
  }
  return next();
}

function routeError(res, error) {
  return res.status(error.statusCode || 500).json({ error: error.message });
}

function resolvePeriod(req) {
  const settings = getAppSettings();
  const today = getDateInTimezone(new Date(), settings.chargingTimezone || 'Europe/Brussels');
  const current = quarterFromDate(today);
  const year = Number(req.query.year || current.year);
  const quarter = Number(req.query.quarter || current.quarter);
  return { year, quarter, settings };
}

function createChargingRouter() {
  const router = express.Router();

  router.post('/v1/charging-sessions', requireHomeAssistantToken, (req, res) => {
    try {
      const session = validateChargingSession(req.body);
      const result = upsertSession(session);
      if (result.changed) {
        markFinalReportNeedsReview(session.start, 'A charging session was received or changed after finalization.');
      }
      return res.status(result.action === 'created' ? 201 : 200).json({
        ok: true,
        action: result.action,
        session_id: session.session_id,
        quality_issues: result.record.quality_issues || []
      });
    } catch (error) {
      return routeError(res, error);
    }
  });

  router.post('/v1/daily-summary', requireHomeAssistantToken, (req, res) => {
    try {
      if (req.body?.event === 'daily_summary') {
        const summary = validateDailySummary(req.body);
        const result = upsertDailyTotal(summary);
        markFinalReportNeedsReview(
          `${summary.date}T00:00:00`,
          'A Home Assistant daily summary changed the final report reconciliation.'
        );
        return res.status(result.action === 'created' ? 201 : 200).json({
          ok: true,
          action: result.action,
          date: summary.date
        });
      }

      if (req.body?.event === 'session_resync') {
        const sessions = validateSessionResync(req.body);
        const counts = { created: 0, updated: 0, unchanged: 0, protected: 0 };
        sessions.forEach((session) => {
          const result = upsertSession(session);
          counts[result.action] += 1;
          if (result.changed) {
            markFinalReportNeedsReview(session.start, 'A Home Assistant resync changed this finalized quarter.');
          }
        });
        return res.json({ ok: true, received: sessions.length, ...counts });
      }

      return res.status(400).json({ error: 'event must be daily_summary or session_resync.' });
    } catch (error) {
      return routeError(res, error);
    }
  });

  router.patch('/charging/sessions/:sessionId', (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const update = validateManualSessionUpdate(req.body, sessionId);
      const result = updateSessionManually(sessionId, update.session, update);
      if (!result) return res.status(404).json({ error: 'Charging session not found.' });
      if (result.changed) {
        markFinalReportNeedsReview(
          result.previous.start,
          'A charging session was manually corrected after finalization.'
        );
        markFinalReportNeedsReview(
          update.session.start,
          'A charging session was manually corrected after finalization.'
        );
      }
      return res.json({
        ok: true,
        action: result.action,
        session_id: sessionId,
        manual_override: result.record.manual_override,
        quality_issues: result.record.quality_issues
      });
    } catch (error) {
      return routeError(res, error);
    }
  });

  router.get('/charging/overview', (req, res) => {
    try {
      const { year, quarter, settings } = resolvePeriod(req);
      const sessions = getSessions();
      const dailyTotals = getDailyTotals();
      const rates = getRates();
      const snapshot = computeQuarterSnapshot({ year, quarter, sessions, dailyTotals, rates, settings });
      const receivedTimes = [
        ...sessions.map((item) => item.received_at),
        ...dailyTotals.map((item) => item.received_at)
      ].filter(Boolean).sort().reverse();
      const reports = getReports()
        .filter((item) => item.period_key === snapshot.period_key)
        .map(publicReport);
      return res.json({
        snapshot,
        reports,
        missing_heartbeats: findMissingDailySummaries(
          dailyTotals,
          settings.chargingTimezone || 'Europe/Brussels'
        ),
        last_received_at: receivedTimes[0] || null,
        has_api_token: Boolean(settings.chargingApiToken),
        rate_source_url: CREG_RATE_SOURCE_URL,
        endpoints: {
          charging_session: '/api/v1/charging-sessions',
          daily_summary_and_resync: '/api/v1/daily-summary'
        }
      });
    } catch (error) {
      return routeError(res, error);
    }
  });

  router.get('/charging/rates', (_req, res) => {
    return res.json({ rates: getRates(), source_url: CREG_RATE_SOURCE_URL });
  });

  router.post('/charging/rates', (req, res) => {
    try {
      const body = req.body || {};
      const periodStart = String(body.period_start || '');
      const periodEnd = String(body.period_end || '');
      const rate = Number(body.eur_per_kwh);
      if (!isDateString(periodStart) || !isDateString(periodEnd) || periodEnd <= periodStart) {
        return res.status(400).json({ error: 'Provide a valid start date and an exclusive end date.' });
      }
      if (!Number.isFinite(rate) || rate <= 0 || rate > 10) {
        return res.status(400).json({ error: 'eur_per_kwh must be greater than 0 and no more than 10.' });
      }

      const overlap = getRates().find((item) => (
        item.period_start !== periodStart
        && item.period_start < periodEnd
        && item.period_end > periodStart
      ));
      if (overlap) {
        return res.status(409).json({
          error: `Rate period overlaps ${overlap.period_start} to ${overlap.period_end}.`
        });
      }

      const result = saveRate({
        period_start: periodStart,
        period_end: periodEnd,
        eur_per_kwh: rate,
        source_note: String(body.source_note || '').trim().slice(0, 500)
      });
      markReportsForRateRange(periodStart, periodEnd);
      return res.status(result.action === 'created' ? 201 : 200).json(result);
    } catch (error) {
      return routeError(res, error);
    }
  });

  router.delete('/charging/rates/:periodStart', (req, res) => {
    const periodStart = req.params.periodStart;
    const existing = getRates().find((item) => item.period_start === periodStart);
    if (!existing || !deleteRate(periodStart)) {
      return res.status(404).json({ error: 'CREG rate not found.' });
    }
    markReportsForRateRange(existing.period_start, existing.period_end);
    return res.status(204).send();
  });

  router.post('/charging/reports', async (req, res) => {
    try {
      const body = req.body || {};
      const report = await generateQuarterlyReport({
        year: Number(body.year),
        quarter: Number(body.quarter),
        finalize: Boolean(body.finalize),
        force: Boolean(body.force)
      });
      return res.status(201).json(report);
    } catch (error) {
      return routeError(res, error);
    }
  });

  router.post('/charging/reports/:id/send', async (req, res) => {
    try {
      return res.json(await sendQuarterlyReport(req.params.id));
    } catch (error) {
      return routeError(res, error);
    }
  });

  router.get('/charging/reports/:id/download', (req, res) => {
    const report = getReportById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Charging report not found.' });
    const filePath = path.join(config.outputDir, path.basename(report.file_name || ''));
    return res.download(filePath, report.file_name, (error) => {
      if (error && !res.headersSent) res.status(404).json({ error: 'Report PDF not found.' });
    });
  });

  return router;
}

module.exports = {
  createChargingRouter
};
