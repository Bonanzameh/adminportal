const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');

function ensureOutputDir() {
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
  }
}

function docTypeTitle(docType) {
  switch (docType) {
    case 'VAT_PAYMENT':
      return 'VAT Payment';
    case 'REIMBURSEMENT':
      return 'Reimbursement';
    case 'TAX_PREPAY':
      return 'Tax Prepay';
    default:
      return 'Administrative Document';
  }
}

function htmlToPdfText(html) {
  if (!html) return '';

  return html
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*p\s*>/gi, '\n\n')
    .replace(/<\s*\/\s*div\s*>/gi, '\n')
    .replace(/<\s*li\s*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsv(content) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  return lines.map(parseCsvLine);
}

function drawTable(doc, rows, startY = 120) {
  if (rows.length === 0) {
    doc.fontSize(11).text('No rows found in annex CSV.', 50, startY);
    return;
  }

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colCount = Math.max(...rows.map((r) => r.length));
  const colWidth = pageWidth / Math.max(colCount, 1);
  const rowHeight = 20;
  let y = startY;

  rows.forEach((row, rowIndex) => {
    if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = 60;
    }

    for (let c = 0; c < colCount; c += 1) {
      const x = doc.page.margins.left + c * colWidth;
      const cellText = row[c] || '';

      doc.rect(x, y, colWidth, rowHeight).stroke('#9ca3af');
      doc
        .fontSize(rowIndex === 0 ? 10 : 9)
        .fillColor(rowIndex === 0 ? '#111827' : '#1f2937')
        .text(cellText, x + 4, y + 5, {
          width: colWidth - 8,
          height: rowHeight - 8,
          ellipsis: true
        });
    }

    y += rowHeight;
  });
}

function buildPdf({ documentType, details, paymentInfo, fixedFields, periodLabel }) {
  ensureOutputDir();
  const fileName = `${documentType.toLowerCase()}_${periodLabel.replace(/\s+/g, '_')}_${uuidv4()}.pdf`;
  const filePath = path.join(config.outputDir, fileName);

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const stream = fs.createWriteStream(filePath);

  doc.pipe(stream);

  doc.fontSize(20).text(docTypeTitle(documentType), { align: 'left' });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#555').text(`Generated: ${new Date().toLocaleString()}`);
  doc.text(`Period: ${periodLabel}`);

  doc.moveDown();
  doc.fillColor('#000').fontSize(13).text('Entity Information', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11).text(`Company/Name: ${details.entityName || ''}`);
  doc.text(`VAT Number: ${details.vatNumber || ''}`);
  doc.text(`Address: ${details.address || ''}`);

  doc.moveDown();
  doc.fontSize(13).text('Payment Information', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11).text(`Amount: ${details.amount || ''}`);
  doc.text(`Currency: ${details.currency || 'EUR'}`);
  doc.text(`IBAN: ${paymentInfo.iban || ''}`);
  doc.text(`BIC/SWIFT: ${paymentInfo.bic || ''}`);
  doc.text(`Payment Reference: ${details.reference || paymentInfo.defaultReference || ''}`);
  doc.text(`Recipient: ${paymentInfo.recipientName || ''}`);

  const richBody = details.templateBodyHtml || fixedFields.templateBodyHtml;
  const richBodyAsText = htmlToPdfText(richBody);

  doc.moveDown();
  doc.fontSize(13).text('Document Notes', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11).text(
    richBodyAsText || details.notes || fixedFields.notes || 'No additional notes provided.'
  );

  if (documentType === 'REIMBURSEMENT') {
    doc.moveDown();
    doc.fontSize(13).text('Reimbursement Details', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11).text(`Expense Category: ${details.expenseCategory || ''}`);
    doc.text(`Expense Date: ${details.expenseDate || ''}`);
  }

  if (documentType === 'VAT_PAYMENT') {
    doc.moveDown();
    doc.fontSize(13).text('VAT Details', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11).text(`Taxable Base: ${details.taxableBase || ''}`);
    doc.text(`VAT Amount: ${details.vatAmount || details.amount || ''}`);
  }

  if (documentType === 'TAX_PREPAY') {
    doc.moveDown();
    doc.fontSize(13).text('Tax Prepay Details', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11).text(`Prepay Period: ${details.prepayPeriod || periodLabel}`);
    doc.text(`Tax Basis: ${details.taxBasis || ''}`);
    doc.text(`Prepay Amount: ${details.prepayAmount || details.amount || ''}`);
  }

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve({ filePath, fileName }));
    stream.on('error', reject);
  });
}

function buildCsvAnnexPdf({ csvName, csvContent, periodLabel }) {
  ensureOutputDir();
  const sanitizedBase = (csvName || 'annex').replace(/[^a-zA-Z0-9_.-]/g, '_');
  const fileName = `annex_${periodLabel.replace(/\s+/g, '_')}_${sanitizedBase.replace(/\.csv$/i, '')}_${uuidv4()}.pdf`;
  const filePath = path.join(config.outputDir, fileName);

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const stream = fs.createWriteStream(filePath);

  doc.pipe(stream);

  doc.fontSize(18).text('Annex - CSV Export', { align: 'left' });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#555').text(`Generated: ${new Date().toLocaleString()}`);
  doc.text(`Period: ${periodLabel}`);
  doc.text(`Source CSV: ${csvName || 'uploaded.csv'}`);

  doc.moveDown();
  doc.fillColor('#000').fontSize(12).text('Rows', { underline: true });

  const rows = parseCsv(csvContent || '');
  drawTable(doc, rows, 150);

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve({ filePath, fileName }));
    stream.on('error', reject);
  });
}

module.exports = {
  buildPdf,
  buildCsvAnnexPdf
};
