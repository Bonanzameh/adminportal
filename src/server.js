require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');
const { buildPdf, buildCsvAnnexPdf } = require('./pdfGenerator');
const { sendPdf, sendMail } = require('./mailer');
const { v4: uuidv4 } = require('uuid');
const {
  getTemplates,
  saveTemplate,
  updateTemplate,
  getTemplateById,
  deleteTemplate,
  getAutopilotSettings,
  saveAutopilotSettings
} = require('./templateStore');
const {
  getSentLog,
  appendSentRecord,
  findSentByRequestId,
  findRecentByFingerprint
} = require('./sendLogStore');
const {
  getAppSettings,
  getPublicSettings,
  saveAppSettings
} = require('./settingsStore');
const { startAutopilotScheduler, runAutopilotOnce } = require('./autopilot');

const app = express();

app.use(express.json({ limit: '35mb' }));
app.use(express.static(path.join(process.cwd(), 'public')));

function validateDocType(documentType) {
  return ['VAT_PAYMENT', 'REIMBURSEMENT', 'TAX_PREPAY'].includes(documentType);
}

function buildSendFingerprint(payload) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

function sanitizeMailHeaderValue(rawValue) {
  return String(rawValue || '')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

function sanitizeEmailValue(rawValue) {
  return String(rawValue || '')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.get('/api/settings', (_req, res) => {
  return res.json(getPublicSettings());
});

app.put('/api/settings', (req, res) => {
  const {
    gmailUser,
    gmailAppPassword,
    defaultRecipient,
    billitRecipient
  } = req.body;

  const patch = {};

  if (gmailUser !== undefined) {
    const nextGmailUser = sanitizeEmailValue(gmailUser);
    if (!nextGmailUser || !looksLikeEmail(nextGmailUser)) {
      return res.status(400).json({ error: 'gmailUser must be a valid email address.' });
    }
    patch.gmailUser = nextGmailUser;
  }

  if (defaultRecipient !== undefined) {
    const nextDefaultRecipient = sanitizeEmailValue(defaultRecipient);
    if (!nextDefaultRecipient || !looksLikeEmail(nextDefaultRecipient)) {
      return res.status(400).json({ error: 'defaultRecipient must be a valid email address.' });
    }
    patch.defaultRecipient = nextDefaultRecipient;
  }

  if (billitRecipient !== undefined) {
    const nextBillitRecipient = sanitizeEmailValue(billitRecipient);
    if (!nextBillitRecipient || !looksLikeEmail(nextBillitRecipient)) {
      return res.status(400).json({ error: 'billitRecipient must be a valid email address.' });
    }
    patch.billitRecipient = nextBillitRecipient;
  }

  if (gmailAppPassword !== undefined) {
    const nextAppPassword = String(gmailAppPassword || '').trim();
    if (!nextAppPassword) {
      return res.status(400).json({ error: 'gmailAppPassword cannot be empty when provided.' });
    }
    patch.gmailAppPassword = nextAppPassword;
  }

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: 'No settings fields were provided.' });
  }

  saveAppSettings(patch);

  return res.json(getPublicSettings());
});

app.get('/api/sent-files', (req, res) => {
  const limit = Math.max(1, Math.min(Number(req.query.limit || 50), 500));
  return res.json(getSentLog().slice(0, limit));
});

app.get('/api/templates', (req, res) => {
  const { documentType } = req.query;
  const templates = getTemplates();
  if (documentType) {
    return res.json(templates.filter((t) => t.documentType === documentType));
  }
  return res.json(templates);
});

app.post('/api/templates', (req, res) => {
  const { name, documentType, paymentInfo, fixedFields } = req.body;
  if (!name || !validateDocType(documentType)) {
    return res.status(400).json({ error: 'Invalid template payload.' });
  }

  const template = saveTemplate({
    name,
    documentType,
    paymentInfo: paymentInfo || {},
    fixedFields: fixedFields || {}
  });

  return res.status(201).json(template);
});

app.put('/api/templates/:id', (req, res) => {
  const { name, documentType, paymentInfo, fixedFields } = req.body;
  if (!name || !validateDocType(documentType)) {
    return res.status(400).json({ error: 'Invalid template payload.' });
  }

  const template = updateTemplate(req.params.id, {
    name,
    documentType,
    paymentInfo: paymentInfo || {},
    fixedFields: fixedFields || {}
  });

  if (!template) {
    return res.status(404).json({ error: 'Template not found.' });
  }

  return res.json(template);
});

app.delete('/api/templates/:id', (req, res) => {
  const success = deleteTemplate(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Template not found.' });
  }
  return res.status(204).send();
});

app.get('/api/autopilot', (_req, res) => {
  return res.json(getAutopilotSettings());
});

app.put('/api/autopilot', (req, res) => {
  const next = {
    ...getAutopilotSettings(),
    ...req.body,
    templateIdByType: {
      ...getAutopilotSettings().templateIdByType,
      ...(req.body.templateIdByType || {})
    }
  };

  saveAutopilotSettings(next);
  return res.json(next);
});

app.post('/api/autopilot/run-now', async (_req, res) => {
  try {
    const result = await runAutopilotOnce({ force: true });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/send-billit-file', async (req, res) => {
  try {
    const {
      requestId,
      fileName,
      mimeType,
      contentBase64
    } = req.body;

    if (!fileName || !contentBase64) {
      return res.status(400).json({ error: 'Missing fileName or contentBase64.' });
    }

    const normalizedFileName = sanitizeMailHeaderValue(path.basename(fileName));
    if (!normalizedFileName) {
      return res.status(400).json({ error: 'Invalid fileName.' });
    }

    const appSettings = getAppSettings();
    const billitRecipient = appSettings.billitRecipient || config.billitRecipient;
    if (!billitRecipient) {
      return res.status(400).json({ error: 'Billit recipient is not configured in Settings.' });
    }

    const duplicate = findSentByRequestId(requestId);
    if (duplicate) {
      return res.status(409).json({
        error: 'Duplicate send request blocked.',
        duplicateRecord: duplicate
      });
    }

    const fingerprint = buildSendFingerprint({
      fileName: normalizedFileName,
      mimeType: mimeType || '',
      contentBase64,
      sendTo: billitRecipient
    });

    const recentDuplicate = findRecentByFingerprint(fingerprint, {
      channel: 'billit'
    });
    if (recentDuplicate) {
      return res.status(409).json({
        error: 'Duplicate send blocked: this file was recently sent.',
        duplicateRecord: recentDuplicate
      });
    }

    let attachmentContent;
    try {
      attachmentContent = Buffer.from(contentBase64, 'base64');
    } catch (_err) {
      return res.status(400).json({ error: 'Invalid base64 content.' });
    }

    await sendMail({
      to: billitRecipient,
      subject: normalizedFileName,
      text: '',
      attachments: [
        {
          filename: normalizedFileName,
          content: attachmentContent,
          contentType: mimeType || 'application/octet-stream'
        }
      ]
    });

    appendSentRecord({
      id: uuidv4(),
      requestId: requestId || null,
      documentType: 'BILLIT_FILE',
      recipient: billitRecipient,
      fileName: normalizedFileName,
      fingerprint,
      subject: normalizedFileName,
      channel: 'billit'
    });

    return res.json({
      success: true,
      recipient: billitRecipient,
      fileName: normalizedFileName,
      subject: normalizedFileName
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/generate-and-send', async (req, res) => {
  try {
    const {
      documentType,
      templateId,
      details,
      periodLabel,
      keepAsTemplate,
      templateName,
      paymentInfo,
      fixedFields,
      sendTo,
      annexCsv,
      requestId
    } = req.body;

    const appSettings = getAppSettings();
    const fallbackRecipient = appSettings.defaultRecipient || config.defaultRecipient;
    const outboundRecipient = sendTo || fallbackRecipient;
    if (!outboundRecipient) {
      return res.status(400).json({ error: 'Recipient is required. Set it in form or Settings.' });
    }

    const duplicate = findSentByRequestId(requestId);
    if (duplicate) {
      return res.status(409).json({
        error: 'Duplicate send request blocked.',
        duplicateRecord: duplicate
      });
    }

    const fingerprint = buildSendFingerprint({
      documentType,
      templateId: templateId || '',
      details: details || {},
      periodLabel: periodLabel || '',
      paymentInfo: paymentInfo || {},
      fixedFields: fixedFields || {},
      sendTo: outboundRecipient,
      annexCsvName: annexCsv?.name || '',
      annexCsvContent: annexCsv?.content || ''
    });

    const recentDuplicate = findRecentByFingerprint(fingerprint);
    if (recentDuplicate) {
      return res.status(409).json({
        error: 'Duplicate send blocked: an identical document was recently sent.',
        duplicateRecord: recentDuplicate
      });
    }

    if (!validateDocType(documentType)) {
      return res.status(400).json({ error: 'Invalid document type.' });
    }

    let selectedTemplate = null;
    if (templateId) {
      selectedTemplate = getTemplateById(templateId);
      if (!selectedTemplate) {
        return res.status(404).json({ error: 'Template not found.' });
      }
    }

    const mergedPaymentInfo = {
      ...(selectedTemplate?.paymentInfo || {}),
      ...(paymentInfo || {})
    };

    const mergedFixedFields = {
      ...(selectedTemplate?.fixedFields || {}),
      ...(fixedFields || {})
    };

    const mergedDetails = {
      ...(selectedTemplate?.fixedFields || {}),
      ...(details || {})
    };

    const finalPeriod = periodLabel || new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    const { filePath, fileName } = await buildPdf({
      documentType,
      details: mergedDetails,
      paymentInfo: mergedPaymentInfo,
      fixedFields: mergedFixedFields,
      periodLabel: finalPeriod
    });

    const extraAttachments = [];
    if (annexCsv?.content) {
      const annexPdf = await buildCsvAnnexPdf({
        csvName: annexCsv.name || 'annex.csv',
        csvContent: annexCsv.content,
        periodLabel: finalPeriod
      });
      extraAttachments.push({
        filename: annexPdf.fileName,
        path: annexPdf.filePath,
        contentType: 'application/pdf'
      });
    }

    await sendPdf({
      to: outboundRecipient,
      subject: `${documentType} - ${finalPeriod}`,
      text: `Please find attached the generated ${documentType} PDF for ${finalPeriod}.`,
      filePath,
      fileName,
      extraAttachments
    });

    appendSentRecord({
      id: uuidv4(),
      requestId: requestId || null,
      documentType,
      recipient: outboundRecipient,
      fileName,
      annexFileName: extraAttachments[0]?.filename || null,
      fingerprint,
      subject: `${documentType} - ${finalPeriod}`,
      channel: 'manual'
    });

    let storedTemplate = null;
    if (keepAsTemplate && templateName) {
      storedTemplate = saveTemplate({
        name: templateName,
        documentType,
        paymentInfo: mergedPaymentInfo,
        fixedFields: mergedFixedFields
      });
    }

    return res.json({
      success: true,
      fileName,
      recipient: outboundRecipient,
      templateSaved: Boolean(storedTemplate),
      template: storedTemplate
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

app.listen(config.port, () => {
  console.log(`Adminportal running on http://localhost:${config.port}`);
  startAutopilotScheduler();
});
