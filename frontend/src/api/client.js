import axios from 'axios';
import { initialUsers, initialLeads, initialPackageTemplates, initialQuotes, initialProducts } from './mockData';
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
    this.save();
  }
}

export const mockDb = new MockDatabase();

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
    data: req.data,
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

export default apiClient;
