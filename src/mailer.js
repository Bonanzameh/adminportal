const nodemailer = require('nodemailer');
const config = require('./config');
const { getAppSettings } = require('./settingsStore');

function createTransporter() {
  const settings = getAppSettings();
  const gmailUser = settings.gmailUser || config.gmailUser;
  const gmailAppPassword = settings.gmailAppPassword || config.gmailAppPassword;

  if (!gmailUser || !gmailAppPassword) {
    throw new Error('Missing Gmail credentials. Configure them in Settings or via environment variables.');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailAppPassword
    }
  });
}

async function sendMail({ to, subject, text = '', attachments = [] }) {
  const transporter = createTransporter();
  const settings = getAppSettings();
  const gmailUser = settings.gmailUser || config.gmailUser;

  await transporter.sendMail({
    from: gmailUser,
    to,
    subject,
    text,
    attachments
  });
}

async function sendPdf({ to, subject, text, filePath, fileName, extraAttachments = [] }) {
  const attachments = [
    {
      filename: fileName,
      path: filePath,
      contentType: 'application/pdf'
    },
    ...extraAttachments
  ];

  await sendMail({
    to,
    subject,
    text,
    attachments
  });
}

module.exports = {
  sendPdf,
  sendMail
};
