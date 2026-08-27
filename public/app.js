const els = {
  menuBtn: document.getElementById('menuBtn'),
  drawer: document.getElementById('drawer'),
  backdrop: document.getElementById('backdrop'),
  navBtns: Array.from(document.querySelectorAll('.nav-btn')),
  views: Array.from(document.querySelectorAll('.view')),
  form: document.getElementById('generateForm'),
  sendBtn: document.getElementById('sendBtn'),
  settingsForm: document.getElementById('settingsForm'),
  settingsGmailUser: document.getElementById('settingsGmailUser'),
  settingsDefaultRecipient: document.getElementById('settingsDefaultRecipient'),
  settingsBillitRecipient: document.getElementById('settingsBillitRecipient'),
  settingsGmailAppPassword: document.getElementById('settingsGmailAppPassword'),
  settingsChargingApiToken: document.getElementById('settingsChargingApiToken'),
  generateChargingTokenBtn: document.getElementById('generateChargingTokenBtn'),
  copyChargingTokenBtn: document.getElementById('copyChargingTokenBtn'),
  settingsChargingTimezone: document.getElementById('settingsChargingTimezone'),
  settingsChargingOpeningDate: document.getElementById('settingsChargingOpeningDate'),
  settingsChargingOpeningKwh: document.getElementById('settingsChargingOpeningKwh'),
  settingsChargingOpeningNote: document.getElementById('settingsChargingOpeningNote'),
  settingsChargingReportTitle: document.getElementById('settingsChargingReportTitle'),
  settingsChargingReportRecipient: document.getElementById('settingsChargingReportRecipient'),
  settingsChargingReportIndication: document.getElementById('settingsChargingReportIndication'),
  settingsChargingAutoFinalize: document.getElementById('settingsChargingAutoFinalize'),
  chargingSessionEndpoint: document.getElementById('chargingSessionEndpoint'),
  chargingDailyEndpoint: document.getElementById('chargingDailyEndpoint'),
  settingsStatusText: document.getElementById('settingsStatusText'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  documentType: document.getElementById('documentType'),
  templateId: document.getElementById('templateId'),
  sendTo: document.getElementById('sendTo'),
  periodLabel: document.getElementById('periodLabel'),
  entityName: document.getElementById('entityName'),
  vatNumber: document.getElementById('vatNumber'),
  address: document.getElementById('address'),
  amount: document.getElementById('amount'),
  currency: document.getElementById('currency'),
  reference: document.getElementById('reference'),
  iban: document.getElementById('iban'),
  bic: document.getElementById('bic'),
  recipientName: document.getElementById('recipientName'),
  notes: document.getElementById('notes'),
  annexCsv: document.getElementById('annexCsv'),
  keepAsTemplate: document.getElementById('keepAsTemplate'),
  templateNameWrap: document.getElementById('templateNameWrap'),
  templateName: document.getElementById('templateName'),
  templateList: document.getElementById('templateList'),
  status: document.getElementById('status'),
  templateEditorForm: document.getElementById('templateEditorForm'),
  editTemplateId: document.getElementById('editTemplateId'),
  editTemplateName: document.getElementById('editTemplateName'),
  editDocumentType: document.getElementById('editDocumentType'),
  editIban: document.getElementById('editIban'),
  editBic: document.getElementById('editBic'),
  editRecipientName: document.getElementById('editRecipientName'),
  editEntityName: document.getElementById('editEntityName'),
  editVatNumber: document.getElementById('editVatNumber'),
  editAddress: document.getElementById('editAddress'),
  editCurrency: document.getElementById('editCurrency'),
  editNotes: document.getElementById('editNotes'),
  autopilotForm: document.getElementById('autopilotForm'),
  autopilotEnabled: document.getElementById('autopilotEnabled'),
  runDayOfMonth: document.getElementById('runDayOfMonth'),
  runHour: document.getElementById('runHour'),
  runMinute: document.getElementById('runMinute'),
  autopilotRecipient: document.getElementById('autopilotRecipient'),
  autoVatTemplate: document.getElementById('autoVatTemplate'),
  autoReimbursementTemplate: document.getElementById('autoReimbursementTemplate'),
  autoTaxPrepayTemplate: document.getElementById('autoTaxPrepayTemplate'),
  runNowBtn: document.getElementById('runNowBtn'),
  sentFilesList: document.getElementById('sentFilesList'),
  refreshHistoryBtn: document.getElementById('refreshHistoryBtn'),
  billitDropzone: document.getElementById('billitDropzone'),
  billitRecipientLabel: document.getElementById('billitRecipientLabel'),
  billitFileInput: document.getElementById('billitFileInput'),
  billitSendAllBtn: document.getElementById('billitSendAllBtn'),
  billitClearBtn: document.getElementById('billitClearBtn'),
  billitQueueList: document.getElementById('billitQueueList'),
  chargingYear: document.getElementById('chargingYear'),
  chargingQuarter: document.getElementById('chargingQuarter'),
  chargingRefreshBtn: document.getElementById('chargingRefreshBtn'),
  chargingHeartbeatText: document.getElementById('chargingHeartbeatText'),
  chargingEnergyMetric: document.getElementById('chargingEnergyMetric'),
  chargingAmountMetric: document.getElementById('chargingAmountMetric'),
  chargingSessionMetric: document.getElementById('chargingSessionMetric'),
  chargingReconciliationMetric: document.getElementById('chargingReconciliationMetric'),
  chargingPeriodText: document.getElementById('chargingPeriodText'),
  chargingAlerts: document.getElementById('chargingAlerts'),
  chargingReportStatus: document.getElementById('chargingReportStatus'),
  chargingSessionsBody: document.getElementById('chargingSessionsBody'),
  chargingPreviewReportBtn: document.getElementById('chargingPreviewReportBtn'),
  chargingFinalizeReportBtn: document.getElementById('chargingFinalizeReportBtn'),
  chargingSendReportBtn: document.getElementById('chargingSendReportBtn'),
  chargingRateForm: document.getElementById('chargingRateForm'),
  chargingRateStart: document.getElementById('chargingRateStart'),
  chargingRateEnd: document.getElementById('chargingRateEnd'),
  chargingRateValue: document.getElementById('chargingRateValue'),
  chargingRateNote: document.getElementById('chargingRateNote'),
  chargingRateList: document.getElementById('chargingRateList'),
  cregRateLink: document.getElementById('cregRateLink')
};

let templates = [];
let sendInProgress = false;
let billitQueue = [];
let chargingOverview = null;

const quillGenerateBody = new Quill('#templateBodyEditor', {
  theme: 'snow',
  modules: {
    toolbar: [['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['clean']]
  }
});

const quillTemplateEditorBody = new Quill('#templateEditorBody', {
  theme: 'snow',
  modules: {
    toolbar: [['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['clean']]
  }
});

function setStatus(msg, isError = false) {
  els.status.textContent = msg;
  els.status.style.color = isError ? '#b91c1c' : '#14532d';
}

function getCurrentMonthYearLabel() {
  return new Date().toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric'
  });
}

function generateRequestId(prefix = 'req') {
  if (window.crypto?.randomUUID) {
    return `${prefix}_${window.crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatKwh(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
    ? `${Number(value).toFixed(3)} kWh`
    : '-';
}

function formatEur(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
    ? `${Number(value).toFixed(2)} EUR`
    : '-';
}

function openDrawer() {
  els.drawer.classList.add('open');
  els.backdrop.classList.remove('hidden');
}

function closeDrawer() {
  els.drawer.classList.remove('open');
  els.backdrop.classList.add('hidden');
}

function switchView(viewId) {
  els.views.forEach((view) => view.classList.toggle('active', view.id === viewId));
  els.navBtns.forEach((btn) => btn.classList.toggle('active', btn.dataset.view === viewId));
  closeDrawer();
}

async function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

async function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      if (comma === -1) {
        reject(new Error('Could not encode file in base64.'));
        return;
      }
      resolve(result.slice(comma + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const error = new Error(body.error || `Request failed: ${res.status}`);
    error.body = body;
    throw error;
  }

  if (res.status === 204) return null;
  return res.json();
}

function fillTemplateSelect(select, list, type) {
  select.innerHTML = '<option value="">No template</option>';
  list
    .filter((t) => !type || t.documentType === type)
    .forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `${t.name} (${t.documentType})`;
      select.appendChild(opt);
    });
}

function findTemplate(id) {
  return templates.find((t) => t.id === id) || null;
}

function applyTemplateToGenerateForm(template) {
  if (!template) return;

  els.documentType.value = template.documentType;
  fillTemplateSelect(els.templateId, templates, template.documentType);
  els.templateId.value = template.id;

  const fixed = template.fixedFields || {};
  const payment = template.paymentInfo || {};

  els.entityName.value = fixed.entityName || '';
  els.vatNumber.value = fixed.vatNumber || '';
  els.address.value = fixed.address || '';
  els.currency.value = fixed.currency || 'EUR';
  els.notes.value = fixed.notes || '';
  els.iban.value = payment.iban || '';
  els.bic.value = payment.bic || '';
  els.recipientName.value = payment.recipientName || '';
  quillGenerateBody.root.innerHTML = fixed.templateBodyHtml || '';
}

function loadTemplateIntoEditor(template) {
  if (!template) return;

  const fixed = template.fixedFields || {};
  const payment = template.paymentInfo || {};

  els.editTemplateId.value = template.id;
  els.editTemplateName.value = template.name || '';
  els.editDocumentType.value = template.documentType || 'VAT_PAYMENT';
  els.editIban.value = payment.iban || '';
  els.editBic.value = payment.bic || '';
  els.editRecipientName.value = payment.recipientName || '';
  els.editEntityName.value = fixed.entityName || '';
  els.editVatNumber.value = fixed.vatNumber || '';
  els.editAddress.value = fixed.address || '';
  els.editCurrency.value = fixed.currency || 'EUR';
  els.editNotes.value = fixed.notes || '';
  quillTemplateEditorBody.root.innerHTML = fixed.templateBodyHtml || '';
}

function renderTemplateList() {
  els.templateList.innerHTML = '';
  templates.forEach((t) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${t.name} - ${t.documentType}</span>
      <button class="delete-btn" data-id="${t.id}" type="button">Delete</button>
    `;
    els.templateList.appendChild(li);
  });

  els.templateList.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await api(`/api/templates/${btn.dataset.id}`, { method: 'DELETE' });
        setStatus('Template deleted.');
        await loadTemplates();
        await loadAutopilot();
      } catch (err) {
        setStatus(err.message, true);
      }
    });
  });
}

function renderSentFiles(rows) {
  els.sentFilesList.innerHTML = '';
  if (!rows.length) {
    els.sentFilesList.innerHTML = '<li><span>No files sent yet.</span></li>';
    return;
  }

  rows.forEach((row) => {
    const sentDate = new Date(row.sentAt).toLocaleString();
    const annex = row.annexFileName ? ` + ${row.annexFileName}` : '';
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${sentDate} | ${row.documentType} | ${row.recipient}</span>
      <span>${row.fileName}${annex}</span>
    `;
    els.sentFilesList.appendChild(li);
  });
}

function renderBillitQueue() {
  els.billitQueueList.innerHTML = '';
  if (!billitQueue.length) {
    els.billitQueueList.innerHTML = '<li><span>No files in queue.</span></li>';
    return;
  }

  billitQueue.forEach((item) => {
    const li = document.createElement('li');
    const statusClass = item.status || 'pending';
    const statusLabel = statusClass.charAt(0).toUpperCase() + statusClass.slice(1);
    const errorLine = item.error ? `<span class="queue-meta">${item.error}</span>` : '';

    li.innerHTML = `
      <div class="queue-item-main">
        <strong>${item.file.name}</strong>
        <span class="queue-meta">${formatBytes(item.file.size)} | subject: ${item.file.name}</span>
        ${errorLine}
      </div>
      <div class="queue-actions">
        <span class="status-chip ${statusClass}">${statusLabel}</span>
        <button class="mini-btn" data-action="send" data-id="${item.id}" type="button">Send</button>
        <button class="mini-btn delete-btn" data-action="remove" data-id="${item.id}" type="button">Remove</button>
      </div>
    `;

    els.billitQueueList.appendChild(li);
  });

  els.billitQueueList.querySelectorAll('button[data-action="send"]').forEach((btn) => {
    const item = billitQueue.find((entry) => entry.id === btn.dataset.id);
    if (!item) return;
    if (item.status === 'sending' || item.status === 'sent') {
      btn.disabled = true;
    }

    btn.addEventListener('click', async () => {
      await sendBillitItem(item.id);
    });
  });

  els.billitQueueList.querySelectorAll('button[data-action="remove"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      billitQueue = billitQueue.filter((item) => item.id !== btn.dataset.id);
      renderBillitQueue();
    });
  });
}

function upsertBillitStatus(id, status, error = '') {
  billitQueue = billitQueue.map((item) => {
    if (item.id !== id) return item;
    return {
      ...item,
      status,
      error
    };
  });
  renderBillitQueue();
}

function enqueueBillitFiles(fileList) {
  const incoming = Array.from(fileList || []);
  if (!incoming.length) return;

  const existingKeys = new Set(
    billitQueue.map((item) => `${item.file.name}:${item.file.size}:${item.file.lastModified}`)
  );

  let added = 0;
  incoming.forEach((file) => {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (existingKeys.has(key)) {
      return;
    }

    billitQueue.push({
      id: generateRequestId('billit_item'),
      requestId: generateRequestId('billit_send'),
      file,
      status: 'pending',
      error: ''
    });
    existingKeys.add(key);
    added += 1;
  });

  renderBillitQueue();
  if (added > 0) {
    setStatus(`Added ${added} file(s) to Billit queue.`);
  }
}

async function sendBillitItem(itemId, options = {}) {
  const { silent = false } = options;
  const item = billitQueue.find((entry) => entry.id === itemId);
  if (!item) return false;
  if (item.status === 'sending' || item.status === 'sent') return true;

  upsertBillitStatus(itemId, 'sending', '');

  try {
    const contentBase64 = await readFileAsBase64(item.file);

    await api('/api/send-billit-file', {
      method: 'POST',
      body: JSON.stringify({
        requestId: item.requestId,
        fileName: item.file.name,
        mimeType: item.file.type || 'application/octet-stream',
        contentBase64
      })
    });

    upsertBillitStatus(itemId, 'sent', '');
    if (!silent) {
      setStatus(`Sent ${item.file.name} to Billit inbox.`);
    }
    await loadSentFiles();
    return true;
  } catch (err) {
    if (err.body?.duplicateRecord) {
      upsertBillitStatus(itemId, 'sent', 'Already sent recently (duplicate blocked).');
      if (!silent) {
        setStatus(`Duplicate blocked for ${item.file.name}; file already sent.`, true);
      }
      await loadSentFiles();
      return true;
    }

    upsertBillitStatus(itemId, 'error', err.message);
    if (!silent) {
      setStatus(`Failed sending ${item.file.name}: ${err.message}`, true);
    }
    return false;
  }
}

async function sendAllPendingBillit() {
  const pending = billitQueue.filter((item) => item.status === 'pending' || item.status === 'error');
  if (!pending.length) {
    setStatus('No pending Billit files to send.');
    return;
  }

  let success = 0;
  for (const item of pending) {
    // Sequential by design: each file must be sent as an individual email action.
    const ok = await sendBillitItem(item.id, { silent: true });
    if (ok) success += 1;
  }

  setStatus(`Billit batch completed: ${success}/${pending.length} file(s) sent.`);
}

async function loadSentFiles() {
  const sent = await api('/api/sent-files?limit=100');
  renderSentFiles(sent);
}

async function loadTemplates() {
  templates = await api('/api/templates');
  fillTemplateSelect(els.templateId, templates, els.documentType.value);
  fillTemplateSelect(els.editTemplateId, templates);
  fillTemplateSelect(els.autoVatTemplate, templates, 'VAT_PAYMENT');
  fillTemplateSelect(els.autoReimbursementTemplate, templates, 'REIMBURSEMENT');
  fillTemplateSelect(els.autoTaxPrepayTemplate, templates, 'TAX_PREPAY');
  renderTemplateList();
}

async function loadAutopilot() {
  const settings = await api('/api/autopilot');
  els.autopilotEnabled.checked = Boolean(settings.enabled);
  els.runDayOfMonth.value = settings.runDayOfMonth;
  els.runHour.value = settings.runHour;
  els.runMinute.value = settings.runMinute;
  els.autopilotRecipient.value = settings.sendTo || els.settingsDefaultRecipient.value || '';
  els.autoVatTemplate.value = settings.templateIdByType?.VAT_PAYMENT || '';
  els.autoReimbursementTemplate.value = settings.templateIdByType?.REIMBURSEMENT || '';
  els.autoTaxPrepayTemplate.value = settings.templateIdByType?.TAX_PREPAY || '';
}

function renderSettings(settings) {
  const gmailUser = settings.gmailUser || '';
  const defaultRecipient = settings.defaultRecipient || '';
  const billitRecipient = settings.billitRecipient || '';

  els.settingsGmailUser.value = gmailUser;
  els.settingsDefaultRecipient.value = defaultRecipient;
  els.settingsBillitRecipient.value = billitRecipient;
  els.settingsChargingTimezone.value = settings.chargingTimezone || 'Europe/Brussels';
  els.settingsChargingOpeningDate.value = settings.chargingOpeningBalanceDate || '';
  els.settingsChargingOpeningKwh.value = Number(settings.chargingOpeningBalanceKwh || 0);
  els.settingsChargingOpeningNote.value = settings.chargingOpeningBalanceNote || '';
  els.settingsChargingReportTitle.value = settings.chargingReportTitle || 'Terugbetaling opladen wagen';
  els.settingsChargingReportRecipient.value = settings.chargingReportRecipient || '';
  els.settingsChargingReportIndication.value = settings.chargingReportIndication || '';
  els.settingsChargingAutoFinalize.checked = Boolean(settings.chargingAutoFinalize);
  els.chargingSessionEndpoint.value = `${window.location.origin}/api/v1/charging-sessions`;
  els.chargingDailyEndpoint.value = `${window.location.origin}/api/v1/daily-summary`;
  els.billitRecipientLabel.textContent = billitRecipient || '(set in Settings)';

  if (!els.sendTo.value && defaultRecipient) {
    els.sendTo.value = defaultRecipient;
  }

  if (!els.autopilotRecipient.value && defaultRecipient) {
    els.autopilotRecipient.value = defaultRecipient;
  }

  const keyStatus = settings.hasGmailAppPassword
    ? 'A Gmail app password is currently saved.'
    : 'No Gmail app password saved yet.';
  const tokenStatus = settings.hasChargingApiToken
    ? 'A Home Assistant bearer token is saved.'
    : 'No Home Assistant bearer token saved yet.';
  els.settingsStatusText.textContent = `${keyStatus} ${tokenStatus}`;
}

async function loadSettings() {
  const settings = await api('/api/settings');
  renderSettings(settings);
}

function renderChargingReportStatus(reports) {
  const finalReport = reports.find((report) => report.status === 'final');
  const provisionalReport = reports.find((report) => report.status === 'provisional');
  const report = finalReport || provisionalReport;
  els.chargingSendReportBtn.disabled = !finalReport
    || finalReport.needs_review
    || Boolean(finalReport.sent_at);

  if (!report) {
    els.chargingReportStatus.innerHTML = '<span>No PDF snapshot generated for this quarter.</span>';
    return;
  }

  const flags = [];
  flags.push(report.status === 'final' ? `Final revision ${report.revision}` : 'Provisional');
  if (report.sent_at) flags.push(`Sent ${new Date(report.sent_at).toLocaleString()}`);
  if (report.needs_review) flags.push(`Needs review: ${escapeHtml(report.review_reason)}`);
  els.chargingReportStatus.innerHTML = `
    <span>${flags.join(' | ')}</span>
    <a href="${escapeHtml(report.download_url)}" target="_blank" rel="noopener">Open PDF</a>
  `;
}

function renderChargingOverview(data) {
  chargingOverview = data;
  const snapshot = data.snapshot;
  els.chargingEnergyMetric.textContent = formatKwh(snapshot.totals.energy_kwh);
  els.chargingAmountMetric.textContent = formatEur(snapshot.totals.amount_eur);
  els.chargingSessionMetric.textContent = String(snapshot.session_count);
  els.chargingPeriodText.textContent = `${snapshot.period_start} to ${snapshot.period_end} (end exclusive) | attributed by session start`;
  els.cregRateLink.href = data.rate_source_url;

  if (snapshot.reconciliation) {
    const difference = snapshot.reconciliation.difference_kwh;
    els.chargingReconciliationMetric.textContent = `${difference >= 0 ? '+' : ''}${difference.toFixed(3)} kWh`;
    els.chargingReconciliationMetric.classList.toggle('metric-warning', Math.abs(difference) > 0.05);
  } else {
    els.chargingReconciliationMetric.textContent = 'Waiting';
    els.chargingReconciliationMetric.classList.remove('metric-warning');
  }

  if (data.last_received_at) {
    els.chargingHeartbeatText.textContent = `Last Home Assistant payload received ${new Date(data.last_received_at).toLocaleString()}.`;
  } else {
    els.chargingHeartbeatText.textContent = data.has_api_token
      ? 'API ready; waiting for the first Home Assistant payload.'
      : 'Configure the Home Assistant bearer token in Settings.';
  }

  const alerts = [];
  if (!data.has_api_token) alerts.push(['warning', 'Home Assistant API token is not configured.']);
  if (data.missing_heartbeats.length) {
    alerts.push(['danger', `Missing daily heartbeat: ${data.missing_heartbeats.join(', ')}`]);
  }
  if (snapshot.missing_rate_session_ids.length) {
    alerts.push(['warning', `${snapshot.missing_rate_session_ids.length} ledger row(s) have no CREG rate. The amount is incomplete.`]);
  }
  if (snapshot.meter_continuity_issues.length) {
    alerts.push(['danger', `${snapshot.meter_continuity_issues.length} totaliser continuity issue(s) detected.`]);
  }
  if (snapshot.excluded_pre_opening_balance_count) {
    alerts.push(['info', `${snapshot.excluded_pre_opening_balance_count} stored session(s) on or before the opening-balance date are excluded to prevent double counting.`]);
  }
  const finalReport = data.reports.find((report) => report.status === 'final');
  if (finalReport?.needs_review) {
    alerts.push(['danger', `Final report needs review: ${finalReport.review_reason}`]);
  }
  els.chargingAlerts.innerHTML = alerts
    .map(([type, message]) => `<div class="inline-alert ${type}">${escapeHtml(message)}</div>`)
    .join('');

  if (!snapshot.entries.length) {
    els.chargingSessionsBody.innerHTML = '<tr><td colspan="7" class="empty-cell">No charging entries in this quarter.</td></tr>';
  } else {
    els.chargingSessionsBody.innerHTML = snapshot.entries.map((entry) => {
      const sessionLabel = entry.kind === 'opening_balance'
        ? escapeHtml(entry.note || 'Opening balance')
        : `${escapeHtml(entry.start.slice(11, 16))} - ${escapeHtml(entry.end.slice(11, 16))}`;
      const rate = Number.isFinite(entry.rate_eur_per_kwh)
        ? `${Number(entry.rate_eur_per_kwh).toFixed(4)} EUR`
        : '<span class="missing-value">Missing</span>';
      return `
        <tr>
          <td>${escapeHtml(entry.date)}</td>
          <td title="${escapeHtml(entry.session_id)}">${sessionLabel}</td>
          <td>${formatKwh(entry.energy_kwh)}</td>
          <td>${formatKwh(entry.solar_kwh)}</td>
          <td>${formatKwh(entry.grid_kwh)}</td>
          <td>${rate}</td>
          <td>${formatEur(entry.amount_eur)}</td>
        </tr>
      `;
    }).join('');
  }

  renderChargingReportStatus(data.reports);
}

function renderChargingRates(payload) {
  if (!payload.rates.length) {
    els.chargingRateList.innerHTML = '<p class="hint">No rates saved yet.</p>';
    return;
  }
  els.chargingRateList.innerHTML = payload.rates.map((rate) => `
    <div class="rate-row">
      <div>
        <strong>${Number(rate.eur_per_kwh).toFixed(4)} EUR/kWh</strong>
        <span>${escapeHtml(rate.period_start)} to ${escapeHtml(rate.period_end)}</span>
        <small>${escapeHtml(rate.source_note || '')}</small>
      </div>
      <button type="button" class="delete-btn mini-btn" data-rate-start="${escapeHtml(rate.period_start)}">Delete</button>
    </div>
  `).join('');

  els.chargingRateList.querySelectorAll('[data-rate-start]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await api(`/api/charging/rates/${encodeURIComponent(button.dataset.rateStart)}`, { method: 'DELETE' });
        await loadCharging();
        setStatus('CREG rate deleted. Affected final reports were flagged for review.');
      } catch (err) {
        setStatus(err.message, true);
      }
    });
  });
}

async function loadCharging() {
  const year = Number(els.chargingYear.value);
  const quarter = Number(els.chargingQuarter.value);
  const [overview, rates] = await Promise.all([
    api(`/api/charging/overview?year=${year}&quarter=${quarter}`),
    api('/api/charging/rates')
  ]);
  renderChargingOverview(overview);
  renderChargingRates(rates);
}

async function generateChargingReport(finalize) {
  const button = finalize ? els.chargingFinalizeReportBtn : els.chargingPreviewReportBtn;
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = finalize ? 'Finalizing...' : 'Generating...';
  try {
    const report = await api('/api/charging/reports', {
      method: 'POST',
      body: JSON.stringify({
        year: Number(els.chargingYear.value),
        quarter: Number(els.chargingQuarter.value),
        finalize,
        force: true
      })
    });
    window.open(report.download_url, '_blank', 'noopener');
    await loadCharging();
    setStatus(finalize ? 'Quarterly charging report finalized.' : 'Charging report preview generated.');
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

els.menuBtn.addEventListener('click', () => {
  const isOpen = els.drawer.classList.contains('open');
  if (isOpen) closeDrawer();
  else openDrawer();
});

els.backdrop.addEventListener('click', closeDrawer);
els.navBtns.forEach((btn) => {
  btn.addEventListener('click', async () => {
    switchView(btn.dataset.view);
    if (btn.dataset.view === 'historyView') {
      await loadSentFiles();
    } else if (btn.dataset.view === 'settingsView') {
      await loadSettings();
    } else if (btn.dataset.view === 'chargingView') {
      await loadCharging();
    }
  });
});

els.chargingRefreshBtn.addEventListener('click', async () => {
  try {
    await loadCharging();
    setStatus('Charging ledger refreshed.');
  } catch (err) {
    setStatus(err.message, true);
  }
});

els.chargingYear.addEventListener('change', () => loadCharging().catch((err) => setStatus(err.message, true)));
els.chargingQuarter.addEventListener('change', () => loadCharging().catch((err) => setStatus(err.message, true)));
els.chargingPreviewReportBtn.addEventListener('click', () => generateChargingReport(false));
els.chargingFinalizeReportBtn.addEventListener('click', () => generateChargingReport(true));

els.chargingSendReportBtn.addEventListener('click', async () => {
  const finalReport = chargingOverview?.reports?.find((report) => report.status === 'final');
  if (!finalReport) {
    setStatus('Finalize the charging report before sending it.', true);
    return;
  }
  els.chargingSendReportBtn.disabled = true;
  try {
    await api(`/api/charging/reports/${encodeURIComponent(finalReport.id)}/send`, { method: 'POST' });
    await Promise.all([loadCharging(), loadSentFiles()]);
    setStatus('Final charging reimbursement report sent.');
  } catch (err) {
    setStatus(err.message, true);
    els.chargingSendReportBtn.disabled = false;
  }
});

els.chargingRateForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/charging/rates', {
      method: 'POST',
      body: JSON.stringify({
        period_start: els.chargingRateStart.value,
        period_end: els.chargingRateEnd.value,
        eur_per_kwh: Number(els.chargingRateValue.value),
        source_note: els.chargingRateNote.value
      })
    });
    els.chargingRateValue.value = '';
    els.chargingRateNote.value = '';
    await loadCharging();
    setStatus('CREG rate saved.');
  } catch (err) {
    setStatus(err.message, true);
  }
});

els.keepAsTemplate.addEventListener('change', () => {
  els.templateNameWrap.classList.toggle('hidden', !els.keepAsTemplate.checked);
});

els.documentType.addEventListener('change', () => {
  fillTemplateSelect(els.templateId, templates, els.documentType.value);
});

els.templateId.addEventListener('change', () => {
  if (!els.templateId.value) return;
  applyTemplateToGenerateForm(findTemplate(els.templateId.value));
});

els.editTemplateId.addEventListener('change', () => {
  if (!els.editTemplateId.value) return;
  loadTemplateIntoEditor(findTemplate(els.editTemplateId.value));
});

els.templateEditorForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const id = els.editTemplateId.value;
    if (!id) throw new Error('Select a template to edit.');

    await api(`/api/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: els.editTemplateName.value,
        documentType: els.editDocumentType.value,
        paymentInfo: {
          iban: els.editIban.value,
          bic: els.editBic.value,
          recipientName: els.editRecipientName.value
        },
        fixedFields: {
          entityName: els.editEntityName.value,
          vatNumber: els.editVatNumber.value,
          address: els.editAddress.value,
          currency: els.editCurrency.value,
          notes: els.editNotes.value,
          templateBodyHtml: quillTemplateEditorBody.root.innerHTML
        }
      })
    });

    setStatus('Template updated.');
    await loadTemplates();
    await loadAutopilot();
  } catch (err) {
    setStatus(err.message, true);
  }
});

els.settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const gmailUser = els.settingsGmailUser.value.trim();
  const defaultRecipient = els.settingsDefaultRecipient.value.trim();
  const billitRecipient = els.settingsBillitRecipient.value.trim();
  const gmailAppPassword = els.settingsGmailAppPassword.value.trim();
  const chargingApiToken = els.settingsChargingApiToken.value.trim();

  els.saveSettingsBtn.disabled = true;
  els.saveSettingsBtn.textContent = 'Saving...';
  try {
    const payload = {
      gmailUser,
      defaultRecipient,
      billitRecipient,
      chargingTimezone: els.settingsChargingTimezone.value.trim(),
      chargingOpeningBalanceDate: els.settingsChargingOpeningDate.value,
      chargingOpeningBalanceKwh: Number(els.settingsChargingOpeningKwh.value || 0),
      chargingOpeningBalanceNote: els.settingsChargingOpeningNote.value.trim(),
      chargingReportTitle: els.settingsChargingReportTitle.value.trim(),
      chargingReportRecipient: els.settingsChargingReportRecipient.value.trim(),
      chargingReportIndication: els.settingsChargingReportIndication.value.trim(),
      chargingAutoFinalize: els.settingsChargingAutoFinalize.checked
    };

    if (gmailAppPassword) {
      payload.gmailAppPassword = gmailAppPassword;
    }
    if (chargingApiToken) {
      payload.chargingApiToken = chargingApiToken;
    }

    await api('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    els.settingsGmailAppPassword.value = '';
    els.settingsChargingApiToken.value = '';
    await loadSettings();
    await loadCharging();
    setStatus('Settings saved.');
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    els.saveSettingsBtn.disabled = false;
    els.saveSettingsBtn.textContent = 'Save Settings';
  }
});

els.generateChargingTokenBtn.addEventListener('click', () => {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  els.settingsChargingApiToken.value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  setStatus('Secure token generated. Save Settings, then update Home Assistant with this token.');
});

els.copyChargingTokenBtn.addEventListener('click', async () => {
  const token = els.settingsChargingApiToken.value;
  if (!token) {
    setStatus('Generate or enter a new token first. Saved tokens are not displayed again.', true);
    return;
  }
  try {
    await navigator.clipboard.writeText(token);
    setStatus('Charging API token copied.');
  } catch (_err) {
    els.settingsChargingApiToken.select();
    document.execCommand('copy');
    setStatus('Charging API token copied.');
  }
});

els.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (sendInProgress) {
    setStatus('A send is already in progress.', true);
    return;
  }

  sendInProgress = true;
  els.sendBtn.disabled = true;
  els.sendBtn.textContent = 'Sending...';

  try {
    let annexCsv = null;
    const file = els.annexCsv.files?.[0];
    if (file) {
      annexCsv = {
        name: file.name,
        content: await readFileText(file)
      };
    }

    const payload = {
      requestId: generateRequestId(),
      documentType: els.documentType.value,
      templateId: els.templateId.value || undefined,
      sendTo: els.sendTo.value,
      periodLabel: els.periodLabel.value,
      keepAsTemplate: els.keepAsTemplate.checked,
      templateName: els.templateName.value,
      annexCsv,
      details: {
        entityName: els.entityName.value,
        vatNumber: els.vatNumber.value,
        address: els.address.value,
        amount: els.amount.value,
        currency: els.currency.value,
        reference: els.reference.value,
        notes: els.notes.value,
        templateBodyHtml: quillGenerateBody.root.innerHTML
      },
      paymentInfo: {
        iban: els.iban.value,
        bic: els.bic.value,
        recipientName: els.recipientName.value
      },
      fixedFields: {
        entityName: els.entityName.value,
        vatNumber: els.vatNumber.value,
        address: els.address.value,
        currency: els.currency.value,
        notes: els.notes.value,
        templateBodyHtml: quillGenerateBody.root.innerHTML
      }
    };

    const result = await api('/api/generate-and-send', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    setStatus(`Sent: ${result.fileName} to ${result.recipient}`);
    await loadSentFiles();

    if (result.templateSaved) {
      await loadTemplates();
      await loadAutopilot();
    }
  } catch (err) {
    if (err.body?.duplicateRecord) {
      setStatus(`Duplicate blocked. Already sent: ${err.body.duplicateRecord.fileName}`, true);
    } else {
      setStatus(err.message, true);
    }
  } finally {
    sendInProgress = false;
    els.sendBtn.disabled = false;
    els.sendBtn.textContent = 'Generate PDF & Send';
  }
});

els.autopilotForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/autopilot', {
      method: 'PUT',
      body: JSON.stringify({
        enabled: els.autopilotEnabled.checked,
        runDayOfMonth: Number(els.runDayOfMonth.value),
        runHour: Number(els.runHour.value),
        runMinute: Number(els.runMinute.value),
        sendTo: els.autopilotRecipient.value,
        templateIdByType: {
          VAT_PAYMENT: els.autoVatTemplate.value,
          REIMBURSEMENT: els.autoReimbursementTemplate.value,
          TAX_PREPAY: els.autoTaxPrepayTemplate.value
        }
      })
    });

    setStatus('Autopilot settings saved.');
  } catch (err) {
    setStatus(err.message, true);
  }
});

els.runNowBtn.addEventListener('click', async () => {
  try {
    const result = await api('/api/autopilot/run-now', { method: 'POST' });
    if (result.skipped) {
      setStatus(`Autopilot skipped: ${result.reason}`);
      return;
    }
    setStatus(`Autopilot sent ${result.sent.length} document(s).`);
    await loadSentFiles();
  } catch (err) {
    setStatus(err.message, true);
  }
});

els.refreshHistoryBtn.addEventListener('click', async () => {
  try {
    await loadSentFiles();
    setStatus('Sent files refreshed.');
  } catch (err) {
    setStatus(err.message, true);
  }
});

els.billitDropzone.addEventListener('click', () => {
  els.billitFileInput.click();
});

els.billitDropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    els.billitFileInput.click();
  }
});

els.billitDropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  els.billitDropzone.classList.add('dragover');
});

els.billitDropzone.addEventListener('dragleave', () => {
  els.billitDropzone.classList.remove('dragover');
});

els.billitDropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  els.billitDropzone.classList.remove('dragover');
  enqueueBillitFiles(e.dataTransfer?.files || []);
});

els.billitFileInput.addEventListener('change', () => {
  enqueueBillitFiles(els.billitFileInput.files || []);
  els.billitFileInput.value = '';
});

els.billitSendAllBtn.addEventListener('click', async () => {
  await sendAllPendingBillit();
});

els.billitClearBtn.addEventListener('click', () => {
  billitQueue = [];
  renderBillitQueue();
  setStatus('Billit queue cleared.');
});

(async function init() {
  try {
    const now = new Date();
    const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
    const quarterStartMonth = (currentQuarter - 1) * 3;
    const quarterStart = new Date(Date.UTC(now.getFullYear(), quarterStartMonth, 1));
    const quarterEnd = new Date(Date.UTC(now.getFullYear(), quarterStartMonth + 3, 1));
    els.chargingYear.value = now.getFullYear();
    els.chargingQuarter.value = currentQuarter;
    els.chargingRateStart.value = quarterStart.toISOString().slice(0, 10);
    els.chargingRateEnd.value = quarterEnd.toISOString().slice(0, 10);
    els.periodLabel.value = getCurrentMonthYearLabel();
    await loadTemplates();
    await loadSettings();
    await loadAutopilot();
    await loadCharging();
    await loadSentFiles();
    renderBillitQueue();
    setStatus('Ready.');
  } catch (err) {
    setStatus(err.message, true);
  }
})();
