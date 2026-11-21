// End-to-end smoke test of Phase 1 (Person A). Needs db:start + dev running.
// Usage: npm run db:reset  then  npm run test:smoke  then  npm run db:reset again
// (it expects fresh seed data and adds its own test leads)
const fs = require('node:fs');
const path = require('node:path');
// API_URL lets you run this against a separate test server/database, e.g. API_URL=http://localhost:5055
const ORIGIN = process.env.API_URL || 'http://localhost:5000';
const B = ORIGIN + '/api';
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
  const admin = await login('admin@sunpower.com'), tech = await login('tech@sunpower.com');
  const staffA = await login('staff@sunpower.com'), staffB = await login('staff2@sunpower.com');
  check('logins', admin && staffA && staffB && tech);
  // staff can only act on their OWN leads, so map user id -> token to act as the owner
  const staffUsers = (await api('GET', '/users?role=STAFF', { token: admin })).json.data;
  const tokenById = Object.fromEntries(staffUsers.map((u) => [u.id, u.email === 'staff@sunpower.com' ? staffA : staffB]));
  const ownerToken = (lead) => tokenById[lead.assignedTo];
  const otherToken = (lead) => (ownerToken(lead) === staffA ? staffB : staffA);
  let staff = staffA; // re-pointed at the test lead's owner below

  const enq = await api('POST', '/public/enquiries', { body: { customerName: 'Test Customer', phone: '+91 91234 56789', city: 'Pune', monthlyBill: 3000, pincode: '411001' } });
  check('enquiry 201', enq.status === 201, enq.json);
  const dup = await api('POST', '/public/enquiries', { body: { customerName: 'Test Customer', phone: '9123456789' } });
  check('duplicate enquiry folded', dup.json.data.leadCode === enq.json.data.leadCode, dup.json);
  const badEnq = await api('POST', '/public/enquiries', { body: { customerName: 'X', phone: '123' } });
  check('invalid phone 400', badEnq.status === 400, badEnq.json);

  const list = await api('GET', `/leads?q=${enq.json.data.leadCode}`, { token: admin });
  const lead = list.json.data.items[0];
  check('search finds lead (admin)', list.json.data.items.length === 1 && lead.assignedToName, list.json);
  check('counts present', list.json.data.counts.NEW >= 1);
  staff = ownerToken(lead);
  const other = otherToken(lead);
  const ownList = await api('GET', `/leads?q=${enq.json.data.leadCode}`, { token: staff });
  check('owner staff finds own lead', ownList.json.data.items.length === 1, ownList.json);
  const otherList = await api('GET', `/leads?q=${enq.json.data.leadCode}`, { token: other });
  check('other staff cannot list it', otherList.json.data.items.length === 0, otherList.json);
  const otherAll = await api('GET', '/leads?assignedTo=' + lead.assignedTo, { token: other });
  check('other staff assignedTo filter ignored', otherAll.json.data.items.every((l) => l.assignedTo !== lead.assignedTo), otherAll.json);
  const otherDet = await api('GET', `/leads/${lead.id}`, { token: other });
  check('other staff detail 404', otherDet.status === 404, otherDet.json);
  const otherQualify = await api('PATCH', `/leads/${lead.id}/qualify`, { token: other, body: { monthlyBill: 3000 } });
  check('other staff qualify 404', otherQualify.status === 404, otherQualify.json);
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
  check('technicians list (Vikram + Zara)', techs.json.data.length === 2 && techs.json.data[0].email === 'tech@sunpower.com', techs.json);
  const today = new Date().toISOString().slice(0, 10);
  const otherSv = await api('POST', `/leads/${lead.id}/surveys`, { token: other, body: { technicianId: techs.json.data[0].id, scheduledDate: today } });
  check('other staff assign survey 404', otherSv.status === 404, otherSv.json);
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
  const img = await fetch(ORIGIN + sub.json.data.photos[0]);
  check('photo served', img.status === 200 && img.headers.get('content-type') === 'image/png');

  const staffReview = await api('PATCH', `/surveys/${sv.json.data.id}/review`, { token: staff, body: { decision: 'APPROVE' } });
  check('staff cannot review 403', staffReview.status === 403);
  const rejNoNote = await api('PATCH', `/surveys/${sv.json.data.id}/review`, { token: admin, body: { decision: 'REJECT' } });
  check('reject needs note 400', rejNoNote.status === 400);
  const rv = await api('PATCH', `/surveys/${sv.json.data.id}/review`, { token: admin, body: { decision: 'APPROVE', note: 'OK' } });
  check('approve survey', rv.status === 200 && rv.json.data.status === 'APPROVED', rv.json);

  const allPkgs = (await api('GET', '/templates', { token: staff })).json.data;
  const kinds = [...new Set(allPkgs.map((t) => t.kind))].join(',');
  check('20 packages: panel set / on-grid / off-grid / installation x 1-5 kW', allPkgs.length === 20 && kinds === 'PANEL_SET,ON_GRID,OFF_GRID,INSTALLATION', kinds);
  const sections = (t) => [...new Set(t.items.map((i) => i.section))];
  const pick = (kind, kw) => allPkgs.find((t) => t.kind === kind && t.capacityKw === kw);
  check('panel set = panels, connectors, wires', pick('PANEL_SET', 3).items.map((i) => i.sku).join() === 'PNL-540,MC4-PAIR,CAB-DC-4');
  const on3 = pick('ON_GRID', 3), off3 = pick('OFF_GRID', 3);
  check('on-grid has every part group', ['Solar Panels & Wiring', 'Inverter & Charge Control', 'Wiring Boxes & Switches', 'Safety & Earthing', 'Mounting Stands'].every((x) => sections(on3).includes(x)), sections(on3));
  check('on-grid includes charge controller, isolator, earthing, stands', ['CC-MPPT-60', 'SW-DC-ISO', 'SW-AC-MCB', 'BOS-EARTH', 'BOS-LA', 'STR-GI', 'MC4-PAIR'].every((k) => on3.items.some((i) => i.sku === k)));
  check('off-grid = on-grid parts + battery storage', sections(off3).includes('Battery Storage') && off3.items.length === on3.items.length + 3, [off3.items.length, on3.items.length]);
  const tpl = await api('GET', '/templates?kind=ON_GRID&capacityKw=3', { token: staff });
  check('template lookup by kind', tpl.json.data.length === 1 && tpl.json.data[0].items.length === 14, tpl.json);
  const otherQt = await api('POST', `/leads/${lead.id}/quotes`, { token: other, body: { templateId: tpl.json.data[0].id } });
  check('other staff create quote 404', otherQt.status === 404, otherQt.json);
  const qt = await api('POST', `/leads/${lead.id}/quotes`, { token: staff, body: { templateId: tpl.json.data[0].id, discountPct: 5 } });
  const d = qt.json?.data;
  check('create quote: package + installation parts', qt.status === 201 && d.items.length === 16 && d.includesInstallation === true && d.quoteNumber, qt.json);
  check('quote lines carry sections', d.items[0].section === 'Solar Panels & Wiring' && d.items[d.items.length - 1].section === 'Installation (Service)', d.items.map((i) => i.section));
  check('totals add up', Math.abs(d.subtotal - d.discountAmount + d.gstAmount - d.total) < 0.01, d);
  const instAsMain = await api('POST', `/leads/${lead.id}/quotes`, { token: staff, body: { templateId: pick('INSTALLATION', 3).id } });
  check('installation alone is not a package 400', instAsMain.status === 400, instAsMain.json);
  const panelOnly = await api('POST', `/leads/${lead.id}/quotes`, { token: staff, body: { templateId: pick('PANEL_SET', 3).id, includeInstallation: false } });
  check('revised quote: panel set only, no installation', panelOnly.status === 201 && panelOnly.json.data.items.length === 3 && panelOnly.json.data.includesInstallation === false && panelOnly.json.data.systemType === null, panelOnly.json);
  console.log('   quote', d.quoteNumber, 'subtotal', d.subtotal, 'disc', d.discountAmount, 'gst', d.gstAmount, 'total', d.total);

  const got = await api('GET', `/quotes/${d.id}`, { token: staff });
  check('get quote', got.status === 200 && got.json.data.customerName === 'Test Customer', got.json);
  const pdf = await api('GET', `/quotes/${d.id}/pdf`, { token: staff });
  check('pdf', pdf.status === 200 && pdf.buf && pdf.buf.subarray(0, 4).toString() === '%PDF', pdf.status);
  if (pdf.buf) { const out = path.join(__dirname, '..', 'uploads', 'smoke-test-quote.pdf'); fs.writeFileSync(out, pdf.buf); console.log('   PDF saved to', out); }

  const otherGetQ = await api('GET', `/quotes/${d.id}`, { token: other });
  const otherPdf = await api('GET', `/quotes/${d.id}/pdf`, { token: other });
  const otherStatus = await api('PATCH', `/quotes/${d.id}/status`, { token: other, body: { status: 'ACCEPTED' } });
  check('other staff quote/pdf/status 404', otherGetQ.status === 404 && otherPdf.status === 404 && otherStatus.status === 404,
    [otherGetQ.status, otherPdf.status, otherStatus.status]);
  const adminGetQ = await api('GET', `/quotes/${d.id}`, { token: admin });
  check('admin can open any quote', adminGetQ.status === 200);

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

  // ============ Phase 2: order -> payment -> pick list & scan -> dispatch -> deliver -> warranty ============
  const ord0 = acc.json.data.order;
  check('P2 order created on ACCEPTED (same transaction)', ord0 && ord0.status === 'PENDING_PAYMENT' && ord0.quoteId === d.id, acc.json.data);
  const oid = ord0.id;
  check('P2 advance required = 30% of total', Math.abs(ord0.advanceRequired - Math.round(d.total * 30) / 100) < 0.01, [ord0.advanceRequired, d.total]);
  check('P2 lead detail lists the order', det.json.data.orders?.[0]?.id === oid, det.json.data.orders);
  const pay = (body, token = staff) => api('POST', `/orders/${oid}/payments`, { token, body });
  const scan = (serialNumber, token = staff) => api('POST', `/orders/${oid}/scan`, { token, body: { serialNumber } });

  check('P2 other staff cannot see the order 404', (await api('GET', `/orders/${oid}`, { token: other })).status === 404);
  check('P2 technician cannot list orders 403', (await api('GET', '/orders', { token: tech })).status === 403);
  const scanEarly = await scan('INV-ONG-3-SN0001');
  check('P2 scan before confirmation 409', scanEarly.status === 409 && scanEarly.json.error.code === 'INVALID_ORDER_STATUS', scanEarly.json);
  const overpay = await pay({ amount: ord0.totalAmount + 1, mode: 'UPI' });
  check('P2 overpayment 409', overpay.status === 409 && overpay.json.error.code === 'OVERPAYMENT', overpay.json);
  check('P2 bad payment mode 400', (await pay({ amount: 100, mode: 'BITCOIN' })).status === 400);
  const small = await pay({ amount: 10000, mode: 'CASH' });
  check('P2 part advance keeps PENDING_PAYMENT', small.status === 201 && small.json.data.order.status === 'PENDING_PAYMENT' && small.json.data.payment.type === 'ADVANCE' && !small.json.data.confirmed, small.json);
  const adv = await pay({ amount: Math.round((ord0.advanceRequired - 10000) * 100) / 100, mode: 'UPI', reference: 'UPI-TEST-123' });
  check('P2 crossing the advance threshold confirms the order', adv.json.data?.confirmed === true && adv.json.data.order.status === 'CONFIRMED' && adv.json.data.payment.type === 'ADVANCE', adv.json);

  const pl = (await api('GET', `/orders/${oid}/pick-list`, { token: staff })).json.data;
  const line = (sku) => pl.lines.find((l) => l.sku === sku);
  check('P2 pick list = quote hardware, no services', pl.lines.length === 14 && !pl.lines.some((l) => l.category === 'SERVICE'), pl.lines.map((l) => l.sku));
  check('P2 serialized lines: 6 panels, 1 inverter, 1 controller', line('PNL-540').qtyRequired === 6 && line('INV-ONG-3').isSerialized && line('CC-MPPT-60').qtyRequired === 1 && pl.serialsRequired === 8, pl.lines);
  const od1 = (await api('GET', `/orders/${oid}`, { token: staff })).json.data;
  check('P2 installation job created on confirmation', od1.installationJob?.status === 'SCHEDULED' && od1.payments.length === 2, od1.installationJob);

  // inventory: list, low stock, receive, serial search, ledger
  const invList = (await api('GET', '/inventory', { token: staff })).json.data;
  const prod = (sku) => invList.find((p) => p.sku === sku);
  check('P2 inventory lists stock + low-stock flags', prod('BOS-LA').lowStock === true && prod('MC4-PAIR').lowStock === false && prod('PNL-540').serialsInStock >= 12, [prod('BOS-LA'), prod('PNL-540')]);
  check('P2 services are not inventory', !invList.some((p) => p.category === 'SERVICE'));
  const isoBefore = prod('SW-DC-ISO').available;
  const recvBulk = await api('POST', '/inventory/receive', { token: staff, body: { productId: prod('SW-DC-ISO').id, quantity: 10, note: 'PO-77' } });
  check('P2 receive bulk stock', recvBulk.status === 201 && recvBulk.json.data.stockQty === isoBefore + 10, recvBulk.json);
  const recvSer = await api('POST', '/inventory/receive', { token: staff, body: { productId: prod('INV-ONG-3').id, serials: ['INV-ONG-3-TEST-0001', 'inv-ong-3-test-0002'], purchaseCost: 26000 } });
  check('P2 receive serials (normalised to upper case)', recvSer.status === 201 && recvSer.json.data.received === 2 && recvSer.json.data.serials.some((s) => s.serialNumber === 'INV-ONG-3-TEST-0002'), recvSer.json);
  const recvDup = await api('POST', '/inventory/receive', { token: staff, body: { productId: prod('INV-ONG-3').id, serials: ['INV-ONG-3-TEST-0001'] } });
  check('P2 duplicate serial 409', recvDup.status === 409 && recvDup.json.error.code === 'DUPLICATE_SERIAL', recvDup.json);
  check('P2 quantity for a serialized product 400', (await api('POST', '/inventory/receive', { token: staff, body: { productId: prod('INV-ONG-3').id, quantity: 2 } })).status === 400);
  check('P2 serials for a bulk product 400', (await api('POST', '/inventory/receive', { token: staff, body: { productId: prod('MC4-PAIR').id, serials: ['MC4-X-001'] } })).status === 400);
  const serialSearch = (await api('GET', `/inventory/serials?productId=${prod('INV-ONG-3').id}&status=IN_STOCK`, { token: staff })).json.data;
  check('P2 serial search by product + status', serialSearch.length === 5 && serialSearch.every((s) => s.status === 'IN_STOCK'), serialSearch.length);

  // scan rules (all 409)
  const unknownSerial = await scan('NOPE-0000');
  check('P2 scan unknown serial 409', unknownSerial.status === 409 && unknownSerial.json.error.code === 'SERIAL_NOT_FOUND', unknownSerial.json);
  const wrongProduct = await scan('BAT-150-SN0001');
  check('P2 scan product not on pick list 409', wrongProduct.status === 409 && wrongProduct.json.error.code === 'NOT_ON_PICK_LIST', wrongProduct.json);
  const early = await api('POST', `/orders/${oid}/dispatch`, { token: staff, body: { vehicleNo: 'MH12 AB 1234', driverName: 'Ramesh' } });
  check('P2 dispatch with incomplete pick list 409', early.status === 409 && early.json.error.code === 'PICK_LIST_INCOMPLETE', early.json);
  const s1 = await scan('inv-ong-3-sn0001');
  check('P2 scan inverter reserves it', s1.status === 200 && s1.json.data.scanned.status === 'RESERVED', s1.json);
  const again1 = await scan('INV-ONG-3-SN0001');
  check('P2 same serial twice 409', again1.status === 409 && again1.json.error.code === 'SERIAL_NOT_AVAILABLE', again1.json);
  const full1 = await scan('INV-ONG-3-SN0002');
  check('P2 line already fully scanned 409', full1.status === 409 && full1.json.error.code === 'LINE_FULLY_SCANNED', full1.json);
  check('P2 scan controller', (await scan('CC-MPPT-60-SN0001')).status === 200);
  let panelsOk = true;
  for (let i = 1; i <= 6; i++) panelsOk = panelsOk && (await scan(`PNL-540-SN000${i}`)).status === 200;
  check('P2 scan 6 panels', panelsOk);
  const seventh = await scan('PNL-540-SN0007');
  check('P2 7th panel 409 (line full)', seventh.status === 409 && seventh.json.error.code === 'LINE_FULLY_SCANNED');
  const undo = await api('DELETE', `/orders/${oid}/scan/PNL-540-SN0006`, { token: staff });
  check('P2 undo a scan frees the unit', undo.status === 200 && undo.json.data.released.status === 'IN_STOCK' && undo.json.data.pickList.serialsScanned === 7, undo.json);
  check('P2 undo unknown scan 404', (await api('DELETE', `/orders/${oid}/scan/PNL-540-SN0020`, { token: staff })).status === 404);
  const rescan = await scan('PNL-540-SN0006');
  check('P2 pick list complete after re-scan', rescan.json.data?.pickList.complete === true && rescan.json.data.pickList.readyToDispatch === true, rescan.json);
  check('P2 other staff cannot scan 404', (await scan('PNL-540-SN0010', other)).status === 404);

  // dispatch
  check('P2 bad vehicle number 400', (await api('POST', `/orders/${oid}/dispatch`, { token: staff, body: { vehicleNo: '!', driverName: 'R' } })).status === 400);
  const disp = await api('POST', `/orders/${oid}/dispatch`, { token: staff, body: { vehicleNo: 'mh12 ab 1234', driverName: 'Ramesh Patil' } });
  check('P2 dispatch: order DISPATCHED, 8 serials out', disp.status === 200 && disp.json.data.order.status === 'DISPATCHED' && disp.json.data.serialsDispatched === 8 && disp.json.data.dispatch.vehicleNo === 'MH12 AB 1234', disp.json);
  const invAfter = (await api('GET', '/inventory', { token: staff })).json.data;
  const after = (sku) => invAfter.find((p) => p.sku === sku);
  check('P2 bulk stock reduced (stands -3, isolator -1)', after('STR-GI').available === prod('STR-GI').available - 3 && after('SW-DC-ISO').available === isoBefore + 10 - 1, [after('STR-GI').available, after('SW-DC-ISO').available]);
  const ledger = (await api('GET', `/inventory/movements?productId=${prod('STR-GI').id}`, { token: staff })).json.data;
  check('P2 stock ledger records the dispatch', ledger[0].reason === 'DISPATCHED' && ledger[0].qtyChange === -3 && ledger[0].orderId === oid, ledger[0]);
  check('P2 scan after dispatch 409', (await scan('PNL-540-SN0011')).status === 409);
  check('P2 dispatch twice 409', (await api('POST', `/orders/${oid}/dispatch`, { token: staff, body: { vehicleNo: 'MH12 AB 1234', driverName: 'R' } })).status === 409);

  // installation job: assign crew lead + date; technician sees own job and confirms delivery
  check('P2 tech cannot deliver before being crew lead 404', (await api('POST', `/orders/${oid}/deliver`, { token: tech })).status === 404);
  const techId = (await api('GET', '/users?role=TECHNICIAN', { token: admin })).json.data[0].id;
  const jobId = od1.installationJob.id;
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  check('P2 job date in the past 400', (await api('PATCH', `/jobs/${jobId}/assign`, { token: staff, body: { crewLeadId: techId, scheduledDate: '2020-01-01' } })).status === 400);
  check('P2 other staff cannot assign job 404', (await api('PATCH', `/jobs/${jobId}/assign`, { token: other, body: { crewLeadId: techId, scheduledDate: tomorrow } })).status === 404);
  const assignJ = await api('PATCH', `/jobs/${jobId}/assign`, { token: staff, body: { crewLeadId: techId, scheduledDate: tomorrow } });
  check('P2 assign crew lead + date', assignJ.status === 200 && assignJ.json.data.crewLeadId === techId && assignJ.json.data.scheduledDate === tomorrow, assignJ.json);
  const techJobs = (await api('GET', `/jobs?from=${tomorrow}&to=${tomorrow}`, { token: tech })).json.data;
  check('P2 technician sees own job', techJobs.length === 1 && techJobs[0].id === jobId && techJobs[0].customerName, techJobs);
  const earlyStart = await api('POST', `/jobs/${jobId}/start`, { token: tech });
  check('P3 start before delivery 409', earlyStart.status === 409 && earlyStart.json.error.code === 'ORDER_NOT_DELIVERED', earlyStart.json);
  const deliv = await api('POST', `/orders/${oid}/deliver`, { token: tech });
  check('P2 crew lead confirms delivery: 8 warranties start', deliv.status === 200 && deliv.json.data.order.status === 'DELIVERED' && deliv.json.data.warrantiesStarted === 8, deliv.json);
  const od2 = (await api('GET', `/orders/${oid}`, { token: staff })).json.data;
  const pw = od2.warranties.find((w) => w.sku === 'PNL-540'), iw = od2.warranties.find((w) => w.sku === 'INV-ONG-3');
  const plusYears = (dt, y) => { const x = new Date(dt + 'T00:00:00Z'); x.setUTCFullYear(x.getUTCFullYear() + y); return x.toISOString().slice(0, 10); };
  check('P2 warranty months from product: panel 240, inverter 24', pw.months === 240 && iw.months === 24 && pw.endDate === plusYears(pw.startDate, 20) && iw.endDate === plusYears(iw.startDate, 2), [pw, iw]);
  check('P2 all order serials DELIVERED', od2.serials.length === 8 && od2.serials.every((s) => s.status === 'DELIVERED') && od2.dispatch.deliveredAt, od2.serials.map((s) => s.status));
  check('P2 deliver twice 409', (await api('POST', `/orders/${oid}/deliver`, { token: staff })).status === 409);
  const bal = await pay({ amount: od2.balanceDue, mode: 'BANK', reference: 'NEFT-998' });
  check('P2 balance payment closes the account', bal.json.data?.payment.type === 'BALANCE' && bal.json.data.balanceDue === 0, bal.json);
  check('P2 nothing left to pay 409', (await pay({ amount: 1, mode: 'CASH' })).json?.error?.code === 'ALREADY_PAID');
  console.log('   order:', od2.orderNumber, '| paid', od2.amountPaid, 'of', od2.totalAmount, '| warranties', od2.warranties.length);

  // ===================== Phase 3: field installation on the roof =====================
  const tech2 = await login('tech2@sunpower.com');
  const tech2Id = (await api('GET', '/users?role=TECHNICIAN', { token: admin })).json.data.find((u) => u.email === 'tech2@sunpower.com').id;
  const J = (p) => `/jobs/${jobId}${p}`;
  const crewSet = await api('PUT', J('/crew'), { token: staff, body: { technicianIds: [tech2Id] } });
  check('P3 set crew: lead stays, Zara added', crewSet.status === 200 && crewSet.json.data.crew.length === 2 && crewSet.json.data.crew[0].isLead, crewSet.json);
  check('P3 crew must be technicians 400', (await api('PUT', J('/crew'), { token: staff, body: { technicianIds: [staffUsers[0].id] } })).status === 400);
  check('P3 other staff cannot change the crew 404', (await api('PUT', J('/crew'), { token: other, body: { technicianIds: [tech2Id] } })).status === 404);
  const myTech = (await api('GET', `/jobs/my?date=${tomorrow}`, { token: tech })).json.data;
  check('P3 my jobs (lead) with maps link', myTech.some((j) => j.id === jobId && j.isLead && j.mapsUrl.includes('google.com/maps')), myTech);
  const myTech2 = (await api('GET', '/jobs/my', { token: tech2 })).json.data;
  check('P3 my jobs (crew member) lists it too', myTech2.some((j) => j.id === jobId && !j.isLead), myTech2);
  check('P3 /jobs/my is for technicians 403', (await api('GET', '/jobs/my', { token: staff })).status === 403);
  check('P3 crew member cannot start (lead only) 403', (await api('POST', J('/start'), { token: tech2 })).status === 403);
  check('P3 checklist before start 409', (await api('PATCH', J('/checklist'), { token: tech, body: { checklist: { STANDS_MOUNTED: true } } })).json?.error?.code === 'JOB_NOT_STARTED');
  const st = await api('POST', J('/start'), { token: tech });
  check('P3 crew lead starts the job', st.status === 200 && st.json.data.status === 'IN_PROGRESS' && st.json.data.startedAt, st.json);
  check('P3 start twice 409', (await api('POST', J('/start'), { token: tech })).json?.error?.code === 'JOB_ALREADY_STARTED');
  const jd = (await api('GET', J(''), { token: tech2 })).json.data;
  check('P3 job detail: customer, 8 expected serials, 5-item checklist', jd.customerName && jd.serials.length === 8 && jd.checklistItems.length === 5 && jd.serialsProgress.verified === 0, jd);
  check('P3 technicians do not see pay rates', jd.crew.every((c) => c.hourlyRate === undefined) && jd.labourCost === undefined);
  check('P3 other staff cannot open the job 404', (await api('GET', J(''), { token: other })).status === 404);
  check('P3 unknown checklist item 400', (await api('PATCH', J('/checklist'), { token: tech, body: { checklist: { ROOF_PAINTED: true } } })).status === 400);
  const cl = await api('PATCH', J('/checklist'), { token: tech2, body: { checklist: { STANDS_MOUNTED: true, PANELS_LAID: true } } });
  check('P3 crew member saves checklist progress', cl.status === 200 && cl.json.data.items.filter((i) => i.done).length === 2 && !cl.json.data.complete, cl.json);
  const sigPng = 'data:image/png;base64,' + png.toString('base64');
  const finish = (body = {}, token = tech) =>
    api('POST', J('/complete'), { token, body: { confirmedCapacityKw: 3, generationReadingKw: 2.6, signedByName: 'Test Customer', signature: sigPng, notes: 'Commissioned', ...body } });
  check('P3 complete: checklist incomplete 409', (await finish()).json?.error?.code === 'CHECKLIST_INCOMPLETE');
  check('P3 crew member cannot complete (lead only) 403', (await finish({}, tech2)).status === 403);
  await api('PATCH', J('/checklist'), { token: tech, body: { checklist: { WIRING_BOXES_CONNECTED: true, EARTHING_DONE: true, GENERATION_TESTED: true } } });
  const photo = (stage, n, token = tech) => {
    const fd = new FormData();
    if (stage) fd.append('stage', stage);
    for (let i = 0; i < n; i++) fd.append('photos', new Blob([png], { type: 'image/png' }), `${stage || 'x'}-${i}.png`);
    return api('POST', J('/photos'), { token, form: fd });
  };
  check('P3 photo without stage 400', (await photo(null, 1)).status === 400);
  const ph1 = await photo('BEFORE', 1, tech2);
  check('P3 crew member uploads a BEFORE photo', ph1.status === 201 && ph1.json.data.counts.BEFORE === 1, ph1.json);
  await photo('AFTER', 1);
  check('P3 complete: only 1 AFTER photo 409', (await finish()).json?.error?.code === 'NOT_ENOUGH_AFTER_PHOTOS');
  const ph3 = await photo('AFTER', 1);
  check('P3 2 AFTER photos uploaded', ph3.json.data?.counts.AFTER === 2, ph3.json);
  const missingSer = await finish();
  check('P3 complete: unverified serials 409 lists all 8', missingSer.json?.error?.code === 'SERIALS_NOT_VERIFIED' && missingSer.json.error.details.missing.length === 8, missingSer.json);
  const verify = (sn, token = tech2) => api('POST', J('/serials/verify'), { token, body: { serialNumber: sn } });
  check('P3 verify unknown serial 409', (await verify('NOPE-9999')).json?.error?.code === 'SERIAL_NOT_FOUND');
  check('P3 verify a serial from another order 409', (await verify('PNL-540-SN0015')).json?.error?.code === 'SERIAL_NOT_ON_ORDER');
  let allOk = true;
  let lastVerify;
  for (const s of jd.serials) {
    lastVerify = await verify(s.serialNumber);
    allOk = allOk && lastVerify.status === 200;
  }
  check('P3 verify all 8 serials on site', allOk && lastVerify.json.data.progress.verified === 8 && lastVerify.json.data.progress.missing.length === 0, lastVerify.json);
  check('P3 verify twice 409', (await verify(jd.serials[0].serialNumber)).json?.error?.code === 'SERIAL_ALREADY_VERIFIED');
  check('P3 capacity mismatch 409', (await finish({ confirmedCapacityKw: 5 })).json?.error?.code === 'CAPACITY_MISMATCH');
  check('P3 signature missing 400', (await finish({ signature: '' })).json?.error?.code === 'SIGNATURE_MISSING');
  check('P3 customer name missing 400', (await finish({ signedByName: '' })).json?.error?.code === 'SIGNATURE_MISSING');
  check('P3 certificate before completion 409', (await api('GET', J('/certificate'), { token: staff })).json?.error?.code === 'JOB_NOT_COMPLETED');
  const done = await finish();
  check('P3 crew lead completes: job COMPLETED, order INSTALLED', done.status === 200 && done.json.data.status === 'COMPLETED' && done.json.data.orderStatus === 'INSTALLED' && done.json.data.unitsInstalled === 8, done.json);
  check('P3 signature hash is SHA-256', /^[0-9a-f]{64}$/.test(done.json.data?.signatureHash || ''));
  const logs = done.json.data?.timeLogs || [];
  check('P3 labour logged for 2 crew at their rates', logs.length === 2 && logs.some((l) => l.hourlyRate === 350) && logs.some((l) => l.hourlyRate === 300) && logs.every((l) => Math.abs(l.cost - Math.round(l.hours * l.hourlyRate * 100) / 100) < 0.01), logs);
  const jd2 = (await api('GET', J(''), { token: staff })).json.data;
  check('P3 after completion: integrity VERIFIED + certificate link', jd2.signatureIntegrity?.valid === true && jd2.certificateUrl && jd2.labourCost !== undefined, jd2.signatureIntegrity);
  const od3 = (await api('GET', `/orders/${oid}`, { token: staff })).json.data;
  check('P3 order INSTALLED, serials INSTALLED, warranties kept', od3.status === 'INSTALLED' && od3.serials.every((s) => s.status === 'INSTALLED') && od3.warranties.length === 8, [od3.status, od3.serials.map((s) => s.status)]);
  check('P3 complete twice 409', (await finish()).json?.error?.code === 'JOB_ALREADY_COMPLETED');
  check('P3 no photos after completion 409', (await photo('AFTER', 1)).json?.error?.code === 'JOB_ALREADY_COMPLETED');
  const cert = await api('GET', J('/certificate'), { token: tech2 });
  check('P3 completion certificate PDF', cert.status === 200 && cert.buf?.subarray(0, 4).toString() === '%PDF', cert.status);
  if (cert.buf) {
    const out = path.join(__dirname, '..', 'uploads', 'smoke-test-certificate.pdf');
    fs.writeFileSync(out, cert.buf);
    console.log('   certificate saved to', out);
  }
  check('P3 other staff cannot get the certificate 404', (await api('GET', J('/certificate'), { token: other })).status === 404);

  // reject path on seeded SURVEY_SUBMITTED lead + lost
  const seeded = (await api('GET', '/leads?status=SURVEY_SUBMITTED', { token: admin })).json.data.items[0];
  const seededDet = (await api('GET', `/leads/${seeded.id}`, { token: admin })).json.data;
  const rej = await api('PATCH', `/surveys/${seededDet.surveys[0].id}/review`, { token: admin, body: { decision: 'REJECT', note: 'Need meter photo' } });
  const afterRej = (await api('GET', `/leads/${seeded.id}`, { token: admin })).json.data.status;
  check('reject -> QUALIFIED', rej.status === 200 && afterRej === 'QUALIFIED', afterRej);
  const otherLost = await api('PATCH', `/leads/${seeded.id}/lost`, { token: otherToken(seeded), body: { reason: 'x' } });
  check('other staff mark lost 404', otherLost.status === 404, otherLost.json);
  const lost = await api('PATCH', `/leads/${seeded.id}/lost`, { token: ownerToken(seeded), body: { reason: 'Went with competitor' } });
  check('mark lost', lost.json.data?.status === 'LOST' && lost.json.data.lostReason, lost.json);
  const lost2 = await api('PATCH', `/leads/${seeded.id}/lost`, { token: ownerToken(seeded), body: { reason: 'x' } });
  check('lost is final 409', lost2.status === 409);

  // admin reassignment: ownership moves, timeline records it
  const staffReassign = await api('PATCH', `/leads/${lead.id}/assign`, { token: staff, body: { assignedTo: lead.assignedTo } });
  check('staff cannot reassign 403', staffReassign.status === 403);
  const otherId = Number(Object.keys(tokenById).find((id) => Number(id) !== lead.assignedTo));
  const re = await api('PATCH', `/leads/${lead.id}/assign`, { token: admin, body: { assignedTo: otherId } });
  check('admin reassigns lead', re.status === 200 && re.json.data.assignedTo === otherId, re.json);
  const reSame = await api('PATCH', `/leads/${lead.id}/assign`, { token: admin, body: { assignedTo: otherId } });
  check('reassign to same owner 409', reSame.status === 409);
  const newOwnerSees = await api('GET', `/leads/${lead.id}`, { token: other });
  const oldOwnerBlocked = await api('GET', `/leads/${lead.id}`, { token: staff });
  check('new owner sees, old owner 404', newOwnerSees.status === 200 && oldOwnerBlocked.status === 404,
    [newOwnerSees.status, oldOwnerBlocked.status]);
  check('reassign in timeline', newOwnerSees.json.data.activities.some((a) => a.type === 'ASSIGNED' && /Reassigned/.test(a.note)));
  const mine = await api('GET', '/leads?limit=100', { token: staffA });
  const myId = Number(Object.keys(tokenById).find((id) => tokenById[id] === staffA));
  check('staff inbox only own leads', mine.json.data.items.length > 0 && mine.json.data.items.every((l) => l.assignedTo === myId));
  // seed lead 9876500002 (Amit Verma) belongs to staff2 – staff1 must not learn which lead it is
  const leak = await api('POST', '/leads', { token: staffA, body: { customerName: 'Dup', phone: '9876500002' } });
  check('duplicate of colleague lead hides details', leak.status === 409 && !leak.json.error.details, leak.json);

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
