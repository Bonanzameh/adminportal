const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const config = require('./config');

const COLORS = {
  ink: '#16302b',
  muted: '#61716c',
  accent: '#0f766e',
  accentPale: '#e5f3ef',
  line: '#d8e4df',
  warning: '#9a5b13',
  warningPale: '#fff4df',
  white: '#ffffff'
};

function ensureOutputDir() {
  fs.mkdirSync(config.outputDir, { recursive: true });
}

function formatKwh(value) {
  return Number.isFinite(value) ? Number(value).toFixed(3) : '-';
}

function formatRate(value) {
  return Number.isFinite(value) ? Number(value).toFixed(4) : 'MISSING';
}

function formatMoney(value) {
  return Number.isFinite(value) ? Number(value).toFixed(2) : '-';
}

function quarterLabel(snapshot) {
  return snapshot.period_key.replace('-', ' ');
}

function drawPageHeader(doc, report) {
  const margin = doc.page.margins.left;
  const width = doc.page.width - margin - doc.page.margins.right;
  doc.fillColor(COLORS.accent).rect(0, 0, doc.page.width, 12).fill();
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(21)
    .text(report.title || 'EV charging reimbursement', margin, 38, { width: width - 120 });
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9)
    .text(quarterLabel(report.snapshot), margin, 68);

  const badgeText = report.status === 'final' ? 'FINAL' : 'PROVISIONAL';
  const badgeColor = report.status === 'final' ? COLORS.accent : COLORS.warning;
  doc.roundedRect(doc.page.width - margin - 90, 38, 90, 26, 6).fill(badgeColor);
  doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(9)
    .text(badgeText, doc.page.width - margin - 90, 47, { width: 90, align: 'center' });
  doc.x = margin;
  doc.y = 96;
}

function drawSummaryCards(doc, snapshot) {
  const x = doc.page.margins.left;
  const width = doc.page.width - x - doc.page.margins.right;
  const gap = 8;
  const cardWidth = (width - gap * 2) / 3;
  const startY = doc.y;
  const cards = [
    ['Gross energy', `${formatKwh(snapshot.totals.energy_kwh)} kWh`],
    ['Sessions', String(snapshot.session_count)],
    ['Amount due', `${formatMoney(snapshot.totals.amount_eur)} EUR`]
  ];

  cards.forEach(([label, value], index) => {
    const cardX = x + index * (cardWidth + gap);
    doc.roundedRect(cardX, startY, cardWidth, 58, 7).fill(COLORS.accentPale);
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8)
      .text(label.toUpperCase(), cardX + 12, startY + 11, { width: cardWidth - 24 });
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(15)
      .text(value, cardX + 12, startY + 29, { width: cardWidth - 24 });
  });
  doc.x = x;
  doc.y = startY + 76;
}

function drawSectionTitle(doc, title) {
  const x = doc.page.margins.left;
  const width = doc.page.width - x - doc.page.margins.right;
  doc.x = x;
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(11)
    .text(title, x, doc.y, { width });
  doc.moveDown(0.45);
}

function ensureSpace(doc, height, onNewPage) {
  if (doc.y + height <= doc.page.height - doc.page.margins.bottom - 25) return;
  doc.addPage();
  onNewPage();
}

function drawEntryTableHeader(doc, columns) {
  const y = doc.y;
  let x = doc.page.margins.left;
  const height = 24;
  doc.rect(x, y, columns.reduce((sum, column) => sum + column.width, 0), height)
    .fill(COLORS.ink);
  columns.forEach((column) => {
    doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(7.5)
      .text(column.label, x + 4, y + 8, { width: column.width - 8, align: column.align || 'left' });
    x += column.width;
  });
  doc.y = y + height;
}

function drawEntryTable(doc, report) {
  const columns = [
    { key: 'date', label: 'DATE', width: 60 },
    { key: 'time', label: 'START - END', width: 112 },
    { key: 'energy', label: 'KWH', width: 52, align: 'right' },
    { key: 'solar', label: 'SOLAR', width: 52, align: 'right' },
    { key: 'grid', label: 'GRID', width: 52, align: 'right' },
    { key: 'rate', label: 'EUR/KWH', width: 65, align: 'right' },
    { key: 'amount', label: 'EUR', width: 62, align: 'right' }
  ];
  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);

  const newTablePage = () => {
    drawPageHeader(doc, report);
    drawSectionTitle(doc, 'Charging detail - continued');
    drawEntryTableHeader(doc, columns);
  };

  drawEntryTableHeader(doc, columns);
  report.snapshot.entries.forEach((entry, index) => {
    ensureSpace(doc, 31, newTablePage);
    const y = doc.y;
    const rowHeight = 29;
    if (index % 2 === 1) {
      doc.rect(doc.page.margins.left, y, totalWidth, rowHeight).fill('#f7faf9');
    }
    const time = entry.kind === 'opening_balance'
      ? 'Opening balance'
      : `${entry.start.slice(11, 16)} - ${entry.end.slice(11, 16)}`;
    const values = {
      date: entry.date,
      time,
      energy: formatKwh(entry.energy_kwh),
      solar: formatKwh(entry.solar_kwh),
      grid: formatKwh(entry.grid_kwh),
      rate: formatRate(entry.rate_eur_per_kwh),
      amount: formatMoney(entry.amount_eur)
    };
    let x = doc.page.margins.left;
    columns.forEach((column) => {
      const isMissing = column.key === 'rate' && !Number.isFinite(entry.rate_eur_per_kwh);
      doc.fillColor(isMissing ? COLORS.warning : COLORS.ink)
        .font(isMissing ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(7.8)
        .text(values[column.key], x + 4, y + 10, {
          width: column.width - 8,
          align: column.align || 'left',
          lineBreak: false
        });
      x += column.width;
    });
    doc.strokeColor(COLORS.line).moveTo(doc.page.margins.left, y + rowHeight)
      .lineTo(doc.page.margins.left + totalWidth, y + rowHeight).stroke();
    doc.y = y + rowHeight;
  });
  doc.moveDown(1);
}

function drawFooter(doc, report) {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    const y = doc.page.height - doc.page.margins.bottom - 13;
    doc.strokeColor(COLORS.line).moveTo(doc.page.margins.left, y - 7)
      .lineTo(doc.page.width - doc.page.margins.right, y - 7).stroke();
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.5)
      .text(
        `Generated ${new Date(report.generated_at).toLocaleString('en-GB')} | Page ${index + 1} of ${range.count}`,
        doc.page.margins.left,
        y,
        { width: doc.page.width - doc.page.margins.left - doc.page.margins.right, align: 'right', lineBreak: false }
      );
  }
}

function buildQuarterlyChargingPdf(report) {
  ensureOutputDir();
  const suffix = report.status === 'final' ? 'final' : 'provisional';
  const fileName = `ev_charging_${report.snapshot.period_key.replace('-', '_')}_${suffix}.pdf`;
  const filePath = path.join(config.outputDir, fileName);
  const doc = new PDFDocument({ size: 'A4', margin: 46, bufferPages: true, info: {
    Title: `${report.title} - ${report.snapshot.period_key}`,
    Subject: 'Quarterly home EV charging reimbursement',
    Creator: 'Adminportal'
  } });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  drawPageHeader(doc, report);
  drawSummaryCards(doc, report.snapshot);

  if (report.indication) {
    drawSectionTitle(doc, 'Reimbursement indication');
    doc.fillColor(COLORS.ink).font('Helvetica').fontSize(10)
      .text(report.indication, { width: 500 });
    doc.moveDown(1);
  }

  drawSectionTitle(doc, 'Quarter summary');
  doc.fillColor(COLORS.ink).font('Helvetica').fontSize(9.5)
    .text(`Period: ${report.snapshot.period_start} up to ${report.snapshot.period_end} (end exclusive)`)
    .text(`Energy at the wall: ${formatKwh(report.snapshot.totals.energy_kwh)} kWh`)
    .text(`Recorded solar contribution: ${formatKwh(report.snapshot.totals.solar_kwh)} kWh`)
    .text(`Recorded grid contribution: ${formatKwh(report.snapshot.totals.grid_kwh)} kWh`)
    .text(`Total amount to be paid: ${formatMoney(report.snapshot.totals.amount_eur)} EUR`);
  if (report.snapshot.opening_balance_cutoff_date) {
    doc.text(`Opening balance cutoff: sessions starting on or before ${report.snapshot.opening_balance_cutoff_date} are represented by the opening balance.`);
  }
  doc.moveDown(1);

  if (report.snapshot.missing_rate_session_ids.length) {
    const warningY = doc.y;
    doc.roundedRect(doc.page.margins.left, warningY, 455, 40, 6).fill(COLORS.warningPale);
    doc.fillColor(COLORS.warning).font('Helvetica-Bold').fontSize(9)
      .text('Rate coverage incomplete', doc.page.margins.left + 10, warningY + 9, { width: 435 });
    doc.font('Helvetica').fontSize(8)
      .text('The amount is provisional until every row has a CREG rate.', doc.page.margins.left + 10, warningY + 23, { width: 435 });
    doc.y = warningY + 53;
  }

  drawSectionTitle(doc, 'Charging detail');
  drawEntryTable(doc, report);

  ensureSpace(doc, 125, () => drawPageHeader(doc, report));
  drawSectionTitle(doc, 'Rate source and accounting method');
  doc.fillColor(COLORS.ink).font('Helvetica').fontSize(9)
    .text('Each charging session is attributed to the quarter and CREG rate in force at its local start timestamp. Energy is the gross energy measured at the wall, including charging losses.');
  doc.moveDown(0.5);
  doc.fillColor(COLORS.accent).font('Helvetica').fontSize(8.5)
    .text(report.snapshot.rate_source_url, { link: report.snapshot.rate_source_url, underline: true });
  const usedRates = [...new Map(
    report.snapshot.entries
      .filter((entry) => Number.isFinite(entry.rate_eur_per_kwh))
      .map((entry) => [entry.rate_period_start, entry])
  ).values()];
  if (usedRates.length) {
    doc.moveDown(0.6);
    usedRates.forEach((entry) => {
      const note = entry.rate_source_note ? ` - ${entry.rate_source_note}` : '';
      doc.fillColor(COLORS.muted).fontSize(8)
        .text(`Rate ${entry.rate_period_start} to ${entry.rate_period_end}: ${formatRate(entry.rate_eur_per_kwh)} EUR/kWh${note}`);
    });
  }

  if (report.snapshot.reconciliation) {
    doc.moveDown(1);
    drawSectionTitle(doc, 'Home Assistant reconciliation');
    const reconciliation = report.snapshot.reconciliation;
    doc.fillColor(COLORS.ink).font('Helvetica').fontSize(9)
      .text(`Heartbeat ${reconciliation.date}: ledger ${formatKwh(reconciliation.ledger_kwh)} kWh; HA quarter meter ${formatKwh(reconciliation.ha_quarter_kwh)} kWh; difference ${formatKwh(reconciliation.difference_kwh)} kWh.`);
  }

  drawFooter(doc, report);
  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve({ fileName, filePath }));
    stream.on('error', reject);
  });
}

module.exports = {
  buildQuarterlyChargingPdf
};
