import axios from 'axios';
import {
  initialUsers,
  initialLeads,
  initialPackageTemplates,
  initialQuotes,
  initialProducts,
  initialOrders,
  initialSerials,
  initialInstallationJobs
} from './mockData';
import { canTransition, LEAD_STATUS } from '../utils/leadStatus';
import { adaptRequest, adaptResponse } from './liveAdapter';
import { TOKEN_KEY, getStoredToken, getCurrentUser, makeMockToken } from '../utils/authToken';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Create base Axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Attach the JWT (it carries the user's id + role; the server verifies it on every call)
api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Expired / invalid token in Live mode -> clear the session and go to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    // API errors are { success:false, error:{ code, message } }; some pages read data.message /
    // data.code directly, so expose both shapes and every screen shows the server's real reason.
    const body = err.response?.data;
    if (body?.error && typeof body === 'object') {
      if (body.message === undefined) body.message = body.error.message;
      if (body.code === undefined) body.code = body.error.code;
    }
    const isLogin = err.config?.url?.includes('/auth/login');
    if (err.response?.status === 401 && !isLogin) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('sunpower_user');
      if (!window.location.pathname.startsWith('/login')) window.location.assign('/login');
    }
    return Promise.reject(err);
  },
);

// Mode State Management (Mock vs Live)
// Default to Live mode (real Express + PostgreSQL backend); Mock stays available from the navbar toggle.
const MOCK_STORAGE_KEY = 'sunpower_use_mock';
export function isMockMode() {
  const saved = localStorage.getItem(MOCK_STORAGE_KEY);
  if (saved === null) return false;
  return saved === 'true';
}

export function setMockMode(enabled) {
  localStorage.setItem(MOCK_STORAGE_KEY, enabled ? 'true' : 'false');
  window.dispatchEvent(new Event('sunpower_mode_changed'));
}

// In-Memory & LocalStorage persistent mock database
class MockDatabase {
  constructor() {
    this.init();
  }

  init() {
    try {
      const stored = localStorage.getItem('sunpower_mock_db');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.users = parsed.users || initialUsers;
        this.leads = parsed.leads || initialLeads;
        this.templates = parsed.templates || initialPackageTemplates;
        this.quotes = parsed.quotes || initialQuotes;
        this.products = parsed.products || initialProducts;
        this.orders = parsed.orders || initialOrders;
        this.serials = parsed.serials || initialSerials;
        this.jobs = parsed.jobs || initialInstallationJobs;
        return;
      }
    } catch (e) {
      console.warn('Failed to load mock DB from storage, resetting', e);
    }
    this.reset();
  }

  save() {
    try {
      localStorage.setItem('sunpower_mock_db', JSON.stringify({
        users: this.users,
        leads: this.leads,
        templates: this.templates,
        quotes: this.quotes,
        products: this.products,
        orders: this.orders,
        serials: this.serials,
        jobs: this.jobs,
      }));
    } catch (e) {
      console.error('Error saving mock database', e);
    }
  }

  reset() {
    this.users = JSON.parse(JSON.stringify(initialUsers));
    this.leads = JSON.parse(JSON.stringify(initialLeads));
    this.templates = JSON.parse(JSON.stringify(initialPackageTemplates));
    this.quotes = JSON.parse(JSON.stringify(initialQuotes));
    this.products = JSON.parse(JSON.stringify(initialProducts));
    this.orders = JSON.parse(JSON.stringify(initialOrders));
    this.serials = JSON.parse(JSON.stringify(initialSerials));
    this.jobs = JSON.parse(JSON.stringify(initialInstallationJobs));
    this.save();
  }
}

export const mockDb = new MockDatabase();

const MOCK_CHECKLIST = [
  ['STANDS_MOUNTED', 'Stands mounted'],
  ['PANELS_LAID', 'Panels laid'],
  ['WIRING_BOXES_CONNECTED', 'Wiring boxes (ACDB/DCDB) connected'],
  ['EARTHING_DONE', 'Earthing done'],
  ['GENERATION_TESTED', 'Generation tested'],
];

// Mock Dispatcher implementing the full frozen contract
async function mockRequest(method, url, data = null, params = null) {
  // Simulate network latency (150ms)
  await new Promise((r) => setTimeout(r, 150));

  const cleanUrl = url.replace(/^\/api/, '');
  const currentUser = getCurrentUser(); // decoded from the token, same as Live mode

  // 1. POST /auth/login
  if (cleanUrl === '/auth/login' && method === 'post') {
    const { email, password } = data;
    const user = mockDb.users.find((u) => u.email.toLowerCase() === (email || '').toLowerCase());
    if (user && (password === 'password123' || password === 'admin' || password === 'staff' || password === 'tech')) {
      const token = makeMockToken(user); // JWT-shaped, carries the role like the real one
      return {
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        },
      };
    }
    throw {
      response: {
        status: 401,
        data: { success: false, error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'Invalid email or password' } },
      },
    };
  }

  // 2. POST /public/enquiries
  if (cleanUrl === '/public/enquiries' && method === 'post') {
    // Auto-assign to staff with fewest leads
    const staffUsers = mockDb.users.filter((u) => u.role === 'STAFF' || u.role === 'ADMIN');
    const assignedUser = staffUsers[0] || { id: 2, name: 'Priya Verma' };

    const newLead = {
      id: Date.now(),
      customer_name: data.customer_name,
      email: data.email,
      phone: data.phone,
      address: data.address,
      city: data.city || 'Pune',
      state: data.state || 'Maharashtra',
      pincode: data.pincode,
      monthly_bill: Number(data.monthly_bill) || 0,
      roof_type: data.roof_type || 'Flat Concrete',
      roof_area_sqft: Number(data.roof_area_sqft) || 500,
      status: LEAD_STATUS.NEW,
      assigned_to_id: assignedUser.id,
      assigned_to_name: assignedUser.name,
      suggested_kw: null,
      qualification_data: null,
      source: 'WEBSITE_ENQUIRY',
      created_at: new Date().toISOString(),
      surveys: [],
      quotes: [],
      activities: [
        {
          id: Date.now(),
          lead_id: Date.now(),
          from_status: null,
          to_status: LEAD_STATUS.NEW,
          actor_name: 'Customer (Public Web)',
          actor_role: 'PUBLIC',
          notes: `Enquiry submitted online. Electricity Bill: ₹${data.monthly_bill}/mo. Auto-assigned to ${assignedUser.name}.`,
          created_at: new Date().toISOString(),
        },
      ],
    };

    mockDb.leads.unshift(newLead);
    mockDb.save();
    return { success: true, data: newLead };
  }

  // 3. GET /leads (list + search + status filter)
  if (cleanUrl === '/leads' && method === 'get') {
    let list = [...mockDb.leads];
    const status = params?.status;
    const search = params?.search?.toLowerCase();

    if (status && status !== 'ALL') {
      list = list.filter((l) => l.status === status);
    }
    if (search) {
      list = list.filter(
        (l) =>
          l.customer_name.toLowerCase().includes(search) ||
          l.phone.toLowerCase().includes(search) ||
          l.city?.toLowerCase().includes(search) ||
          String(l.id).includes(search)
      );
    }
    return { success: true, data: list };
  }

  // 4. POST /leads (manual entry)
  if (cleanUrl === '/leads' && method === 'post') {
    const staffUsers = mockDb.users.filter((u) => u.role === 'STAFF' || u.role === 'ADMIN');
    const assignedUser = staffUsers[0] || { id: 2, name: 'Priya Verma' };

    const newLead = {
      id: Date.now(),
      customer_name: data.customer_name,
      email: data.email,
      phone: data.phone,
      address: data.address,
      city: data.city || 'Pune',
      state: data.state || 'Maharashtra',
      pincode: data.pincode,
      monthly_bill: Number(data.monthly_bill) || 0,
      roof_type: data.roof_type || 'Flat Concrete',
      roof_area_sqft: Number(data.roof_area_sqft) || 500,
      status: LEAD_STATUS.NEW,
      assigned_to_id: assignedUser.id,
      assigned_to_name: assignedUser.name,
      suggested_kw: null,
      qualification_data: null,
      source: data.source || 'MANUAL_ENTRY',
      created_at: new Date().toISOString(),
      surveys: [],
      quotes: [],
      activities: [
        {
          id: Date.now(),
          lead_id: Date.now(),
          from_status: null,
          to_status: LEAD_STATUS.NEW,
          actor_name: currentUser?.name || 'Staff',
          actor_role: currentUser?.role || 'STAFF',
          notes: `Lead entered manually via CRM (${data.source || 'Phone/WhatsApp'}).`,
          created_at: new Date().toISOString(),
        },
      ],
    };

    mockDb.leads.unshift(newLead);
    mockDb.save();
    return { success: true, data: newLead };
  }

  // 5. GET /leads/:id
  const leadMatch = cleanUrl.match(/^\/leads\/(\d+)$/);
  if (leadMatch && method === 'get') {
    const leadId = Number(leadMatch[1]);
    const lead = mockDb.leads.find((l) => l.id === leadId);
    if (!lead) {
      throw { response: { status: 404, data: { success: false, error: { code: 'NOT_FOUND', message: 'Lead not found' } } } };
    }
    return { success: true, data: lead };
  }

  // 6. PATCH /leads/:id/qualify
  const qualifyMatch = cleanUrl.match(/^\/leads\/(\d+)\/qualify$/);
  if (qualifyMatch && method === 'patch') {
    const leadId = Number(qualifyMatch[1]);
    const lead = mockDb.leads.find((l) => l.id === leadId);
    if (!lead) throw { response: { status: 404, data: { success: false, error: { code: 'NOT_FOUND', message: 'Lead not found' } } } };

    if (!canTransition(lead.status, LEAD_STATUS.QUALIFIED)) {
      throw {
        response: {
          status: 409,
          data: { success: false, error: { code: 'INVALID_STATUS_TRANSITION', message: `Cannot transition lead from ${lead.status} to QUALIFIED` } },
        },
      };
    }

    const prevStatus = lead.status;
    lead.status = LEAD_STATUS.QUALIFIED;
    lead.suggested_kw = Number(data.suggested_kw) || 3.0;
    lead.qualification_data = {
      suggested_kw: lead.suggested_kw,
      sanctioned_load_kw: data.sanctioned_load_kw || (lead.suggested_kw * 1.2).toFixed(1),
      monthly_units: data.monthly_units || Math.round(lead.suggested_kw * 120),
      roof_viability: data.roof_viability || null,
      qualifier_notes: data.notes || 'Qualified based on consumption analysis.',
    };

    lead.activities.unshift({
      id: Date.now(),
      lead_id: lead.id,
      from_status: prevStatus,
      to_status: LEAD_STATUS.QUALIFIED,
      actor_name: currentUser?.name || 'Staff',
      actor_role: currentUser?.role || 'STAFF',
      notes: `Lead qualified for ${lead.suggested_kw} kW. Notes: ${data.notes || 'No remarks'}`,
      created_at: new Date().toISOString(),
    });

    mockDb.save();
    return { success: true, data: lead };
  }

  // 7. PATCH /leads/:id/lost
  const lostMatch = cleanUrl.match(/^\/leads\/(\d+)\/lost$/);
  if (lostMatch && method === 'patch') {
    const leadId = Number(lostMatch[1]);
    const lead = mockDb.leads.find((l) => l.id === leadId);
    if (!lead) throw { response: { status: 404, data: { success: false, error: { code: 'NOT_FOUND', message: 'Lead not found' } } } };

    if (!canTransition(lead.status, LEAD_STATUS.LOST)) {
      throw {
        response: {
          status: 409,
          data: { success: false, error: { code: 'INVALID_STATUS_TRANSITION', message: `Lead already closed (${lead.status})` } },
        },
      };
    }

    const prevStatus = lead.status;
    lead.status = LEAD_STATUS.LOST;
    lead.activities.unshift({
      id: Date.now(),
      lead_id: lead.id,
      from_status: prevStatus,
      to_status: LEAD_STATUS.LOST,
      actor_name: currentUser?.name || 'Staff',
      actor_role: currentUser?.role || 'STAFF',
      notes: `Lead marked as LOST. Reason: ${data.reason || 'Not specified'}`,
      created_at: new Date().toISOString(),
    });

    mockDb.save();
    return { success: true, data: lead };
  }

  // 8. POST /leads/:id/surveys (Assign technician + date)
  const assignSurveyMatch = cleanUrl.match(/^\/leads\/(\d+)\/surveys$/);
  if (assignSurveyMatch && method === 'post') {
    const leadId = Number(assignSurveyMatch[1]);
    const lead = mockDb.leads.find((l) => l.id === leadId);
    if (!lead) throw { response: { status: 404, data: { success: false, error: { code: 'NOT_FOUND', message: 'Lead not found' } } } };

    if (!canTransition(lead.status, LEAD_STATUS.SURVEY_SCHEDULED)) {
      throw {
        response: {
          status: 409,
          data: { success: false, error: { code: 'INVALID_STATUS_TRANSITION', message: `Cannot schedule survey for lead in status ${lead.status}` } },
        },
      };
    }

    const techUser = mockDb.users.find((u) => u.id === Number(data.technician_id)) || mockDb.users.find((u) => u.role === 'TECHNICIAN');
    const newSurvey = {
      id: Date.now(),
      lead_id: lead.id,
      technician_id: techUser.id,
      technician_name: techUser.name,
      scheduled_date: data.scheduled_date || new Date(Date.now() + 86400000).toISOString(),
      status: 'SCHEDULED',
      notes: data.notes || '',
      created_at: new Date().toISOString(),
    };

    const prevStatus = lead.status;
    lead.status = LEAD_STATUS.SURVEY_SCHEDULED;
    lead.surveys = lead.surveys || [];
    lead.surveys.unshift(newSurvey);

    lead.activities.unshift({
      id: Date.now(),
      lead_id: lead.id,
      from_status: prevStatus,
      to_status: LEAD_STATUS.SURVEY_SCHEDULED,
      actor_name: currentUser?.name || 'Staff',
      actor_role: currentUser?.role || 'STAFF',
      notes: `Survey scheduled with technician ${techUser.name} on ${new Date(newSurvey.scheduled_date).toLocaleDateString()}.`,
      created_at: new Date().toISOString(),
    });

    mockDb.save();
    return { success: true, data: newSurvey };
  }

  // 9. GET /surveys/my (technician surveys)
  if (cleanUrl === '/surveys/my' && method === 'get') {
    // Collect all surveys belonging to the logged-in technician (or all surveys if tech not matched)
    const techId = currentUser?.id;
    const allSurveys = [];
    mockDb.leads.forEach((l) => {
      (l.surveys || []).forEach((s) => {
        if (!techId || s.technician_id === techId || currentUser?.role !== 'TECHNICIAN') {
          allSurveys.push({
            ...s,
            lead: {
              id: l.id,
              customer_name: l.customer_name,
              phone: l.phone,
              address: l.address,
              city: l.city,
              state: l.state,
              pincode: l.pincode,
              suggested_kw: l.suggested_kw,
              status: l.status,
            },
          });
        }
      });
    });
    return { success: true, data: allSurveys };
  }

  // 10. PATCH /surveys/:id/submit (Technician submits survey with photos)
  const submitSurveyMatch = cleanUrl.match(/^\/surveys\/(\d+)\/submit$/);
  if (submitSurveyMatch && method === 'patch') {
    const surveyId = Number(submitSurveyMatch[1]);
    let targetLead = null;
    let targetSurvey = null;

    for (const lead of mockDb.leads) {
      const s = (lead.surveys || []).find((x) => x.id === surveyId);
      if (s) {
        targetLead = lead;
        targetSurvey = s;
        break;
      }
    }

    if (!targetSurvey) {
      throw { response: { status: 404, data: { success: false, error: { code: 'NOT_FOUND', message: 'Survey not found' } } } };
    }

    // Update survey fields
    targetSurvey.status = 'SUBMITTED';
    targetSurvey.recommended_capacity_kw = Number(data.recommended_capacity_kw) || targetLead.suggested_kw || 3.0;
    targetSurvey.roof_type_confirmed = data.roof_type_confirmed || targetLead.roof_type;
    targetSurvey.shading_analysis = data.shading_analysis || 'No significant shading observed.';
    targetSurvey.structure_type = data.structure_type || 'Elevated GI frame';
    targetSurvey.cable_run_meters = Number(data.cable_run_meters) || 25;
    targetSurvey.inverter_location = data.inverter_location || 'Near Main Distribution Box';
    targetSurvey.technician_remarks = data.technician_remarks || '';
    targetSurvey.photos = data.photos || [
      'https://images.unsplash.com/photo-1509391365360-2e959784a276?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1508873696983-2df5293cb395?w=800&auto=format&fit=crop&q=80',
    ];
    targetSurvey.submitted_at = new Date().toISOString();

    const prevStatus = targetLead.status;
    targetLead.status = LEAD_STATUS.SURVEY_SUBMITTED;

    targetLead.activities.unshift({
      id: Date.now(),
      lead_id: targetLead.id,
      from_status: prevStatus,
      to_status: LEAD_STATUS.SURVEY_SUBMITTED,
      actor_name: currentUser?.name || 'Technician',
      actor_role: 'TECHNICIAN',
      notes: `Survey completed & submitted with ${targetSurvey.photos.length} photos. Recommended: ${targetSurvey.recommended_capacity_kw} kW.`,
      created_at: new Date().toISOString(),
    });

    mockDb.save();
    return { success: true, data: targetSurvey };
  }

  // 11. PATCH /surveys/:id/review (Admin approves or rejects survey)
  const reviewSurveyMatch = cleanUrl.match(/^\/surveys\/(\d+)\/review$/);
  if (reviewSurveyMatch && method === 'patch') {
    const surveyId = Number(reviewSurveyMatch[1]);
    let targetLead = null;
    let targetSurvey = null;

    for (const lead of mockDb.leads) {
      const s = (lead.surveys || []).find((x) => x.id === surveyId);
      if (s) {
        targetLead = lead;
        targetSurvey = s;
        break;
      }
    }

    if (!targetSurvey) {
      throw { response: { status: 404, data: { success: false, error: { code: 'NOT_FOUND', message: 'Survey not found' } } } };
    }

    const { status: decision, review_notes } = data; // 'APPROVED' or 'REJECTED'
    const prevStatus = targetLead.status;

    if (decision === 'APPROVED') {
      targetSurvey.status = 'APPROVED';
      targetSurvey.review_notes = review_notes || 'Approved by Admin';
      targetSurvey.reviewed_by = currentUser?.name || 'Admin';
      targetSurvey.reviewed_at = new Date().toISOString();

      targetLead.status = LEAD_STATUS.SURVEY_APPROVED;
      targetLead.activities.unshift({
        id: Date.now(),
        lead_id: targetLead.id,
        from_status: prevStatus,
        to_status: LEAD_STATUS.SURVEY_APPROVED,
        actor_name: currentUser?.name || 'Admin',
        actor_role: 'ADMIN',
        notes: `Technical survey APPROVED. Remarks: ${review_notes || 'Looks viable.'}`,
        created_at: new Date().toISOString(),
      });
    } else {
      // Rejection returns lead to QUALIFIED according to the state machine
      targetSurvey.status = 'REJECTED';
      targetSurvey.review_notes = review_notes || 'Rejected by Admin. Re-survey required.';
      targetSurvey.reviewed_by = currentUser?.name || 'Admin';
      targetSurvey.reviewed_at = new Date().toISOString();

      targetLead.status = LEAD_STATUS.QUALIFIED;
      targetLead.activities.unshift({
        id: Date.now(),
        lead_id: targetLead.id,
        from_status: prevStatus,
        to_status: LEAD_STATUS.QUALIFIED,
        actor_name: currentUser?.name || 'Admin',
        actor_role: 'ADMIN',
        notes: `Survey REJECTED by Admin. Returned to QUALIFIED for re-scheduling. Remarks: ${review_notes}`,
        created_at: new Date().toISOString(),
      });
    }

    mockDb.save();
    return { success: true, data: targetSurvey };
  }

  // 12. GET /users?role=TECHNICIAN
  if (cleanUrl.startsWith('/users') && method === 'get') {
    const role = params?.role;
    let users = mockDb.users;
    if (role) {
      users = users.filter((u) => u.role.toUpperCase() === role.toUpperCase());
    }
    return { success: true, data: users };
  }

  // 13. GET /templates
  if (cleanUrl === '/templates' && method === 'get') {
    return { success: true, data: mockDb.templates };
  }

  // 14. POST /leads/:id/quotes (survey gate: 409 unless SURVEY_APPROVED; automatic BOM generation)
  const createQuoteMatch = cleanUrl.match(/^\/leads\/(\d+)\/quotes$/);
  if (createQuoteMatch && method === 'post') {
    const leadId = Number(createQuoteMatch[1]);
    const lead = mockDb.leads.find((l) => l.id === leadId);
    if (!lead) throw { response: { status: 404, data: { success: false, error: { code: 'NOT_FOUND', message: 'Lead not found' } } } };

    // Survey Gate: 409 unless SURVEY_APPROVED
    if (lead.status !== LEAD_STATUS.SURVEY_APPROVED) {
      throw {
        response: {
          status: 409,
          data: {
            success: false,
            error: {
              code: 'SURVEY_GATE_BLOCKED',
              message: `Quotation creation is blocked: Lead status is ${lead.status}. Survey must be APPROVED first!`,
            },
          },
        },
      };
    }

    const templateId = Number(data.template_id);
    const template = mockDb.templates.find((t) => t.id === templateId);
    if (!template) {
      throw { response: { status: 400, data: { success: false, error: { code: 'INVALID_TEMPLATE', message: 'Template not found' } } } };
    }

    // Automatically generate BOM items from template
    const quoteItems = template.items.map((item) => {
      const lineTotal = item.quantity * item.unit_price;
      return {
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: lineTotal,
        uom: item.uom,
      };
    });

    const subtotal = quoteItems.reduce((sum, item) => sum + item.total_price, 0);
    const discountPct = Number(data.discount_percentage) || 0;
    const discountAmount = Math.round((subtotal * discountPct) / 100);
    const taxableAmount = subtotal - discountAmount;
    const gstPct = 18.0;
    const gstAmount = Math.round((taxableAmount * gstPct) / 100);
    const totalAmount = taxableAmount + gstAmount;

    const newQuote = {
      id: Date.now(),
      lead_id: lead.id,
      template_id: template.id,
      template_name: template.name,
      capacity_kw: template.capacity_kw,
      system_type: template.system_type,
      subtotal,
      discount_pct: discountPct,
      discount_amount: discountAmount,
      taxable_amount: taxableAmount,
      gst_pct: gstPct,
      gst_amount: gstAmount,
      total_amount: totalAmount,
      status: 'SENT',
      valid_until: new Date(Date.now() + 30 * 86400000).toISOString(),
      notes: data.notes || `Formal proposal for ${template.name}`,
      created_at: new Date().toISOString(),
      items: quoteItems,
    };

    const prevStatus = lead.status;
    lead.status = LEAD_STATUS.QUOTED;
    lead.quotes = lead.quotes || [];
    lead.quotes.unshift(newQuote);

    lead.activities.unshift({
      id: Date.now(),
      lead_id: lead.id,
      from_status: prevStatus,
      to_status: LEAD_STATUS.QUOTED,
      actor_name: currentUser?.name || 'Staff',
      actor_role: currentUser?.role || 'STAFF',
      notes: `Quotation #${newQuote.id} generated for ${template.name} with automated BOM. Total: ₹${totalAmount.toLocaleString('en-IN')}`,
      created_at: new Date().toISOString(),
    });

    mockDb.quotes.unshift(newQuote);
    mockDb.save();
    return { success: true, data: newQuote };
  }

  // 15. GET /quotes/:id
  const quoteMatch = cleanUrl.match(/^\/quotes\/(\d+)$/);
  if (quoteMatch && method === 'get') {
    const quoteId = Number(quoteMatch[1]);
    const quote = mockDb.quotes.find((q) => q.id === quoteId);
    if (!quote) throw { response: { status: 404, data: { success: false, error: { code: 'NOT_FOUND', message: 'Quote not found' } } } };

    // Attach lead information
    const lead = mockDb.leads.find((l) => l.id === quote.lead_id);
    return { success: true, data: { ...quote, lead } };
  }

  // 16. PATCH /quotes/:id/status
  const quoteStatusMatch = cleanUrl.match(/^\/quotes\/(\d+)\/status$/);
  if (quoteStatusMatch && method === 'patch') {
    const quoteId = Number(quoteStatusMatch[1]);
    const quote = mockDb.quotes.find((q) => q.id === quoteId);
    if (!quote) throw { response: { status: 404, data: { success: false, error: { code: 'NOT_FOUND', message: 'Quote not found' } } } };

    const { status: newQuoteStatus } = data; // 'ACCEPTED', 'REJECTED', 'SENT'
    quote.status = newQuoteStatus;

    const lead = mockDb.leads.find((l) => l.id === quote.lead_id);
    if (lead) {
      if (newQuoteStatus === 'ACCEPTED' && lead.status !== LEAD_STATUS.WON) {
        const prevStatus = lead.status;
        lead.status = LEAD_STATUS.WON;
        lead.activities.unshift({
          id: Date.now(),
          lead_id: lead.id,
          from_status: prevStatus,
          to_status: LEAD_STATUS.WON,
          actor_name: currentUser?.name || 'Customer/Sales',
          actor_role: 'STAFF',
          notes: `Quote accepted by customer! Project marked as WON. Ready for installation.`,
          created_at: new Date().toISOString(),
        });

        // Phase 2: Auto-create Order when Quote is ACCEPTED
        mockDb.orders = mockDb.orders || [];
        const existingOrder = mockDb.orders.find((o) => o.quote_id === quote.id);
        if (!existingOrder) {
          const newOrderNumber = `ORD-${Date.now().toString().slice(-4)}`;
          const totalAmt = quote.total_amount || quote.total || 0;
          const advanceRequired = Math.round(totalAmt * 0.3 * 100) / 100;
          const newOrder = {
            id: Date.now(),
            order_number: newOrderNumber,
            lead_id: lead.id,
            quote_id: quote.id,
            status: 'PENDING_PAYMENT',
            total_amount: totalAmt,
            advance_required: advanceRequired,
            amount_paid: 0.0,
            created_at: new Date().toISOString(),
            lead: {
              id: lead.id,
              customer_name: lead.customer_name,
              phone: lead.phone,
              address: lead.address,
              city: lead.city,
              state: lead.state,
              pincode: lead.pincode,
            },
            payments: [],
            pick_list: [],
            dispatch: null,
            job: null,
            warranties: [],
          };
          mockDb.orders.unshift(newOrder);
        }
      } else if (newQuoteStatus === 'REJECTED' && lead.status !== LEAD_STATUS.LOST) {
        const prevStatus = lead.status;
        lead.status = LEAD_STATUS.LOST;
        lead.activities.unshift({
          id: Date.now(),
          lead_id: lead.id,
          from_status: prevStatus,
          to_status: LEAD_STATUS.LOST,
          actor_name: currentUser?.name || 'Customer/Sales',
          actor_role: 'STAFF',
          notes: `Quote rejected by customer. Lead marked as LOST.`,
          created_at: new Date().toISOString(),
        });
      }
    }

    mockDb.save();
    return { success: true, data: quote };
  }

  // 17. GET /quotes/:id/pdf (returns simulated URL or triggering printable view)
  const pdfMatch = cleanUrl.match(/^\/quotes\/(\d+)\/pdf$/);
  if (pdfMatch && method === 'get') {
    return { success: true, data: { pdf_url: `/quotes/${pdfMatch[1]}?print=true` } };
  }

  // =========================================================================
  // PHASE 2 MOCK ENDPOINTS (Orders, Payments, Inventory, Scanning, Dispatch)
  // =========================================================================

  // 18. GET /orders
  if (cleanUrl === '/orders' && method === 'get') {
    let list = [...(mockDb.orders || [])];
    const status = params?.status;
    const search = params?.search?.toLowerCase();
    if (status && status !== 'ALL') {
      list = list.filter((o) => o.status === status);
    }
    if (search) {
      list = list.filter(
        (o) =>
          o.order_number?.toLowerCase().includes(search) ||
          o.lead?.customer_name?.toLowerCase().includes(search) ||
          o.lead?.city?.toLowerCase().includes(search)
      );
    }
    return { success: true, data: list };
  }

  // 19. GET /orders/:id
  const orderMatch = cleanUrl.match(/^\/orders\/(\d+)$/);
  if (orderMatch && method === 'get') {
    const orderId = Number(orderMatch[1]);
    const order = (mockDb.orders || []).find((o) => o.id === orderId);
    if (!order) {
      throw { response: { status: 404, data: { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } } } };
    }
    return { success: true, data: order };
  }

  // 20. POST /orders/:id/payments
  const orderPaymentMatch = cleanUrl.match(/^\/orders\/(\d+)\/payments$/);
  if (orderPaymentMatch && method === 'post') {
    const orderId = Number(orderPaymentMatch[1]);
    const order = (mockDb.orders || []).find((o) => o.id === orderId);
    if (!order) {
      throw { response: { status: 404, data: { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } } } };
    }

    const payAmount = Number(data.amount) || 0;
    const newPayment = {
      id: Date.now(),
      order_id: order.id,
      amount: payAmount,
      type: data.type || 'ADVANCE',
      mode: data.mode || 'UPI',
      reference: data.reference || `REF-${Date.now().toString().slice(-6)}`,
      received_by: currentUser?.name || 'Staff',
      paid_at: new Date().toISOString(),
    };

    order.payments = order.payments || [];
    order.payments.unshift(newPayment);
    order.amount_paid = (order.amount_paid || 0) + payAmount;

    // Crossing advance threshold (30%) -> Order is CONFIRMED + Pick List + Job generated!
    let confirmedNow = false;
    if (order.amount_paid >= order.advance_required && order.status === 'PENDING_PAYMENT') {
      order.status = 'CONFIRMED';
      confirmedNow = true;

      // Build pick list from quote items
      const quote = (mockDb.quotes || []).find((q) => q.id === order.quote_id);
      if (quote && quote.items) {
        order.pick_list = quote.items
          .filter((i) => i.category !== 'SERVICE')
          .map((item, idx) => ({
            id: idx + 1,
            order_id: order.id,
            product_id: item.product_id,
            product_name: item.product_name,
            sku: item.sku,
            category: item.category,
            is_serialized: item.is_serialized !== false,
            qty_required: item.quantity,
            qty_scanned: item.is_serialized === false ? item.quantity : 0,
            scanned_serials: [],
          }));
      }

      // Automatically create installation job
      const newJob = {
        id: Date.now(),
        order_id: order.id,
        order_number: order.order_number,
        customer_name: order.lead?.customer_name,
        phone: order.lead?.phone,
        city: order.lead?.city,
        capacity_kw: quote?.capacity_kw || 3.0,
        system_type: quote?.system_type || 'ON_GRID',
        crew_lead_id: 3,
        crew_lead_name: 'Rohan Deshmukh',
        scheduled_date: new Date(Date.now() + 5 * 86400000).toISOString(),
        status: 'SCHEDULED',
      };
      order.job = newJob;
      mockDb.jobs = mockDb.jobs || [];
      mockDb.jobs.unshift(newJob);
    }

    mockDb.save();
    return { success: true, data: { payment: newPayment, order, confirmed: confirmedNow } };
  }

  // 21. GET /inventory
  if (cleanUrl === '/inventory' && method === 'get') {
    const products = (mockDb.products || []).map((p) => {
      const serials = (mockDb.serials || []).filter((s) => s.product_id === p.id);
      const in_stock_count = serials.filter((s) => s.status === 'IN_STOCK').length;
      const reserved_count = serials.filter((s) => s.status === 'RESERVED').length;
      const dispatched_count = serials.filter((s) => s.status === 'DISPATCHED' || s.status === 'DELIVERED').length;
      const effective_stock = p.is_serialized ? in_stock_count : (p.stock_qty || 0);
      const low_stock = effective_stock <= (p.reorder_level || 5);

      return {
        ...p,
        serials_in_stock: in_stock_count,
        serials_reserved: reserved_count,
        serials_dispatched: dispatched_count,
        effective_stock,
        low_stock,
      };
    });
    return { success: true, data: products };
  }

  // 22. POST /inventory/receive
  if (cleanUrl === '/inventory/receive' && method === 'post') {
    const prodId = Number(data.product_id || data.productId);
    const product = (mockDb.products || []).find((p) => p.id === prodId);
    if (!product) {
      throw { response: { status: 404, data: { success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } } } };
    }

    mockDb.serials = mockDb.serials || [];

    if (Array.isArray(data.serials) && data.serials.length > 0) {
      data.serials.forEach((sn) => {
        const cleanSn = String(sn).trim();
        if (cleanSn) {
          mockDb.serials.push({
            id: Date.now() + Math.random(),
            product_id: product.id,
            serial_number: cleanSn,
            status: 'IN_STOCK',
            order_id: null,
            received_at: new Date().toISOString(),
          });
        }
      });
      product.stock_qty = (product.stock_qty || 0) + data.serials.length;
    } else if (data.quantity) {
      product.stock_qty = (product.stock_qty || 0) + Number(data.quantity);
    }

    mockDb.save();
    return { success: true, data: { product, serials_received: data.serials?.length || data.quantity } };
  }

  // 23. GET /inventory/serials
  if (cleanUrl === '/inventory/serials' && method === 'get') {
    let serials = [...(mockDb.serials || [])];
    if (params?.productId) {
      serials = serials.filter((s) => s.product_id === Number(params.productId));
    }
    if (params?.status && params.status !== 'ALL') {
      serials = serials.filter((s) => s.status === params.status);
    }
    return { success: true, data: serials };
  }

  // 24. GET /orders/:id/pick-list
  const orderPickListMatch = cleanUrl.match(/^\/orders\/(\d+)\/pick-list$/);
  if (orderPickListMatch && method === 'get') {
    const orderId = Number(orderPickListMatch[1]);
    const order = (mockDb.orders || []).find((o) => o.id === orderId);
    if (!order) {
      throw { response: { status: 404, data: { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } } } };
    }
    return { success: true, data: order.pick_list || [] };
  }

  // 25. POST /orders/:id/scan (409 checks for demo rehearsal)
  const scanMatch = cleanUrl.match(/^\/orders\/(\d+)\/scan$/);
  if (scanMatch && method === 'post') {
    const orderId = Number(scanMatch[1]);
    const order = (mockDb.orders || []).find((o) => o.id === orderId);
    if (!order) throw { response: { status: 404, data: { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } } } };

    const sn = String(data.serialNumber || data.serial_number || '').trim();
    const serial = (mockDb.serials || []).find((s) => s.serial_number?.toUpperCase() === sn.toUpperCase());

    // Error 1: Serial not found
    if (!serial) {
      throw {
        response: {
          status: 409,
          data: { success: false, error: { code: 'SERIAL_NOT_FOUND', message: `Serial "${sn}" not found in inventory` } },
        },
      };
    }

    // Error 2: Already reserved or dispatched (Rehearsal Moment!)
    if (serial.status !== 'IN_STOCK') {
      throw {
        response: {
          status: 409,
          data: {
            success: false,
            error: {
              code: 'SERIAL_ALREADY_RESERVED',
              message: `Serial "${serial.serial_number}" is already ${serial.status} for ${serial.order_id || 'another order'}`,
            },
          },
        },
      };
    }

    // Error 3: Not on pick list
    const pickItem = (order.pick_list || []).find((item) => item.product_id === serial.product_id);
    if (!pickItem) {
      throw {
        response: {
          status: 409,
          data: {
            success: false,
            error: {
              code: 'NOT_ON_PICK_LIST',
              message: `Product for serial "${sn}" is not required on this order's pick list`,
            },
          },
        },
      };
    }

    // Error 4: Line already fully scanned
    if (pickItem.qty_scanned >= pickItem.qty_required) {
      throw {
        response: {
          status: 409,
          data: {
            success: false,
            error: {
              code: 'LINE_FULLY_SCANNED',
              message: `Item "${pickItem.product_name}" is already fully scanned (${pickItem.qty_scanned}/${pickItem.qty_required})`,
            },
          },
        },
      };
    }

    // Success: Reserve serial
    serial.status = 'RESERVED';
    serial.order_id = order.order_number;
    pickItem.qty_scanned = (pickItem.qty_scanned || 0) + 1;
    pickItem.scanned_serials = pickItem.scanned_serials || [];
    pickItem.scanned_serials.push(serial.serial_number);

    mockDb.save();
    return { success: true, data: { pick_list: order.pick_list, scanned: serial } };
  }

  // 26. DELETE /orders/:id/scan/:serialNumber (Undo scan)
  const undoScanMatch = cleanUrl.match(/^\/orders\/(\d+)\/scan\/(.+)$/);
  if (undoScanMatch && method === 'delete') {
    const orderId = Number(undoScanMatch[1]);
    const sn = decodeURIComponent(undoScanMatch[2]).trim();
    const order = (mockDb.orders || []).find((o) => o.id === orderId);
    if (!order) throw { response: { status: 404, data: { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } } } };

    const serial = (mockDb.serials || []).find((s) => s.serial_number?.toUpperCase() === sn.toUpperCase());
    if (serial) {
      serial.status = 'IN_STOCK';
      serial.order_id = null;
    }

    (order.pick_list || []).forEach((item) => {
      if ((item.scanned_serials || []).some((s) => s.toUpperCase() === sn.toUpperCase())) {
        item.scanned_serials = item.scanned_serials.filter((s) => s.toUpperCase() !== sn.toUpperCase());
        item.qty_scanned = Math.max(0, item.qty_scanned - 1);
      }
    });

    mockDb.save();
    return { success: true, data: { pick_list: order.pick_list, undone: sn } };
  }

  // 27. POST /orders/:id/dispatch
  const dispatchMatch = cleanUrl.match(/^\/orders\/(\d+)\/dispatch$/);
  if (dispatchMatch && method === 'post') {
    const orderId = Number(dispatchMatch[1]);
    const order = (mockDb.orders || []).find((o) => o.id === orderId);
    if (!order) throw { response: { status: 404, data: { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } } } };

    // Check pick list completion
    const incomplete = (order.pick_list || []).some((i) => i.qty_scanned < i.qty_required);
    if (incomplete) {
      throw {
        response: {
          status: 409,
          data: {
            success: false,
            error: {
              code: 'PICK_LIST_INCOMPLETE',
              message: 'Cannot dispatch: Pick list is incomplete. All items must be fully scanned or picked.',
            },
          },
        },
      };
    }

    // Mark serials DISPATCHED and decrement bulk stock
    (order.pick_list || []).forEach((item) => {
      if (item.is_serialized) {
        (item.scanned_serials || []).forEach((sn) => {
          const s = (mockDb.serials || []).find((x) => x.serial_number === sn);
          if (s) s.status = 'DISPATCHED';
        });
      } else {
        const prod = (mockDb.products || []).find((p) => p.id === item.product_id);
        if (prod) prod.stock_qty = Math.max(0, (prod.stock_qty || 0) - item.qty_required);
      }
    });

    order.status = 'DISPATCHED';
    order.dispatch = {
      id: Date.now(),
      order_id: order.id,
      vehicle_no: data.vehicleNo || data.vehicle_no || 'MH 12 Solar 01',
      driver_name: data.driverName || data.driver_name || 'Driver',
      dispatched_at: new Date().toISOString(),
      dispatched_by: currentUser?.name || 'Staff',
      delivered_at: null,
      delivered_confirmed_by: null,
    };

    mockDb.save();
    return { success: true, data: order };
  }

  // 33. GET /orders/revenue-analytics
  if (cleanUrl === '/orders/revenue-analytics' && method === 'get') {
    const ordersList = mockDb.orders || [];
    let totalContracted = 0;
    let totalCollected = 0;
    let totalReceivables = 0;
    let completedCount = 0;
    let activePipelineCount = 0;

    const detailedOrders = ordersList.map((o) => {
      const revenue = Number(o.total_amount || 0);
      const paid = Number(o.amount_paid || 0);
      const balance = Math.max(0, revenue - paid);
      totalContracted += revenue;
      totalCollected += paid;
      totalReceivables += balance;

      if (o.status === 'INSTALLED') completedCount++;
      else if (['CONFIRMED', 'DISPATCHED', 'DELIVERED'].includes(o.status)) activePipelineCount++;

      // Hardware costs
      const serials = (mockDb.serials || []).filter((s) => s.order_id === o.id);
      const hardwareCost = serials.reduce((sum, s) => sum + Number(s.purchase_cost || 0), 0) || Math.round(revenue * 0.62);
      const labourCost = Math.round(revenue * 0.10);
      const totalCost = hardwareCost + labourCost;
      const grossProfit = Math.max(0, revenue - totalCost);
      const marginPct = revenue > 0 ? Math.round((grossProfit / revenue) * 100) : 0;

      return {
        ...o,
        customer_name: o.lead?.customer_name,
        city: o.lead?.city,
        capacity_kw: o.quote?.capacity_kw || 3.0,
        package_kind: o.quote?.package_kind || 'ON_GRID',
        hardware_cost: hardwareCost,
        labour_cost: labourCost,
        total_cost: totalCost,
        gross_profit: grossProfit,
        margin_pct: marginPct,
      };
    });

    const packageBreakdown = {};
    detailedOrders.forEach((o) => {
      const k = o.package_kind || 'ON_GRID';
      if (!packageBreakdown[k]) {
        packageBreakdown[k] = { count: 0, revenue: 0, capacity_kw: 0 };
      }
      packageBreakdown[k].count++;
      packageBreakdown[k].revenue += o.total_amount;
      packageBreakdown[k].capacity_kw += o.capacity_kw;
    });

    return {
      success: true,
      data: {
        totals: {
          total_contracted_revenue: totalContracted,
          total_cash_collected: totalCollected,
          total_receivables: totalReceivables,
          total_orders: ordersList.length,
          completed_projects: completedCount,
          active_pipeline_projects: activePipelineCount,
        },
        orders: detailedOrders,
        packageBreakdown,
      },
    };
  }

  // 34. GET /public/portal/:orderNumber
  const portalMatch = cleanUrl.match(/^\/public\/portal\/([A-Za-z0-9\-_]+)$/);
  if (portalMatch && method === 'get') {
    const rawNumber = portalMatch[1].toUpperCase();
    const order = (mockDb.orders || []).find(
      (o) => o.order_number?.toUpperCase() === rawNumber || String(o.id) === rawNumber
    );
    if (!order) {
      throw { response: { status: 404, data: { success: false, error: { code: 'NOT_FOUND', message: 'Project order not found.' } } } };
    }

    const serials = (mockDb.serials || []).filter((s) => s.order_id === order.id).map((s) => {
      const prod = (mockDb.products || []).find((p) => p.id === s.product_id);
      return {
        serial_number: s.serial_number,
        status: s.status,
        product_name: prod?.name || s.product_name,
        category: prod?.category || s.category,
        warranty_months: prod?.warranty_months || 24,
      };
    });

    const warranties = order.warranties || [];
    const payments = order.payments || [];
    const job = order.job || (mockDb.jobs || []).find((j) => j.order_id === order.id);

    return {
      success: true,
      data: {
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        total_amount: order.total_amount,
        advance_required: order.advance_required,
        amount_paid: order.amount_paid,
        created_at: order.created_at,
        customer_name: order.lead?.customer_name,
        city: order.lead?.city,
        address: order.lead?.address,
        phone: order.lead?.phone,
        quote_id: order.quote_id,
        quote_number: order.quote?.quote_number || `QUO-${order.quote_id}`,
        capacity_kw: order.quote?.capacity_kw || 3.0,
        package_kind: order.quote?.package_kind || 'ON_GRID',
        job_id: job?.id,
        job_status: job?.status,
        scheduled_date: job?.scheduled_date,
        started_at: job?.started_at,
        finished_at: job?.finished_at,
        customer_rating: job?.customer_rating,
        customer_feedback: job?.customer_feedback,
        vehicle_no: order.dispatch?.vehicle_no,
        driver_name: order.dispatch?.driver_name,
        dispatched_at: order.dispatch?.dispatched_at,
        delivered_at: order.dispatch?.delivered_at,
        serials,
        warranties,
        payments,
      },
    };
  }

  // 35. POST /public/portal/:orderNumber/feedback
  const portalFeedbackMatch = cleanUrl.match(/^\/public\/portal\/([A-Za-z0-9\-_]+)\/feedback$/);
  if (portalFeedbackMatch && method === 'post') {
    const rawNumber = portalFeedbackMatch[1].toUpperCase();
    const order = (mockDb.orders || []).find(
      (o) => o.order_number?.toUpperCase() === rawNumber || String(o.id) === rawNumber
    );
    if (!order) throw { response: { status: 404, data: { success: false, message: 'Order not found' } } };

    const job = order.job || (mockDb.jobs || []).find((j) => j.order_id === order.id);
    if (job) {
      job.customer_rating = Number(data.rating);
      job.customer_feedback = data.feedback;
    }
    if (order.job) {
      order.job.customer_rating = Number(data.rating);
      order.job.customer_feedback = data.feedback;
    }
    mockDb.save();
    return { success: true, data: { customer_rating: Number(data.rating), customer_feedback: data.feedback } };
  }

  // 28. POST /orders/:id/deliver
  const deliverMatch = cleanUrl.match(/^\/orders\/(\d+)\/deliver$/);
  if (deliverMatch && method === 'post') {
    const orderId = Number(deliverMatch[1]);
    const order = (mockDb.orders || []).find((o) => o.id === orderId);
    if (!order) throw { response: { status: 404, data: { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } } } };

    order.status = 'DELIVERED';
    order.dispatch = order.dispatch || {};
    order.dispatch.delivered_at = new Date().toISOString();
    order.dispatch.delivered_confirmed_by = currentUser?.name || 'Technician';

    // Start warranty for every serial
    order.warranties = order.warranties || [];
    (order.pick_list || []).forEach((item) => {
      const prod = (mockDb.products || []).find((p) => p.id === item.product_id);
      (item.scanned_serials || []).forEach((sn) => {
        const ser = (mockDb.serials || []).find((x) => x.serial_number === sn);
        if (ser) ser.status = 'DELIVERED';

        const months = prod?.warranty_months || (prod?.category === 'PANEL' ? 240 : 24);
        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + months);

        order.warranties.push({
          id: Date.now() + Math.random(),
          inventory_item_id: ser?.id || 1,
          serial_number: sn,
          product_name: item.product_name,
          category: item.category,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          months,
        });
      });
    });

    mockDb.save();
    return { success: true, data: order };
  }

  // 29. GET /jobs
  if (cleanUrl === '/jobs' && method === 'get') {
    let list = mockDb.jobs || [];
    if (currentUser?.role === 'TECHNICIAN') {
      list = list.filter((j) => Number(j.crew_lead_id) === Number(currentUser.id));
    }
    return { success: true, data: list };
  }

  // 30. PATCH /jobs/:id/assign
  const jobAssignMatch = cleanUrl.match(/^\/jobs\/(\d+)\/assign$/);
  if (jobAssignMatch && method === 'patch') {
    const jobId = Number(jobAssignMatch[1]);
    const job = (mockDb.jobs || []).find((j) => j.id === jobId);
    if (!job) throw { response: { status: 404, data: { success: false, error: { code: 'NOT_FOUND', message: 'Job not found' } } } };

    const techId = Number(data.crewLeadId || data.crew_lead_id);
    const tech = (mockDb.users || []).find((u) => u.id === techId);
    if (tech) {
      job.crew_lead_id = tech.id;
      job.crew_lead_name = tech.name;
    }
    if (data.scheduledDate || data.scheduled_date) {
      job.scheduled_date = data.scheduledDate || data.scheduled_date;
    }

    // Also sync the order's job object so OrderDetail reflects assignment immediately
    const order = (mockDb.orders || []).find((o) => o.id === job.order_id);
    if (order) {
      order.job = { ...(order.job || {}), ...job };
      order.installation_job = { ...(order.installation_job || {}), ...job };
    }

    mockDb.save();
    return { success: true, data: job };
  }

  // ---------- Phase 3: on-site installation (mirrors backend installation.service) ----------
  const jobErr = (status, code, message, details) => ({
    response: { status, data: { success: false, message, code, error: { code, message, details } } },
  });
  const findJob = (id) => {
    const job = (mockDb.jobs || []).find((j) => j.id === Number(id));
    if (!job) throw jobErr(404, 'NOT_FOUND', 'Job not found');
    if (currentUser?.role === 'TECHNICIAN' && Number(job.crew_lead_id) !== Number(currentUser.id)
        && !(job.crew_ids || []).includes(Number(currentUser.id))) throw jobErr(404, 'NOT_FOUND', 'Job not found');
    return job;
  };
  const mockJobView = (job) => {
    const order = (mockDb.orders || []).find((o) => o.id === job.order_id) || {};
    const lead = order.lead || {};
    const verified = job.verified_serials || [];
    const fromInventory = (mockDb.serials || []).filter((s) => s.order_id === job.order_id);
    const source = fromInventory.length ? fromInventory : order.scanned_serials?.length ? order.scanned_serials : order.warranties || [];
    const serials = source.map((s) => ({
      serial_number: s.serial_number,
      name: s.product_name || s.name,
      category: s.category,
      verified: verified.includes(s.serial_number),
    }));
    const checklist = job.checklist || {};
    const photos = job.photos || [];
    const isLead = Number(job.crew_lead_id) === Number(currentUser?.id);
    return {
      ...job,
      customer_name: job.customer_name || lead.customer_name,
      phone: job.phone || lead.phone,
      address: lead.address,
      city: job.city || lead.city,
      pincode: lead.pincode,
      lead: { ...lead, customer_name: job.customer_name || lead.customer_name },
      order: { id: order.id, order_number: order.order_number, status: order.status },
      order_status: order.status,
      maps_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([lead.address, lead.city, lead.pincode].filter(Boolean).join(', '))}`,
      crew: job.crew || [{ id: job.crew_lead_id, name: job.crew_lead_name, is_lead: true }],
      is_lead: isLead,
      you: { is_lead: isLead, is_crew: true, can_start: currentUser?.role === 'ADMIN' || isLead },
      checklist_items: MOCK_CHECKLIST.map(([key, label]) => ({ key, label, done: !!checklist[key] })),
      serials,
      serials_progress: {
        expected: serials.length,
        verified: serials.filter((s) => s.verified).length,
        missing: serials.filter((s) => !s.verified).map((s) => s.serial_number),
      },
      serials_expected: serials.length,
      serials_verified: serials.filter((s) => s.verified).length,
      photos,
      after_photos: photos.filter((p) => p.stage === 'AFTER').length,
      min_after_photos: 2,
      signature_url: job.signature_data || null,
      signature_integrity: job.status === 'COMPLETED' ? { valid: true } : null,
      certificate_url: job.status === 'COMPLETED' ? 'mock' : null,
    };
  };

  // 31a. GET /jobs/my (technician's jobs)
  if (cleanUrl === '/jobs/my' && method === 'get') {
    const mine = (mockDb.jobs || []).filter((j) => j.status !== 'COMPLETED' && (Number(j.crew_lead_id) === Number(currentUser?.id)
      || (j.crew_ids || []).includes(Number(currentUser?.id))));
    return { success: true, data: mine.map(mockJobView) };
  }

  // 31b. GET /jobs/:id (detail)
  const jobDetailMatch = cleanUrl.match(/^\/jobs\/(\d+)$/);
  if (jobDetailMatch && method === 'get') {
    return { success: true, data: mockJobView(findJob(jobDetailMatch[1])) };
  }

  // 31c. POST /jobs/:id/start
  const jobStartMatch = cleanUrl.match(/^\/jobs\/(\d+)\/start$/);
  if (jobStartMatch && method === 'post') {
    const job = findJob(jobStartMatch[1]);
    const view = mockJobView(job);
    if (!view.you.can_start) throw jobErr(403, 'FORBIDDEN', 'Only the crew lead or an admin can start the job');
    if (job.status === 'COMPLETED') throw jobErr(409, 'JOB_ALREADY_COMPLETED', 'Job is already completed');
    if (job.status === 'IN_PROGRESS') throw jobErr(409, 'JOB_ALREADY_STARTED', 'Job was already started');
    if (!['DELIVERED', 'INSTALLED'].includes(view.order_status)) {
      throw jobErr(409, 'ORDER_NOT_DELIVERED', `Order ${view.order?.order_number} is ${view.order_status}; materials must be DELIVERED before starting`);
    }
    job.status = 'IN_PROGRESS';
    job.started_at = new Date().toISOString();
    mockDb.save();
    return { success: true, data: { id: job.id, status: job.status, started_at: job.started_at } };
  }

  // 31d. PATCH /jobs/:id/checklist
  const jobChecklistMatch = cleanUrl.match(/^\/jobs\/(\d+)\/checklist$/);
  if (jobChecklistMatch && method === 'patch') {
    const job = findJob(jobChecklistMatch[1]);
    if (job.status !== 'IN_PROGRESS') throw jobErr(409, 'JOB_NOT_IN_PROGRESS', 'Start the job before ticking the checklist');
    job.checklist = { ...(job.checklist || {}), ...(data?.checklist || data || {}) };
    mockDb.save();
    return { success: true, data: { id: job.id, checklist: job.checklist } };
  }

  // 31e. POST /jobs/:id/photos (FormData: stage + photos[]; object URLs, not kept across reloads)
  const jobPhotosMatch = cleanUrl.match(/^\/jobs\/(\d+)\/photos$/);
  if (jobPhotosMatch && method === 'post') {
    const job = findJob(jobPhotosMatch[1]);
    if (job.status !== 'IN_PROGRESS') throw jobErr(409, 'JOB_NOT_IN_PROGRESS', 'Start the job before adding photos');
    const stage = data?.get?.('stage');
    const files = data?.getAll?.('photos') || [];
    if (!['BEFORE', 'DURING', 'AFTER'].includes(stage)) throw jobErr(400, 'VALIDATION_ERROR', 'stage is required');
    if (!files.length) throw jobErr(400, 'VALIDATION_ERROR', 'Add at least one photo');
    job.photos = job.photos || [];
    const added = files.map((f, i) => ({
      id: Date.now() + i,
      stage,
      url: URL.createObjectURL(f),
      path: f.name,
      uploaded_at: new Date().toISOString(),
      uploaded_by_name: currentUser?.name,
    }));
    job.photos.push(...added);
    mockDb.save();
    return { success: true, data: { added, min_after_photos: 2 } };
  }

  // 31f. POST /jobs/:id/serials/verify
  const jobVerifyMatch = cleanUrl.match(/^\/jobs\/(\d+)\/serials\/verify$/);
  if (jobVerifyMatch && method === 'post') {
    const job = findJob(jobVerifyMatch[1]);
    if (job.status !== 'IN_PROGRESS') throw jobErr(409, 'JOB_NOT_IN_PROGRESS', 'Start the job before verifying serials');
    const serial = String(data?.serialNumber || data?.serial_number || '').trim().toUpperCase();
    const view = mockJobView(job);
    const hit = view.serials.find((s) => s.serial_number.toUpperCase() === serial);
    if (!hit) throw jobErr(409, 'SERIAL_NOT_ON_ORDER', `Serial ${serial} is not on order ${view.order?.order_number}`);
    if (hit.verified) throw jobErr(409, 'SERIAL_ALREADY_VERIFIED', `Serial ${serial} is already verified on this job`);
    job.verified_serials = [...(job.verified_serials || []), hit.serial_number];
    mockDb.save();
    return { success: true, data: { serial_number: hit.serial_number, name: hit.name } };
  }

  // 31g. POST /jobs/:id/complete (all completion gates + signature)
  const jobCompleteMatch = cleanUrl.match(/^\/jobs\/(\d+)\/complete$/);
  if (jobCompleteMatch && method === 'post') {
    const job = findJob(jobCompleteMatch[1]);
    const view = mockJobView(job);
    if (!view.you.can_start) throw jobErr(403, 'FORBIDDEN', 'Only the crew lead or an admin can complete the job');
    if (job.status !== 'IN_PROGRESS') throw jobErr(409, 'JOB_NOT_IN_PROGRESS', 'Start the job first');
    const missingItems = view.checklist_items.filter((i) => !i.done).map((i) => i.label);
    if (missingItems.length) throw jobErr(409, 'CHECKLIST_INCOMPLETE', `Checklist incomplete: ${missingItems.join(', ')}`);
    if (view.after_photos < 2) throw jobErr(409, 'NOT_ENOUGH_AFTER_PHOTOS', `Upload at least 2 AFTER photos (${view.after_photos} so far)`);
    if (view.serials_progress.missing.length) {
      throw jobErr(409, 'SERIALS_NOT_VERIFIED',
        `${view.serials_progress.missing.length} serial(s) not verified on site: ${view.serials_progress.missing.join(', ')}`);
    }
    if (Number(data?.confirmed_capacity_kw) !== Number(job.capacity_kw)) {
      throw jobErr(409, 'CAPACITY_MISMATCH', `Confirmed capacity ${data?.confirmed_capacity_kw} kW does not match the ordered ${job.capacity_kw} kW`);
    }
    if (!data?.signed_by_name || !String(data?.signature || '').startsWith('data:image/png')) {
      throw jobErr(400, 'SIGNATURE_MISSING', 'Customer name and signature are required');
    }
    const now = new Date().toISOString();
    Object.assign(job, {
      status: 'COMPLETED',
      completed_at: now,
      finished_at: now,
      signed_at: now,
      signed_by_name: data.signed_by_name,
      signature_data: data.signature,
      confirmed_capacity_kw: Number(data.confirmed_capacity_kw),
      generation_reading_kw: Number(data.generation_reading_kw),
      notes: data.notes || data.remarks || job.notes,
    });

    // Update matching order to INSTALLED
    const order = (mockDb.orders || []).find((o) => o.id === job.order_id);
    if (order) {
      order.status = 'INSTALLED';
      if (order.job) order.job.status = 'COMPLETED';
      if (order.installation_job) order.installation_job.status = 'COMPLETED';
      (order.scanned_serials || []).forEach((s) => {
        s.status = 'INSTALLED';
      });
    }
    (mockDb.serials || []).forEach((s) => {
      if (s.order_id === job.order_id) s.status = 'INSTALLED';
    });

    mockDb.save();
    return { success: true, data: { id: job.id, status: job.status, completed_at: now, certificate_url: 'mock' } };
  }

  // 32. POST /orders/:id/install
  const orderInstallMatch = cleanUrl.match(/^\/orders\/(\d+)\/install$/);
  if (orderInstallMatch && method === 'post') {
    const orderId = Number(orderInstallMatch[1]);
    const order = (mockDb.orders || []).find((o) => o.id === orderId);
    if (!order) throw { response: { status: 404, data: { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } } } };

    order.status = 'INSTALLED';
    if (order.job) order.job.status = 'COMPLETED';
    if (order.installation_job) order.installation_job.status = 'COMPLETED';

    const job = (mockDb.jobs || []).find((j) => j.order_id === orderId);
    if (job) job.status = 'COMPLETED';

    if (order.scanned_serials) {
      order.scanned_serials.forEach((s) => {
        s.status = 'INSTALLED';
      });
    }
    (mockDb.serials || []).forEach((s) => {
      if (s.order_id === orderId) {
        s.status = 'INSTALLED';
      }
    });

    mockDb.save();
    return { success: true, data: order };
  }

  throw {
    response: {
      status: 404,
      data: { success: false, error: { code: 'ENDPOINT_NOT_FOUND', message: `Mock endpoint not found: ${method.toUpperCase()} ${cleanUrl}` } },
    },
  };
}

// Live request: pages call '/api/...' but axios baseURL already ends in /api, so strip it,
// then translate the request/response shapes (see liveAdapter.js).
async function liveRequest(method, url, data, config = {}) {
  const cleanUrl = url.replace(/^\/api(?=\/)/, '');
  const req = adaptRequest(method, cleanUrl, data, config.params);
  const res = await api.request({
    ...config,
    method,
    url: req.url,
    data: req.data ?? undefined, // never send a literal "null" body (the server's JSON parser rejects it)
    params: req.params,
    headers: { ...(config.headers || {}), ...(req.headers || {}) },
  });
  return adaptResponse(method, cleanUrl, res.data);
}

// Unified client proxy that checks isMockMode()
export const apiClient = {
  async get(url, config = {}) {
    if (isMockMode()) return mockRequest('get', url, null, config.params);
    return liveRequest('get', url, null, config);
  },

  async post(url, data, config = {}) {
    if (isMockMode()) return mockRequest('post', url, data, config.params);
    return liveRequest('post', url, data, config);
  },

  async patch(url, data, config = {}) {
    if (isMockMode()) return mockRequest('patch', url, data, config.params);
    return liveRequest('patch', url, data, config);
  },

  async delete(url, config = {}) {
    if (isMockMode()) return mockRequest('delete', url, null, config.params);
    return liveRequest('delete', url, null, config);
  },
};

/** Opens the server-generated quote PDF (Live) or the browser print view (Mock). */
export async function openQuotePdf(quoteId, fileName = `quote-${quoteId}.pdf`) {
  if (isMockMode()) {
    window.print();
    return;
  }
  const res = await api.get(`/quotes/${quoteId}/pdf`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Downloads the installation completion certificate PDF (Live) or opens the print view (Mock). */
export async function openJobCertificate(jobId, fileName = `installation-certificate-job-${jobId}.pdf`) {
  if (isMockMode()) {
    window.print();
    return;
  }
  const res = await api.get(`/jobs/${jobId}/certificate`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default apiClient;
