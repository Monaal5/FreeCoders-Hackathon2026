// Quote PDF with PDFKit. Built-in Helvetica has no Rupee glyph, so amounts use "Rs."
const PDFDocument = require('pdfkit');

const COMPANY = {
  name: 'SunPower Solar Solutions',
  tagline: 'Rooftop Solar | On-Grid | Off-Grid',
  address: 'Demo Office, India',
  contact: 'hello@sunpower.local',
};

const BRAND = '#E8590C';
const MUTED = '#666666';
const LINE = '#DDDDDD';

const inr = (n) =>
  `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const qty = (n) => (Number.isInteger(Number(n)) ? String(Number(n)) : Number(n).toFixed(2));

/** Streams the quote PDF into `stream` (e.g. the Express response). */
function renderQuotePdf(quote, stream) {
  const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Quotation ${quote.quote_number}` } });
  doc.pipe(stream);

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;

  // ---- Header ----
  doc.rect(0, 0, doc.page.width, 8).fill(BRAND);
  doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(20).text(COMPANY.name, left, 30);
  doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(COMPANY.tagline).text(`${COMPANY.address} | ${COMPANY.contact}`);

  doc.fillColor('#000').font('Helvetica-Bold').fontSize(16).text('QUOTATION', left, 30, { width, align: 'right' });
  doc.font('Helvetica').fontSize(9)
    .text(`No: ${quote.quote_number}`, { width, align: 'right' })
    .text(`Date: ${fmtDate(quote.created_at)}`, { width, align: 'right' })
    .text(`Valid until: ${fmtDate(quote.valid_until)}`, { width, align: 'right' });

  // ---- Customer + system ----
  let y = 105;
  doc.moveTo(left, y).lineTo(right, y).strokeColor(LINE).stroke();
  y += 10;
  const colW = width / 2 - 10;
  doc.fillColor(MUTED).fontSize(8).text('BILL TO', left, y);
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(11).text(quote.customer_name, left, y + 12, { width: colW });
  doc.font('Helvetica').fontSize(9)
    .text([quote.customer_address, [quote.customer_city, quote.customer_pincode].filter(Boolean).join(' - ')]
      .filter(Boolean).join(', ') || '-', { width: colW })
    .text(`Phone: ${quote.customer_phone}${quote.customer_email ? `  |  ${quote.customer_email}` : ''}`, { width: colW })
    .text(`Lead: ${quote.lead_code}`, { width: colW });

  const sx = left + width / 2 + 10;
  doc.fillColor(MUTED).fontSize(8).text('PROPOSED SYSTEM', sx, y);
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(11)
    .text(quote.template_name || `${quote.capacity_kw} kW ${quote.system_type}`, sx, y + 12, { width: colW });
  doc.font('Helvetica').fontSize(9)
    .text(`Capacity: ${quote.capacity_kw} kWp  |  Type: ${quote.system_type === 'ON_GRID' ? 'On-Grid' : 'Off-Grid'}`, sx, doc.y, { width: colW })
    .text(`Est. generation: ~${Math.round(quote.capacity_kw * 120)} units/month`, sx, doc.y, { width: colW });

  // ---- BOM table ----
  y = Math.max(doc.y, 180) + 15;
  const cols = [
    { key: '#', w: 22, align: 'left' },
    { key: 'Item', w: 205, align: 'left' },
    { key: 'Qty', w: 45, align: 'right' },
    { key: 'Unit', w: 35, align: 'left' },
    { key: 'Rate', w: 70, align: 'right' },
    { key: 'GST', w: 38, align: 'right' },
    { key: 'Amount', w: width - 415, align: 'right' },
  ];
  const drawRow = (cells, rowY, { bold = false, fill } = {}) => {
    const h = 18;
    if (fill) doc.rect(left, rowY, width, h).fill(fill);
    doc.fillColor('#000').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5);
    let x = left;
    cells.forEach((c, i) => {
      doc.text(String(c), x + 4, rowY + 5, { width: cols[i].w - 8, align: cols[i].align, lineBreak: false, ellipsis: true });
      x += cols[i].w;
    });
    return rowY + h;
  };

  y = drawRow(cols.map((c) => c.key), y, { bold: true, fill: '#FFF1E6' });
  quote.items.forEach((item, idx) => {
    if (y > doc.page.height - 200) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    y = drawRow(
      [idx + 1, item.name, qty(item.quantity), item.unit, inr(item.unit_price).replace('Rs. ', ''), `${qty(item.gst_rate)}%`,
        inr(item.line_total).replace('Rs. ', '')],
      y,
      { fill: idx % 2 ? '#FAFAFA' : undefined },
    );
  });
  doc.moveTo(left, y).lineTo(right, y).strokeColor(LINE).stroke();

  // ---- Totals ----
  y += 10;
  const tx = right - 230;
  const totalRow = (label, value, { bold = false, color = '#000' } = {}) => {
    doc.fillColor(color).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9.5);
    doc.text(label, tx, y, { width: 120 });
    doc.text(value, tx + 120, y, { width: 110, align: 'right' });
    y += bold ? 20 : 15;
  };
  totalRow('Subtotal', inr(quote.subtotal));
  if (Number(quote.discount_pct) > 0) totalRow(`Discount (${qty(quote.discount_pct)}%)`, `- ${inr(quote.discount_amount)}`);
  totalRow('Taxable value', inr(quote.taxable_amount));
  totalRow('GST', inr(quote.gst_amount));
  doc.moveTo(tx, y).lineTo(right, y).strokeColor(BRAND).stroke();
  y += 6;
  totalRow('Grand Total', inr(quote.total), { bold: true, color: BRAND });

  // ---- Notes & terms ----
  y += 10;
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(9).text('Terms & Conditions', left, y);
  doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).list(
    [
      'Payment: 50% advance, 40% on material delivery, 10% after commissioning.',
      'Installation within 15 working days of advance payment, subject to site readiness.',
      'Panel performance warranty 25 years; inverter warranty as per manufacturer (5+ years).',
      'Net-metering / DISCOM approval charges, if any, are payable at actuals.',
      'Prices are valid until the date above and include GST at applicable rates.',
    ],
    left,
    doc.y + 4,
    { width, bulletRadius: 1.5 },
  );
  if (quote.notes) {
    doc.moveDown(0.5).fillColor('#000').font('Helvetica-Bold').text('Notes').font('Helvetica').fillColor(MUTED).text(quote.notes, { width });
  }

  doc.moveDown(2).fillColor('#000').font('Helvetica').fontSize(9)
    .text(`Prepared by: ${quote.created_by_name || COMPANY.name}${quote.created_by_phone ? ` (${quote.created_by_phone})` : ''}`);
  doc.fillColor(MUTED).fontSize(7.5).text('This is a computer-generated quotation.', { align: 'center' });

  doc.end();
}

module.exports = { renderQuotePdf };
