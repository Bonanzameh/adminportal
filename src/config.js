const path = require('path');

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const outputDir = process.env.OUTPUT_DIR || path.join(process.cwd(), 'generated-pdfs');

module.exports = {
  port: Number(process.env.PORT || 3000),
  gmailUser: process.env.GMAIL_USER || '',
  gmailAppPassword: process.env.GMAIL_APP_PASSWORD || '',
  defaultRecipient: process.env.DEFAULT_RECIPIENT || '',
  billitRecipient: process.env.BILLIT_RECIPIENT || '',
  dataDir,
  templatesFile: path.join(dataDir, 'templates.json'),
  autopilotFile: path.join(dataDir, 'autopilot.json'),
  sentLogFile: path.join(dataDir, 'sent-log.json'),
  settingsFile: path.join(dataDir, 'settings.json'),
  chargingSessionsFile: path.join(dataDir, 'charging-sessions.json'),
  chargingDailyTotalsFile: path.join(dataDir, 'charging-daily-totals.json'),
  chargingRatesFile: path.join(dataDir, 'charging-rates.json'),
  chargingReportsFile: path.join(dataDir, 'charging-reports.json'),
  outputDir,
  timezone: process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
};
