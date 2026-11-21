// End-to-end smoke test of Phase 1 (Person A). Needs db:start + dev running.
// Usage: npm run db:reset  then  npm run test:smoke  then  npm run db:reset again
// (it expects fresh seed data and adds its own test leads)
const fs = require('node:fs');
const path = require('node:path');
const B = 'http://localhost:5000/api';
let pass = 0, fail = 0;
const check = (name, cond, extra) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${!cond && extra !== undefined ? ' -> ' + JSON.stringify(extra).slice(0, 400) : ''}`); };

async function api(method, url, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const r = await fetch(B + url, { method, headers, body: form || (body && JSON.stringify(body)) });
  const ct = r.headers.get('content-type') || '';
  return { status: r.status, json: ct.includes('json') ? await r.json() : null, buf: ct.includes('pdf') ? Buffer.from(await r.arrayBuffer()) : null };
}

(async () => {
  for (let i = 0; i < 30; i++) { try { await fetch(B + '/health'); break; } catch { await new Promise(r => setTimeout(r, 500)); } }
  const h = await api('GET', '/health'); check('health', h.status === 200, h.json);

  const login = async (email) => (await api('POST', '/auth/login', { body: { email, password: 'password123' } })).json.data.token;
  const bad = await api('POST', '/auth/login', { body: { email: 'admin@sunpower.com', password: 'nope' } });
  check('bad login 401', bad.status === 401 && bad.json.success === false, bad.json);
  const admin = await login('admin@sunpower.com'), staff = await login('staff@sunpower.com'), tech = await login('tech@sunpower.com');
  check('logins', admin && staff && tech);

  const enq = await api('POST', '/public/enquiries', { body: { customerName: 'Test Customer', phone: '+91 91234 56789', city: 'Pune', monthlyBill: 3000, pincode: '411001' } });
  check('enquiry 201', enq.status === 201, enq.json);
  const dup = await api('POST', '/public/enquiries', { body: { customerName: 'Test Customer', phone: '9123456789' } });
  check('duplicate enquiry folded', dup.json.data.leadCode === enq.json.data.leadCode, dup.json);
  const badEnq = await api('POST', '/public/enquiries', { body: { customerName: 'X', phone: '123' } });
  check('invalid phone 400', badEnq.status === 400, badEnq.json);

  const list = await api('GET', `/leads?q=${enq.json.data.leadCode}`, { token: staff });
  const lead = list.json.data.items[0];
  check('search finds lead', list.json.data.items.length === 1 && lead.assignedToName, list.json);
  check('counts present', list.json.data.counts.NEW >= 1);
  const techLeads = await api('GET', '/leads', { token: tech });
  check('technician blocked 403', techLeads.status === 403);
  const noAuth = await api('GET', '/leads');
  check('no token 401', noAuth.status === 401);

  const earlyQuote = await api('POST', `/leads/${lead.id}/quotes`, { token: staff, body: { templateId: 1 } });
  check('quote before survey 409', earlyQuote.status === 409, earlyQuote.json);

  const q = await api('PATCH', `/leads/${lead.id}/qualify`, { token: staff, body: { monthlyBill: 3000, roofAreaSqft: 400, systemType: 'ON_GRID', timeline: 'Immediate' } });
  check('qualify', q.status === 200 && q.json.data.lead.status === 'QUALIFIED' && q.json.data.suggestedKw === 3, q.json);
  const q2 = await api('PATCH', `/leads/${lead.id}/qualify`, { token: staff, body: {} });
  check('re-qualify 409', q2.status === 409 && q2.json.error.code === 'INVALID_STATUS_TRANSITION', q2.json);

  const techs = await api('GET', '/users?role=TECHNICIAN', { token: staff });
  check('technicians list', techs.json.data.length === 1, techs.json);
  const today = new Date().toISOString().slice(0, 10);
  const sv = await api('POST', `/leads/${lead.id}/surveys`, { token: staff, body: { technicianId: techs.json.data[0].id, scheduledDate: today } });
  check('assign survey', sv.status === 201 && sv.json.data.status === 'SCHEDULED', sv.json);

  const my = await api('GET', '/surveys/my?status=SCHEDULED', { token: tech });
  check('tech sees survey', my.json.data.some((s) => s.id === sv.json.data.id), my.json);

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');
  const noPhoto = new FormData(); noPhoto.append('roofType', 'RCC');
  const np = await api('PATCH', `/surveys/${sv.json.data.id}/submit`, { token: tech, form: noPhoto });
  check('submit without photo 400', np.status === 400, np.json);
  const fd = new FormData();
  fd.append('roofType', 'RCC flat'); fd.append('roofAreaSqft', '380'); fd.append('shading', 'none'); fd.append('recommendedKw', '3');
  fd.append('photos', new Blob([png], { type: 'image/png' }), 'roof.png');
  fd.append('photos', new Blob([png], { type: 'image/png' }), 'meter.png');
  const sub = await api('PATCH', `/surveys/${sv.json.data.id}/submit`, { token: tech, form: fd });
  check('submit survey', sub.status === 200 && sub.json.data.photos.length === 2, sub.json);
  const img = await fetch('http://localhost:5000' + sub.json.data.photos[0]);
  check('photo served', img.status === 200 && img.headers.get('content-type') === 'image/png');

  const staffReview = await api('PATCH', `/surveys/${sv.json.data.id}/review`, { token: staff, body: { decision: 'APPROVE' } });
  check('staff cannot review 403', staffReview.status === 403);
  const rejNoNote = await api('PATCH', `/surveys/${sv.json.data.id}/review`, { token: admin, body: { decision: 'REJECT' } });
  check('reject needs note 400', rejNoNote.status === 400);
  const rv = await api('PATCH', `/surveys/${sv.json.data.id}/review`, { token: admin, body: { decision: 'APPROVE', note: 'OK' } });
  check('approve survey', rv.status === 200 && rv.json.data.status === 'APPROVED', rv.json);

  const tpl = await api('GET', '/templates?systemType=ON_GRID&capacityKw=3', { token: staff });
  check('template lookup', tpl.json.data.length === 1 && tpl.json.data[0].items.length === 10, tpl.json);
  const qt = await api('POST', `/leads/${lead.id}/quotes`, { token: staff, body: { templateId: tpl.json.data[0].id, discountPct: 5 } });
  const d = qt.json?.data;
  check('create quote', qt.status === 201 && d.items.length === 10 && d.quoteNumber, qt.json);
  check('totals add up', Math.abs(d.subtotal - d.discountAmount + d.gstAmount - d.total) < 0.01, d);
  console.log('   quote', d.quoteNumber, 'subtotal', d.subtotal, 'disc', d.discountAmount, 'gst', d.gstAmount, 'total', d.total);

  const got = await api('GET', `/quotes/${d.id}`, { token: staff });
  check('get quote', got.status === 200 && got.json.data.customerName === 'Test Customer', got.json);
  const pdf = await api('GET', `/quotes/${d.id}/pdf`, { token: staff });
  check('pdf', pdf.status === 200 && pdf.buf && pdf.buf.subarray(0, 4).toString() === '%PDF', pdf.status);
  if (pdf.buf) { const out = path.join(__dirname, '..', 'uploads', 'smoke-test-quote.pdf'); fs.writeFileSync(out, pdf.buf); console.log('   PDF saved to', out); }

  const badMove = await api('PATCH', `/quotes/${d.id}/status`, { token: staff, body: { status: 'DRAFT' } });
  check('invalid quote status 400', badMove.status === 400);
  const sent = await api('PATCH', `/quotes/${d.id}/status`, { token: staff, body: { status: 'SENT' } });
  check('quote SENT', sent.json.data?.status === 'SENT', sent.json);
  const acc = await api('PATCH', `/quotes/${d.id}/status`, { token: staff, body: { status: 'ACCEPTED' } });
  check('quote ACCEPTED', acc.json.data?.status === 'ACCEPTED', acc.json);
  const again = await api('PATCH', `/quotes/${d.id}/status`, { token: staff, body: { status: 'REJECTED' } });
  check('accepted is final 409', again.status === 409);

  const det = await api('GET', `/leads/${lead.id}`, { token: staff });
  check('lead WON', det.json.data.status === 'WON', det.json.data.status);
  console.log('   timeline:', det.json.data.activities.map((a) => a.toStatus || a.type).reverse().join(' > '));

  // reject path on seeded SURVEY_SUBMITTED lead + lost
  const seeded = (await api('GET', '/leads?status=SURVEY_SUBMITTED', { token: admin })).json.data.items[0];
  const seededDet = (await api('GET', `/leads/${seeded.id}`, { token: admin })).json.data;
  const rej = await api('PATCH', `/surveys/${seededDet.surveys[0].id}/review`, { token: admin, body: { decision: 'REJECT', note: 'Need meter photo' } });
  const afterRej = (await api('GET', `/leads/${seeded.id}`, { token: admin })).json.data.status;
  check('reject -> QUALIFIED', rej.status === 200 && afterRej === 'QUALIFIED', afterRej);
  const lost = await api('PATCH', `/leads/${seeded.id}/lost`, { token: staff, body: { reason: 'Went with competitor' } });
  check('mark lost', lost.json.data?.status === 'LOST' && lost.json.data.lostReason, lost.json);
  const lost2 = await api('PATCH', `/leads/${seeded.id}/lost`, { token: staff, body: { reason: 'x' } });
  check('lost is final 409', lost2.status === 409);

  const manual = await api('POST', '/leads', { token: staff, body: { customerName: 'Walk-in', phone: '9000000099', source: 'whatsapp' } });
  check('manual lead self-assigned', manual.status === 201 && manual.json.data.source === 'WHATSAPP', manual.json);
  const manualDup = await api('POST', '/leads', { token: staff, body: { customerName: 'Walk-in', phone: '9000000099' } });
  check('manual duplicate 409', manualDup.status === 409 && manualDup.json.error.code === 'DUPLICATE_LEAD', manualDup.json);
  const nf = await api('GET', '/leads/99999', { token: staff });
  check('404 lead', nf.status === 404 && nf.json.error.code === 'NOT_FOUND');
  const nr = await api('GET', '/nope');
  check('404 route', nr.status === 404);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
