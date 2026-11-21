// Live-mode adapter: translates between the page/mock data shape (snake_case, mock field names)
// and the real Express API (camelCase JSON, see backend routes). Pages stay unchanged and the
// same screens work in both Mock and Live mode.

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_ORIGIN = new URL(API_BASE_URL).origin; // e.g. http://localhost:5000 (photos live at /uploads)

// ---------- generic key-case helpers ----------
const isPlainObject = (v) => v !== null && typeof v === 'object' && v.constructor === Object;
const camelKey = (k) => k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
const snakeKey = (k) => k.replace(/([A-Z])/g, '_$1').toLowerCase();

function mapKeys(value, fn) {
  if (Array.isArray(value)) return value.map((v) => mapKeys(v, fn));
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [fn(k), mapKeys(v, fn)]));
  }
  return value;
}
export const camelizeKeys = (v) => mapKeys(v, camelKey);
export const snakeizeKeys = (v) => mapKeys(v, snakeKey);

export const absUrl = (p) => (typeof p === 'string' && p.startsWith('/uploads/') ? `${API_ORIGIN}${p}` : p);

// UI source options -> backend enum
const SOURCE_MAP = { PHONE_INBOUND: 'PHONE', WEBSITE_ENQUIRY: 'WEBSITE', MANUAL_ENTRY: 'PHONE' };

// ---------- request adaptation ----------
function dataUrlToFile(dataUrl, idx) {
  const [meta, b64] = dataUrl.split(',');
  const mime = (meta.match(/data:(.*?);/) || [])[1] || 'image/jpeg';
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const ext = mime.split('/')[1] || 'jpg';
  return new File([bytes], `site-photo-${idx + 1}.${ext}`, { type: mime });
}

/** Returns { url, data, params, headers } ready for axios. `url` has no /api prefix. */
export function adaptRequest(method, url, data, params) {
  let body = data;
  let query = params;
  let headers;

  // Lead create (public form + manual entry)
  if ((url === '/public/enquiries' || url === '/leads') && method === 'post') {
    const { comments, source, ...rest } = data || {};
    body = camelizeKeys(rest);
    if (comments) body.message = comments;
    if (url === '/leads') body.source = SOURCE_MAP[source] || source || 'PHONE';
  }

  // Lead list: search -> q, ALL -> no filter, fetch a full page for the inbox
  else if (url === '/leads' && method === 'get') {
    query = { limit: 100 };
    if (params?.status && params.status !== 'ALL') query.status = params.status;
    if (params?.search) query.q = params.search;
  }

  // Schedule survey: datetime-local ("2026-11-22T10:30") -> ISO with the browser's timezone
  else if (/^\/leads\/\d+\/surveys$/.test(url) && method === 'post') {
    body = camelizeKeys(data);
    if (body.scheduledDate && body.scheduledDate.includes('T') && !/[zZ]|[+-]\d\d:?\d\d$/.test(body.scheduledDate)) {
      body.scheduledDate = new Date(body.scheduledDate).toISOString();
    }
  }

  // Survey review: { status: APPROVED|REJECTED, review_notes } -> { decision: APPROVE|REJECT, note }
  else if (/^\/surveys\/\d+\/review$/.test(url)) {
    body = {
      decision: data?.status === 'APPROVED' ? 'APPROVE' : 'REJECT',
      note: data?.review_notes || undefined,
    };
  }

  // Survey submit: JSON + base64 photos -> multipart/form-data with real files
  else if (/^\/surveys\/\d+\/submit$/.test(url)) {
    const fd = new FormData();
    const fields = {
      recommendedKw: data?.recommended_capacity_kw,
      roofType: data?.roof_type_confirmed,
      shading: data?.shading_analysis,
      structureType: data?.structure_type,
      cableRunMeters: data?.cable_run_meters,
      inverterLocation: data?.inverter_location,
      technicianNotes: data?.technician_remarks,
    };
    Object.entries(fields).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') fd.append(k, v);
    });
    (data?.photos || [])
      .filter((p) => typeof p === 'string' && p.startsWith('data:'))
      .forEach((p, i) => fd.append('photos', dataUrlToFile(p, i)));
    body = fd;
    headers = { 'Content-Type': 'multipart/form-data' };
  }

  // Create quote
  else if (/^\/leads\/\d+\/quotes$/.test(url) && method === 'post') {
    body = {
      templateId: data?.template_id,
      discountPct: data?.discount_percentage ?? 0,
      notes: data?.notes,
      ...(typeof data?.include_installation === 'boolean' ? { includeInstallation: data.include_installation } : {}),
    };
  }

  // Phase 2: Payments
  else if (/^\/orders\/\d+\/payments$/.test(url) && method === 'post') {
    body = {
      amount: Number(data?.amount),
      // no type -> the server infers it (ADVANCE before confirmation / FULL / BALANCE after)
      type: data?.type || undefined,
      mode: data?.mode || 'UPI',
      reference: data?.reference || undefined,
    };
  }

  // Phase 2: Stock Receive
  else if (url === '/inventory/receive' && method === 'post') {
    body = {
      productId: Number(data?.product_id || data?.productId),
      quantity: data?.quantity !== undefined ? Number(data.quantity) : undefined,
      serials: Array.isArray(data?.serials) ? data.serials : undefined,
    };
  }

  // Phase 2: Scan
  else if (/^\/orders\/\d+\/scan$/.test(url) && method === 'post') {
    body = { serialNumber: data?.serial_number || data?.serialNumber };
  }

  // Phase 2: Dispatch
  else if (/^\/orders\/\d+\/dispatch$/.test(url) && method === 'post') {
    body = {
      vehicleNo: data?.vehicle_no || data?.vehicleNo,
      driverName: data?.driver_name || data?.driverName,
    };
  }

  // Phase 2: Assign Job
  else if (/^\/jobs\/\d+\/assign$/.test(url) && method === 'patch') {
    body = {
      crewLeadId: Number(data?.crew_lead_id || data?.crewLeadId),
      scheduledDate: data?.scheduled_date || data?.scheduledDate,
    };
  }

  // Phase 3: job photos – FormData built by the page (stage + photos[]); let the browser set the boundary
  else if (/^\/jobs\/\d+\/photos$/.test(url) && data instanceof FormData) {
    headers = { 'Content-Type': 'multipart/form-data' };
  }

  // Phase 3: checklist – keys are UPPERCASE constants, send them untouched
  else if (/^\/jobs\/\d+\/checklist$/.test(url)) {
    body = { checklist: data?.checklist || data };
  }

  // Phase 3: complete – sign-off payload
  else if (/^\/jobs\/\d+\/complete$/.test(url) && method === 'post') {
    body = {
      confirmedCapacityKw: data?.confirmed_capacity_kw !== undefined ? Number(data.confirmed_capacity_kw) : undefined,
      generationReadingKw: data?.generation_reading_kw !== undefined ? Number(data.generation_reading_kw) : undefined,
      notes: data?.notes || data?.remarks || undefined,
      signedByName: data?.signed_by_name,
      signature: data?.signature,
    };
  }

  // Everything else: snake_case -> camelCase
  else if (data && !(data instanceof FormData)) {
    body = camelizeKeys(data);
  }

  return { url, data: body, params: query, headers };
}

// ---------- response adaptation ----------
function normalizeSurvey(s) {
  if (!s) return s;
  const out = {
    ...s,
    photos: (s.photos || []).map(absUrl),
    recommended_capacity_kw: s.recommended_kw,
    roof_type_confirmed: s.roof_type,
    shading_analysis: s.shading,
    technician_remarks: s.technician_notes,
    review_notes: s.review_note,
    reviewed_by: s.reviewed_by_name || s.reviewed_by,
    notes: s.assign_notes,
  };
  if (s.customer_name) {
    // /surveys/my returns lead columns flat – pages expect survey.lead.*
    out.lead = {
      id: s.lead_id,
      lead_code: s.lead_code,
      customer_name: s.customer_name,
      phone: s.phone,
      address: s.address,
      city: s.city,
      state: s.state,
      pincode: s.pincode,
      suggested_kw: s.suggested_kw,
      status: s.lead_status,
    };
  }
  return out;
}

function normalizeQuoteItem(i) {
  return { ...i, product_name: i.name, uom: i.unit, total_price: i.line_total };
}

function normalizeQuote(q) {
  if (!q) return q;
  const out = { ...q, total_amount: q.total };
  if (q.items) out.items = q.items.map(normalizeQuoteItem);
  if (q.customer_name) {
    out.lead = {
      id: q.lead_id,
      lead_code: q.lead_code,
      customer_name: q.customer_name,
      phone: q.customer_phone,
      email: q.customer_email,
      address: q.customer_address,
      city: q.customer_city,
      state: q.customer_state,
      pincode: q.customer_pincode,
      status: q.lead_status,
    };
  }
  return out;
}

function normalizeLead(l) {
  if (!l) return l;
  const q = l.qualification || {};
  const out = {
    ...l,
    qualification_data: Object.keys(q).length ? { ...q, qualifier_notes: q.notes } : null,
  };
  if (l.surveys) out.surveys = l.surveys.map(normalizeSurvey);
  if (l.quotes) out.quotes = l.quotes.map(normalizeQuote);
  if (l.activities) out.activities = l.activities.map((a) => ({ ...a, notes: a.note || a.type }));
  return out;
}

function normalizeTemplate(t) {
  return {
    ...t,
    base_price: t.estimated_total,
    items: (t.items || []).map((i) => ({ ...i, product_name: i.name, uom: i.unit })),
  };
}

// ---------- Phase 2 (orders, inventory, jobs): real API -> fields the Phase 2 pages read ----------
// Pick-list line: pages read item.product.{sku,name,category,is_serialized} + qty + scanned_serials
function normalizePickLine(l) {
  // bulk lines are not scanned: show them as picked when there is enough stock (server re-checks at dispatch)
  const bulkReady = !l.is_serialized && l.ready;
  return {
    ...l,
    qty_scanned: bulkReady ? l.qty_required : l.qty_scanned,
    product_name: l.name,
    scanned_serials: l.scanned_serials || [],
    product: { id: l.product_id, sku: l.sku, name: l.name, category: l.category, is_serialized: l.is_serialized, unit: l.unit },
  };
}
// API returns { lines, complete, ... }; pages expect a plain array of lines
const pickLines = (pl) => (Array.isArray(pl) ? pl : pl?.lines || []).map(normalizePickLine);

const leadFromFlat = (o) => ({
  id: o.lead_id,
  lead_code: o.lead_code,
  customer_name: o.customer_name,
  phone: o.phone,
  address: o.address,
  city: o.city,
  pincode: o.pincode,
});

function normalizeOrder(o) {
  if (!o) return o;
  const out = { ...o, lead: o.lead || leadFromFlat(o) };
  if (o.pick_list !== undefined) {
    out.pick_list = pickLines(o.pick_list);
    out.pick_list_summary = Array.isArray(o.pick_list) ? null : { ...o.pick_list, lines: undefined };
  }
  if (o.serials) out.scanned_serials = o.serials;
  if (o.installation_job !== undefined) out.job = o.installation_job;
  if (o.warranties) out.warranties = o.warranties.map((w) => ({ ...w, product_name: w.name }));
  if (o.payments) out.payments = o.payments.map((p) => ({ ...p, received_by: p.received_by_name || p.received_by }));
  return out;
}

const normalizeProduct = (p) => ({
  ...p,
  is_low_stock: p.low_stock,
  effective_stock: p.available,
  in_stock_serials_count: p.serials_in_stock,
  reserved_serials_count: p.serials_reserved,
});

const normalizeSerial = (s) => ({ ...s, product_name: s.name });

const normalizeJob = (j) => ({
  ...j,
  system_type: j.package_kind,
  lead: leadFromFlat(j),
  order: { id: j.order_id, order_number: j.order_number, status: j.order_status },
});

// Phase 3: job detail – photo + signature paths become absolute (they are served by the API host).
// The raw `checklist` object has UPPERCASE keys that snakeize mangles: pages use checklist_items instead.
function normalizeJobDetail(j) {
  if (!j) return j;
  const { checklist, ...rest } = j;
  return {
    ...normalizeJob(rest),
    photos: (j.photos || []).map((p) => ({ ...p, url: absUrl(p.path) })),
    signature_url: absUrl(j.signature_path),
    certificate_url: j.certificate_url ? `${API_ORIGIN}${j.certificate_url}` : null,
  };
}

function adaptPhase2(method, url, data) {
  if (url === '/orders' && method === 'get') return data.map(normalizeOrder);
  if (/^\/orders\/\d+$/.test(url)) return normalizeOrder(data);
  if (/^\/orders\/\d+\/pick-list$/.test(url)) return pickLines(data);
  if (/^\/orders\/\d+\/scan(\/.+)?$/.test(url)) {
    // scan -> { scanned, pick_list }, undo -> { released, pick_list }
    return { ...data, item: data.scanned || data.released, pick_list: pickLines(data.pick_list) };
  }
  if (/^\/orders\/\d+\/(payments|dispatch|deliver)$/.test(url)) {
    return { ...data, order: normalizeOrder(data.order) };
  }
  if (url === '/inventory' && method === 'get') return data.map(normalizeProduct);
  if (url === '/inventory/receive') {
    return {
      ...data,
      serialsCount: data.serials ? data.received : undefined,
      product: { sku: data.product, stock_qty: data.stock_qty },
    };
  }
  if (url === '/inventory/serials') return data.map(normalizeSerial);
  if ((url === '/jobs' || url === '/jobs/my') && method === 'get') return data.map(normalizeJob);
  if (/^\/jobs\/\d+$/.test(url) && method === 'get') return normalizeJobDetail(data);
  if (/^\/jobs\/\d+\/photos$/.test(url)) return { ...data, added: (data.added || []).map((p) => ({ ...p, url: absUrl(p.path) })) };
  return undefined;
}

/** body = backend envelope { success, data }; returns the envelope in the shape pages expect. */
export function adaptResponse(method, url, body) {
  if (!body || body.success === false || body.data === undefined) return body;
  const data = snakeizeKeys(body.data);

  if (url === '/public/enquiries') return { ...body, data: { ...data, id: data.lead_code } };

  if (url === '/leads' && method === 'get') {
    return { ...body, data: (data.items || []).map(normalizeLead), pagination: data.pagination, counts: data.counts };
  }
  if (/^\/leads(\/\d+)?$/.test(url)) return { ...body, data: normalizeLead(data) };
  if (/^\/leads\/\d+\/(qualify)$/.test(url)) return { ...body, data: normalizeLead(data.lead || data) };
  if (/^\/leads\/\d+\/surveys$/.test(url) || /^\/surveys\//.test(url)) {
    return { ...body, data: Array.isArray(data) ? data.map(normalizeSurvey) : normalizeSurvey(data) };
  }
  if (url === '/templates') return { ...body, data: data.map(normalizeTemplate) };
  if (/^\/leads\/\d+\/quotes$/.test(url) || /^\/quotes\/\d+(\/status)?$/.test(url)) {
    return { ...body, data: normalizeQuote(data) };
  }
  const phase2 = adaptPhase2(method, url, data);
  if (phase2 !== undefined) return { ...body, data: phase2 };
  return { ...body, data };
}
