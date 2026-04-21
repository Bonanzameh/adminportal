const path = require('path');

module.exports = {
  port: Number(process.env.PORT || 3000),
  gmailUser: process.env.GMAIL_USER || '',
  gmailAppPassword: process.env.GMAIL_APP_PASSWORD || '',
  defaultRecipient: process.env.DEFAULT_RECIPIENT || '',
  billitRecipient: process.env.BILLIT_RECIPIENT || '',
  dataDir: path.join(process.cwd(), 'data'),
  templatesFile: path.join(process.cwd(), 'data', 'templates.json'),
  autopilotFile: path.join(process.cwd(), 'data', 'autopilot.json'),
  sentLogFile: path.join(process.cwd(), 'data', 'sent-log.json'),
  settingsFile: path.join(process.cwd(), 'data', 'settings.json'),
  outputDir: path.join(process.cwd(), 'generated-pdfs'),
  timezone: process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
};
