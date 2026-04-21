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
  billitQueueList: document.getElementById('billitQueueList')
};

let templates = [];
let sendInProgress = false;
let billitQueue = [];

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
  els.settingsStatusText.textContent = keyStatus;
}

async function loadSettings() {
  const settings = await api('/api/settings');
  renderSettings(settings);
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
    }
  });
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

  if (!gmailUser || !defaultRecipient || !billitRecipient) {
    setStatus('Please fill Gmail account and both recipient addresses.', true);
    return;
  }

  els.saveSettingsBtn.disabled = true;
  els.saveSettingsBtn.textContent = 'Saving...';
  try {
    const payload = {
      gmailUser,
      defaultRecipient,
      billitRecipient
    };

    if (gmailAppPassword) {
      payload.gmailAppPassword = gmailAppPassword;
    }

    await api('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    els.settingsGmailAppPassword.value = '';
    await loadSettings();
    setStatus('Settings saved.');
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    els.saveSettingsBtn.disabled = false;
    els.saveSettingsBtn.textContent = 'Save Settings';
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
    els.periodLabel.value = getCurrentMonthYearLabel();
    await loadTemplates();
    await loadAutopilot();
    await loadSettings();
    await loadSentFiles();
    renderBillitQueue();
    setStatus('Ready.');
  } catch (err) {
    setStatus(err.message, true);
  }
})();
