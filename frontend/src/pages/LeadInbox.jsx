import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { formatCurrency, formatDate, formatKW } from '../utils/formatters';
import { LEAD_STATUS } from '../utils/leadStatus';
import {
  Search,
  Plus,
  Filter,
  Zap,
  Phone,
  MapPin,
  Clock,
  UserCheck,
  ChevronRight,
  TrendingUp,
  FileCheck2,
  Award
} from 'lucide-react';

export default function LeadInbox() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
  const [submittingLead, setSubmittingLead] = useState(false);

  // New lead form state (manual entry)
  const [newLeadForm, setNewLeadForm] = useState({
    customer_name: '',
    phone: '',
    email: '',
    address: '',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411001',
    monthly_bill: 3500,
    roof_type: 'Flat Concrete',
    roof_area_sqft: 500,
    source: 'PHONE_INBOUND',
  });

  const navigate = useNavigate();

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedStatus !== 'ALL') params.status = selectedStatus;
      if (search.trim()) params.search = search.trim();

      const res = await apiClient.get('/api/leads', { params });
      if (res.success) {
        setLeads(res.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch leads', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [selectedStatus]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLeads();
  };

  const handleCreateLead = async (e) => {
    e.preventDefault();
    setSubmittingLead(true);
    try {
      const res = await apiClient.post('/api/leads', newLeadForm);
      if (res.success) {
        setIsNewLeadModalOpen(false);
        fetchLeads();
        navigate(`/leads/${res.data.id}`);
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to create lead');
    } finally {
      setSubmittingLead(false);
    }
  };

  // Metrics calculation
  const totalCount = leads.length;
  const surveyPendingCount = leads.filter(l => l.status === LEAD_STATUS.SURVEY_SCHEDULED || l.status === LEAD_STATUS.SURVEY_SUBMITTED).length;
  const approvedCount = leads.filter(l => l.status === LEAD_STATUS.SURVEY_APPROVED).length;
  const wonCount = leads.filter(l => l.status === LEAD_STATUS.WON).length;

  const statusFilters = [
    { key: 'ALL', label: 'All Leads' },
    { key: LEAD_STATUS.NEW, label: 'New' },
    { key: LEAD_STATUS.QUALIFIED, label: 'Qualified' },
    { key: LEAD_STATUS.SURVEY_SCHEDULED, label: 'Survey Scheduled' },
    { key: LEAD_STATUS.SURVEY_SUBMITTED, label: 'Survey Submitted' },
    { key: LEAD_STATUS.SURVEY_APPROVED, label: 'Survey Approved' },
    { key: LEAD_STATUS.QUOTED, label: 'Quoted' },
    { key: LEAD_STATUS.WON, label: 'Won' },
    { key: LEAD_STATUS.LOST, label: 'Lost' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Solar Lead Pipeline</h1>
          <p className="text-sm text-slate-500">
            Track leads through qualification, technical surveys, approvals, and quotations.
          </p>
        </div>

        <button
          onClick={() => setIsNewLeadModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm shadow-md shadow-amber-500/20 transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Lead (Manual)</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase">Total Leads</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{totalCount}</div>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Zap className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase">Surveys In-Flight</div>
            <div className="text-2xl font-black text-purple-700 mt-0.5">{surveyPendingCount}</div>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase">Survey Approved</div>
            <div className="text-2xl font-black text-emerald-700 mt-0.5">{approvedCount}</div>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <FileCheck2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase">Closed Won</div>
            <div className="text-2xl font-black text-green-700 mt-0.5">{wonCount}</div>
          </div>
          <div className="p-3 bg-green-50 text-green-600 rounded-xl">
            <Award className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search and Status Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by customer name, phone, city, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition"
          >
            Search
          </button>
        </form>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {statusFilters.map((st) => (
            <button
              key={st.key}
              onClick={() => setSelectedStatus(st.key)}
              className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition ${selectedStatus === st.key
                ? 'bg-amber-500 text-white shadow-xs font-semibold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            Loading leads...
          </div>
        ) : leads.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Search className="w-6 h-6" />
            </div>
            <p className="text-slate-700 font-semibold text-base">No leads found</p>
            <p className="text-slate-400 text-xs mt-1">
              Try adjusting your search filters or add a new lead manually.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4 sm:px-6">Customer & Site</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Est. Capacity</th>
                  <th className="py-3.5 px-4">Monthly Bill</th>
                  <th className="py-3.5 px-4">Assigned Staff</th>
                  <th className="py-3.5 px-4">Created</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => navigate(`/leads/${lead.id}`)}
                    className="hover:bg-slate-50/80 cursor-pointer transition group"
                  >
                    <td className="py-4 px-4 sm:px-6">
                      <div className="font-semibold text-slate-900 group-hover:text-amber-600 transition">
                        {lead.customer_name}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {lead.phone}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {lead.city || 'Pune'}
                        </span>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <StatusBadge status={lead.status} />
                    </td>

                    <td className="py-4 px-4 font-semibold text-slate-800">
                      {lead.suggested_kw ? formatKW(lead.suggested_kw) : (
                        <span className="text-xs text-slate-400 italic font-normal">Pending Qualify</span>
                      )}
                    </td>

                    <td className="py-4 px-4 text-slate-700 font-medium">
                      {formatCurrency(lead.monthly_bill)}
                    </td>

                    <td className="py-4 px-4 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5 font-medium">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                        {lead.assigned_to_name || 'Unassigned'}
                      </div>
                    </td>

                    <td className="py-4 px-4 text-xs text-slate-500">
                      {formatDate(lead.created_at)}
                    </td>

                    <td className="py-4 px-4 sm:px-6 text-right">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-amber-500 group-hover:text-white text-slate-500 transition">
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Entry Modal */}
      <Modal
        isOpen={isNewLeadModalOpen}
        onClose={() => setIsNewLeadModalOpen(false)}
        title="Add Inbound Lead (Phone / WhatsApp / Walk-in)"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreateLead} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Customer Name *
              </label>
              <input
                type="text"
                required
                value={newLeadForm.customer_name}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, customer_name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="e.g. Ramesh Patil"
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Phone Number *
              </label>
              <input
                type="tel"
                required
                value={newLeadForm.phone}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="+91 98220 00000"
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Email
              </label>
              <input
                type="email"
                value={newLeadForm.email}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="ramesh@example.com"
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Lead Source
              </label>
              <select
                value={newLeadForm.source}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, source: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="PHONE_INBOUND">Inbound Phone Call</option>
                <option value="WHATSAPP">WhatsApp Message</option>
                <option value="WALK_IN">Office Walk-in</option>
                <option value="REFERRAL">Customer Referral</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Site Address *
              </label>
              <input
                type="text"
                required
                value={newLeadForm.address}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, address: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Street address, colony, landmark"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                City
              </label>
              <input
                type="text"
                value={newLeadForm.city}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, city: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Avg. Monthly Bill (₹) *
              </label>
              <input
                type="number"
                required
                min="500"
                value={newLeadForm.monthly_bill}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, monthly_bill: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Roof Type
              </label>
              <select
                value={newLeadForm.roof_type}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, roof_type: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="Flat Concrete">Flat Concrete (RCC)</option>
                <option value="Sloped Metal Sheet">Sloped Metal Sheet</option>
                <option value="Tiled Roof">Tiled Roof</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Est. Roof Area (sq. ft.)
              </label>
              <input
                type="number"
                value={newLeadForm.roof_area_sqft}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, roof_area_sqft: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsNewLeadModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingLead}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold shadow-xs disabled:opacity-50"
            >
              {submittingLead ? 'Creating Lead...' : 'Create Lead'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
