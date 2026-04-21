const fs = require('fs');
const path = require('path');
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

function getDefaultSettings() {
  return {
    gmailUser: config.gmailUser,
    gmailAppPassword: config.gmailAppPassword,
    defaultRecipient: config.defaultRecipient,
    billitRecipient: config.billitRecipient,
    updatedAt: null
  };
}

function getAppSettings() {
  const defaults = getDefaultSettings();
  const saved = readJson(config.settingsFile, defaults);
  return {
    ...defaults,
    ...saved
  };
}

function getPublicSettings() {
  const settings = getAppSettings();
  return {
    gmailUser: settings.gmailUser,
    defaultRecipient: settings.defaultRecipient,
    billitRecipient: settings.billitRecipient,
    hasGmailAppPassword: Boolean(settings.gmailAppPassword),
    updatedAt: settings.updatedAt || null
  };
}

function saveAppSettings(patch) {
  const current = getAppSettings();
  const next = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString()
  };
  writeJson(config.settingsFile, next);
  return next;
}

module.exports = {
  getAppSettings,
  getPublicSettings,
  saveAppSettings
};
