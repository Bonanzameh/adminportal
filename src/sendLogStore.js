const fs = require('fs');
const path = require('path');
const config = require('./config');

const MAX_LOG_ITEMS = 500;

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

function getSentLog() {
  const records = readJson(config.sentLogFile, []);
  return Array.isArray(records) ? records : [];
}

function appendSentRecord(record) {
  const records = getSentLog();
  records.unshift({
    id: record.id,
    requestId: record.requestId || null,
    documentType: record.documentType,
    recipient: record.recipient,
    fileName: record.fileName,
    annexFileName: record.annexFileName || null,
    fingerprint: record.fingerprint || null,
    subject: record.subject || null,
    channel: record.channel || 'manual',
    sentAt: record.sentAt || new Date().toISOString()
  });

  writeJson(config.sentLogFile, records.slice(0, MAX_LOG_ITEMS));
}

function findSentByRequestId(requestId) {
  if (!requestId) {
    return null;
  }
  return getSentLog().find((item) => item.requestId === requestId) || null;
}

function findRecentByFingerprint(fingerprint, options = {}) {
  const {
    windowMs = 120000,
    channel = 'manual'
  } = options;

  if (!fingerprint) {
    return null;
  }

  const now = Date.now();
  return getSentLog().find((item) => {
    if (!item.fingerprint || item.fingerprint !== fingerprint || item.channel !== channel) {
      return false;
    }
    const ts = new Date(item.sentAt).getTime();
    return Number.isFinite(ts) && now - ts <= windowMs;
  }) || null;
}

module.exports = {
  getSentLog,
  appendSentRecord,
  findSentByRequestId,
  findRecentByFingerprint
};
