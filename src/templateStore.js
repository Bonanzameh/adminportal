const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');

function ensureDirAndFile(filePath, fallbackData) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallbackData, null, 2));
  }
}

function readJson(filePath, fallbackData) {
  ensureDirAndFile(filePath, fallbackData);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function getTemplates() {
  return readJson(config.templatesFile, []);
}

function saveTemplate(payload) {
  const templates = getTemplates();
  const template = {
    id: uuidv4(),
    name: payload.name,
    documentType: payload.documentType,
    paymentInfo: payload.paymentInfo,
    fixedFields: payload.fixedFields,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  templates.push(template);
  writeJson(config.templatesFile, templates);
  return template;
}

function updateTemplate(id, patch) {
  const templates = getTemplates();
  const idx = templates.findIndex((t) => t.id === id);
  if (idx === -1) {
    return null;
  }

  templates[idx] = {
    ...templates[idx],
    ...patch,
    updatedAt: new Date().toISOString()
  };

  writeJson(config.templatesFile, templates);
  return templates[idx];
}

function getTemplateById(id) {
  return getTemplates().find((t) => t.id === id) || null;
}

function deleteTemplate(id) {
  const templates = getTemplates();
  const filtered = templates.filter((t) => t.id !== id);
  writeJson(config.templatesFile, filtered);
  return filtered.length !== templates.length;
}

function getAutopilotSettings() {
  return readJson(config.autopilotFile, {
    enabled: false,
    runDayOfMonth: 2,
    runHour: 9,
    runMinute: 0,
    sendTo: config.defaultRecipient,
    templateIdByType: {
      VAT_PAYMENT: '',
      REIMBURSEMENT: '',
      TAX_PREPAY: ''
    },
    lastRunByPeriod: {}
  });
}

function saveAutopilotSettings(settings) {
  writeJson(config.autopilotFile, settings);
  return settings;
}

module.exports = {
  getTemplates,
  saveTemplate,
  updateTemplate,
  getTemplateById,
  deleteTemplate,
  getAutopilotSettings,
  saveAutopilotSettings
};
