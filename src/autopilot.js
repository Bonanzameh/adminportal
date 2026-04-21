const cron = require('node-cron');
const { buildPdf } = require('./pdfGenerator');
const { sendPdf } = require('./mailer');
const {
  getAutopilotSettings,
  saveAutopilotSettings,
  getTemplateById
} = require('./templateStore');
const { appendSentRecord } = require('./sendLogStore');

function periodKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function periodLabel(date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function buildAutoDetails(template, type, now) {
  const base = template.fixedFields || {};
  const month = periodLabel(now);
  let subjectDetail = 'reimbursement';
  if (type === 'VAT_PAYMENT') {
    subjectDetail = 'VAT payment';
  } else if (type === 'TAX_PREPAY') {
    subjectDetail = 'tax prepay';
  }

  return {
    ...base,
    reference: base.reference || `${subjectDetail} ${month}`,
    notes: base.notes || `Automatically generated ${subjectDetail} document for ${month}.`,
    amount: base.amount || '0.00',
    currency: base.currency || 'EUR'
  };
}

async function runAutopilotOnce(options = {}) {
  const { force = false } = options;
  const settings = getAutopilotSettings();
  if (!settings.enabled) {
    return { skipped: true, reason: 'Autopilot disabled' };
  }

  const now = new Date();
  const today = now.getDate();
  if (!force && today !== Number(settings.runDayOfMonth)) {
    return { skipped: true, reason: `Run day mismatch. Today=${today}` };
  }

  const key = periodKey(now);
  if (settings.lastRunByPeriod?.[key]) {
    return { skipped: true, reason: `Already sent for period ${key}` };
  }

  const sendTo = settings.sendTo;
  const sent = [];

  for (const type of ['VAT_PAYMENT', 'REIMBURSEMENT', 'TAX_PREPAY']) {
    const templateId = settings.templateIdByType?.[type];
    if (!templateId) {
      continue;
    }

    const template = getTemplateById(templateId);
    if (!template) {
      continue;
    }

    const details = buildAutoDetails(template, type, now);
    const period = periodLabel(now);

    const { filePath, fileName } = await buildPdf({
      documentType: type,
      details,
      paymentInfo: template.paymentInfo || {},
      fixedFields: template.fixedFields || {},
      periodLabel: period
    });

    await sendPdf({
      to: sendTo,
      subject: `[Autopilot] ${type} - ${period}`,
      text: `Autopilot generated ${type} document for ${period}.`,
      filePath,
      fileName
    });

    appendSentRecord({
      id: `auto_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      documentType: type,
      recipient: sendTo,
      fileName,
      subject: `[Autopilot] ${type} - ${period}`,
      channel: 'autopilot'
    });

    sent.push({ type, fileName, to: sendTo });
  }

  settings.lastRunByPeriod = settings.lastRunByPeriod || {};
  settings.lastRunByPeriod[key] = new Date().toISOString();
  saveAutopilotSettings(settings);

  return { skipped: false, sent };
}

function startAutopilotScheduler() {
  // Check every minute, execute only when configured time/day matches.
  cron.schedule('* * * * *', async () => {
    try {
      const settings = getAutopilotSettings();
      const now = new Date();
      if (!settings.enabled) {
        return;
      }

      const isRightMinute = now.getHours() === Number(settings.runHour)
        && now.getMinutes() === Number(settings.runMinute);

      if (!isRightMinute) {
        return;
      }

      await runAutopilotOnce();
    } catch (err) {
      // Keep scheduler alive on runtime error
      console.error('[autopilot] error:', err.message);
    }
  });
}

module.exports = {
  startAutopilotScheduler,
  runAutopilotOnce
};
