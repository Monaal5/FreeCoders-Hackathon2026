// Phase 3 – installation completion certificate (PDFKit).
// Built from the job detail; the integrity line re-computes the signature hash at render time,
// so a certificate printed after someone edited the installed serials shows "ALTERED".
const fs = require('node:fs');
const PDFDocument = require('pdfkit');
const { diskPathFor } = require('../middleware/upload');

const BRAND = '#E8590C';
const MUTED = '#666666';
const LINE = '#DDDDDD';
const OK = '#2E7D4F';
const BAD = '#C62828';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');
const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
      })
    : '-';
const PACKAGE_LABEL = { PANEL_SET: 'Solar Panel Set', ON_GRID: 'On-Grid System', OFF_GRID: 'Off-Grid System (with battery)' };

/** PDFKit embeds JPEG and PNG only; other formats are skipped. */
function embeddable(publicPath) {
  const file = diskPathFor(publicPath);
  return file && /\.(jpe?g|png)$/i.test(file) && fs.existsSync(file) ? file : null;
}

function renderCertificate(job, stream) {
  const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Installation certificate ${job.order_number}` } });
  doc.pipe(stream);
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;
  const ensure = (need) => {
    if (doc.y + need > doc.page.height - doc.page.margins.bottom) doc.addPage();
  };
  const heading = (text) => {
    ensure(40);
    doc.moveDown(0.6).fillColor(BRAND).font('Helvetica-Bold').fontSize(10).text(text.toUpperCase(), left, doc.y);
    doc.moveTo(left, doc.y + 2).lineTo(right, doc.y + 2).strokeColor(LINE).stroke();
    doc.moveDown(0.4).fillColor('#000').font('Helvetica').fontSize(9);
  };

  // ---- header ----
  doc.rect(0, 0, doc.page.width, 8).fill(BRAND);
  const half = width / 2 - 10;
  doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(18).text('SunPower Solar Solutions', left, 28, { width: half });
  doc.fillColor(MUTED).font('Helvetica').fontSize(9).text('Rooftop Solar | On-Grid | Off-Grid', { width: half });
  const hx = left + width / 2 + 10;
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(12).text('INSTALLATION COMPLETION CERTIFICATE', hx, 30, { width: half, align: 'right' });
  doc.font('Helvetica').fontSize(9)
    .text(`Certificate: SPC-${job.order_number}-J${job.id}`, hx, doc.y + 2, { width: half, align: 'right' })
    .text(`Order: ${job.order_number}  |  Quote: ${job.quote_number}`, hx, doc.y, { width: half, align: 'right' })
    .text(`Issued: ${fmtDate(job.completed_at)}`, hx, doc.y, { width: half, align: 'right' });

  // ---- customer + system ----
  let y = 100;
  doc.moveTo(left, y).lineTo(right, y).strokeColor(LINE).stroke();
  y += 10;
  const colW = width / 2 - 10;
  const sx = left + width / 2 + 10;
  doc.fillColor(MUTED).fontSize(8).text('CUSTOMER & SITE', left, y);
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(11).text(job.customer_name, left, y + 12, { width: colW });
  doc.font('Helvetica').fontSize(9)
    .text([job.address, [job.city, job.state].filter(Boolean).join(', '), job.pincode].filter(Boolean).join(' - '), { width: colW })
    .text(`Phone: ${job.phone}${job.email ? `  |  ${job.email}` : ''}`, { width: colW })
    .text(`Lead: ${job.lead_code}`, { width: colW });
  const yLeft = doc.y;

  doc.fillColor(MUTED).fontSize(8).text('SYSTEM INSTALLED', sx, y);
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(11)
    .text(job.package_name || PACKAGE_LABEL[job.package_kind] || 'Solar system', sx, y + 12, { width: colW });
  doc.font('Helvetica').fontSize(9)
    .text(`Type: ${PACKAGE_LABEL[job.package_kind] || job.system_type || '-'}`, sx, doc.y, { width: colW })
    .text(`Ordered: ${Number(job.capacity_kw)} kWp  |  Confirmed on site: ${Number(job.confirmed_capacity_kw)} kWp`, sx, doc.y, { width: colW })
    .text(`Generation test reading: ${Number(job.generation_reading_kw)} kW`, sx, doc.y, { width: colW });
  doc.y = Math.max(yLeft, doc.y);

  // ---- installation ----
  heading('Installation');
  const crewNames = (job.crew || []).map((c) => `${c.name}${c.is_lead ? ' (lead)' : ''}`).join(', ');
  doc.text(`Started: ${fmtDateTime(job.started_at)}     Finished: ${fmtDateTime(job.finished_at)}`, left, doc.y, { width });
  doc.text(`Crew: ${crewNames || '-'}`, { width });
  const ticks = (job.checklist_items || []).map((i) => `${i.done ? '[x]' : '[ ]'} ${i.label}`).join('    ');
  doc.text(`Checklist: ${ticks}`, { width });
  if (job.notes) doc.fillColor(MUTED).text(`Notes: ${job.notes}`, { width }).fillColor('#000');

  // ---- serials + warranty ----
  heading(`Equipment installed (${(job.serials || []).length} serialized units)`);
  const cols = [
    { t: '#', w: 24 },
    { t: 'Serial number', w: 150 },
    { t: 'Product', w: width - 24 - 150 - 110 },
    { t: 'Warranty until', w: 110 },
  ];
  const row = (cells, bold, fill) => {
    ensure(18);
    const ry = doc.y;
    if (fill) doc.rect(left, ry, width, 16).fill(fill);
    doc.fillColor('#000').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5);
    let x = left;
    cells.forEach((c, i) => {
      doc.text(String(c), x + 4, ry + 4, { width: cols[i].w - 8, lineBreak: false, ellipsis: true });
      x += cols[i].w;
    });
    doc.y = ry + 16;
  };
  row(cols.map((c) => c.t), true, '#FFF1E6');
  (job.serials || []).forEach((s, i) =>
    row([i + 1, s.serial_number, s.name, s.warranty_end ? `${fmtDate(s.warranty_end)} (${s.warranty_months} mo)` : '-'], false, i % 2 ? '#FAFAFA' : null),
  );

  // ---- photos ----
  const ordered = [...(job.photos || [])].sort((a, b) => (a.stage === 'AFTER' ? -1 : 0) - (b.stage === 'AFTER' ? -1 : 0));
  const pics = ordered.map((p) => ({ ...p, file: embeddable(p.path) })).filter((p) => p.file).slice(0, 3);
  if (pics.length) {
    heading('Site photos');
    ensure(130);
    const py = doc.y;
    const pw = (width - 20) / 3;
    pics.forEach((p, i) => {
      const px = left + i * (pw + 10);
      try {
        doc.image(p.file, px, py, { fit: [pw, 110], align: 'center', valign: 'center' });
      } catch {
        doc.rect(px, py, pw, 110).strokeColor(LINE).stroke();
      }
      doc.fillColor(MUTED).fontSize(7.5).text(`${p.stage} - ${fmtDate(p.uploaded_at)}`, px, py + 113, { width: pw, align: 'center' });
    });
    doc.y = py + 128;
  }

  // ---- signature + integrity ----
  heading('Customer sign-off');
  ensure(110);
  const sy = doc.y;
  const sig = embeddable(job.signature_path);
  doc.rect(left, sy, 200, 80).strokeColor(LINE).stroke();
  if (sig) {
    try {
      doc.image(sig, left + 5, sy + 5, { fit: [190, 70], align: 'center', valign: 'center' });
    } catch {
      /* unreadable image: leave the box empty */
    }
  }
  doc.fillColor('#000').font('Helvetica').fontSize(9)
    .text(`Signed by: ${job.signed_by_name || '-'}`, left + 215, sy + 4, { width: width - 215 })
    .text(`Signed at: ${fmtDateTime(job.signed_at)}`, left + 215, doc.y, { width: width - 215 })
    .text('I confirm the system above was installed and tested at my site.', left + 215, doc.y + 4, { width: width - 215 });
  const integrity = job.signature_integrity;
  doc.font('Helvetica-Bold').fillColor(integrity?.valid ? OK : BAD)
    .text(`Integrity check: ${integrity?.valid ? 'VERIFIED - record unchanged since signing' : 'ALTERED - record changed after signing'}`,
      left + 215, doc.y + 6, { width: width - 215 });
  doc.y = Math.max(doc.y, sy + 86);
  doc.font('Helvetica').fontSize(7).fillColor(MUTED)
    .text(`SHA-256(job | serials | signed time | signature): ${job.signature_hash || '-'}`, left, doc.y + 4, { width });

  doc.end();
}

module.exports = { renderCertificate };
