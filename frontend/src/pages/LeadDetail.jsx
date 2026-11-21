import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import ActivityTimeline from '../components/ActivityTimeline';
import Modal from '../components/Modal';
import { formatCurrency, formatDate, formatDateTime, formatKW } from '../utils/formatters';
import { LEAD_STATUS, STATUS_CONFIG } from '../utils/leadStatus';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  IndianRupee,
  Home,
  Zap,
  Calendar,
  CheckCircle,
  XCircle,
  FileText,
  AlertTriangle,
  HardHat,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Camera,
} from 'lucide-react';

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [qualifyModalOpen, setQualifyModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [lostModalOpen, setLostModalOpen] = useState(false);

  // Form states
  const [qualifyForm, setQualifyForm] = useState({
    suggested_kw: 3.0,
    sanctioned_load_kw: 4.0,
    monthly_units: 360,
    roof_viability: 'HIGH',
    notes: '',
  });

  const [technicians, setTechnicians] = useState([]);
  const [scheduleForm, setScheduleForm] = useState({
    technician_id: '',
    scheduled_date: '',
    notes: '',
  });

  const [reviewForm, setReviewForm] = useState({
    status: 'APPROVED',
    review_notes: '',
  });

  const [lostReason, setLostReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchLead = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get(`/api/leads/${id}`);
      if (res.success) {
        setLead(res.data);

        // Pre-fill qualification form defaults
        const estKW = res.data.monthly_bill > 0 ? (res.data.monthly_bill / 1200).toFixed(1) : 3.0;
        setQualifyForm({
          suggested_kw: res.data.suggested_kw || Number(estKW),
          sanctioned_load_kw: (Number(estKW) * 1.2).toFixed(1),
          monthly_units: Math.round(Number(estKW) * 120),
          roof_viability: 'HIGH',
          notes: 'Customer is keen on rooftop solar to reduce electricity charges.',
        });
      } else {
        setError(res.error?.message || 'Lead not found');
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load lead details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLead();
  }, [id]);

  // Fetch technicians for scheduling modal
  const openScheduleModal = async () => {
    try {
      const res = await apiClient.get('/api/users', { params: { role: 'TECHNICIAN' } });
      if (res.success) {
        setTechnicians(res.data || []);
        if (res.data?.length > 0) {
          // Default slot: tomorrow 10:00 in the user's local time (datetime-local has no timezone)
          const slot = new Date(Date.now() + 86400000);
          slot.setHours(10, 0, 0, 0);
          const pad = (n) => String(n).padStart(2, '0');
          const localValue = `${slot.getFullYear()}-${pad(slot.getMonth() + 1)}-${pad(slot.getDate())}T10:00`;
          setScheduleForm((prev) => ({
            ...prev,
            technician_id: res.data[0].id,
            scheduled_date: localValue,
          }));
        }
      }
    } catch (e) {
      console.error('Error fetching technicians', e);
    }
    setScheduleModalOpen(true);
  };

  // 1. Submit Qualify
  const handleQualifySubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await apiClient.patch(`/api/leads/${id}/qualify`, qualifyForm);
      if (res.success) {
        setQualifyModalOpen(false);
        fetchLead();
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to qualify lead');
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Submit Survey Schedule
  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await apiClient.post(`/api/leads/${id}/surveys`, scheduleForm);
      if (res.success) {
        setScheduleModalOpen(false);
        fetchLead();
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to schedule survey');
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Submit Admin Survey Review (Approve or Reject)
  const handleReviewSubmit = async (decision) => {
    setActionLoading(true);
    try {
      const latestSurvey = (lead.surveys || [])[0];
      if (!latestSurvey) throw new Error('No survey to review');

      const res = await apiClient.patch(`/api/surveys/${latestSurvey.id}/review`, {
        status: decision,
        review_notes: reviewForm.review_notes,
      });

      if (res.success) {
        setReviewModalOpen(false);
        if (decision === 'APPROVED') {
          confetti({ particleCount: 70, spread: 50 });
        }
        fetchLead();
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Survey review failed');
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Mark Lead as Lost
  const handleLostSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await apiClient.patch(`/api/leads/${id}/lost`, { reason: lostReason });
      if (res.success) {
        setLostModalOpen(false);
        fetchLead();
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to mark lost');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-400">
        Loading lead dossier #{id}...
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <p className="text-rose-600 font-semibold mb-3">{error || 'Lead not found'}</p>
        <Link to="/leads" className="text-sm text-amber-600 underline">
          ← Back to Lead Inbox
        </Link>
      </div>
    );
  }

  const latestSurvey = (lead.surveys || [])[0];
  const latestQuote = (lead.quotes || [])[0];

  const pipelineSteps = [
    { key: LEAD_STATUS.NEW, label: '1. New Lead' },
    { key: LEAD_STATUS.QUALIFIED, label: '2. Qualify' },
    { key: LEAD_STATUS.SURVEY_SCHEDULED, label: '3. Schedule' },
    { key: LEAD_STATUS.SURVEY_SUBMITTED, label: '4. Survey' },
    { key: LEAD_STATUS.SURVEY_APPROVED, label: '5. Approval' },
    { key: LEAD_STATUS.QUOTED, label: '6. Quote' },
    { key: LEAD_STATUS.WON, label: '7. Won' },
  ];

  const currentStepIdx = pipelineSteps.findIndex((s) => s.key === lead.status);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top back & actions header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/leads')}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {lead.customer_name}
              </h1>
              <StatusBadge status={lead.status} size="lg" />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Lead #{lead.id} • Created {formatDate(lead.created_at)} • Source: {lead.source || 'Website'}
            </p>
          </div>
        </div>

        {/* Dynamic Action Buttons based on Status */}
        <div className="flex items-center gap-2 flex-wrap">
          {lead.status === LEAD_STATUS.NEW && (
            <button
              onClick={() => setQualifyModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm shadow-md shadow-amber-500/20 transition"
            >
              <Zap className="w-4 h-4" />
              <span>Qualify Lead</span>
            </button>
          )}

          {lead.status === LEAD_STATUS.QUALIFIED && (
            <button
              onClick={openScheduleModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm shadow-md shadow-purple-600/20 transition"
            >
              <Calendar className="w-4 h-4" />
              <span>Assign & Schedule Survey</span>
            </button>
          )}

          {lead.status === LEAD_STATUS.SURVEY_SUBMITTED && (
            <button
              onClick={() => setReviewModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-600/20 transition animate-pulse"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Review Survey & Approve</span>
            </button>
          )}

          {lead.status === LEAD_STATUS.SURVEY_APPROVED && (
            <Link
              to={`/leads/${lead.id}/quote`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition"
            >
              <FileText className="w-4 h-4" />
              <span>Create Quote from Template →</span>
            </Link>
          )}

          {lead.status === LEAD_STATUS.QUOTED && latestQuote && (
            <Link
              to={`/quotes/${latestQuote.id}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-sm shadow-md shadow-cyan-600/20 transition"
            >
              <FileText className="w-4 h-4" />
              <span>View Quote & PDF</span>
            </Link>
          )}

          {lead.status !== LEAD_STATUS.LOST && lead.status !== LEAD_STATUS.WON && (
            <button
              onClick={() => setLostModalOpen(true)}
              className="px-3.5 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition"
            >
              Mark Lost
            </button>
          )}
        </div>
      </div>

      {/* Visual Lifecycle Pipeline Stepper */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
        <div className="flex items-center justify-between min-w-[650px] relative">
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-100 -translate-y-1/2 z-0" />
          {pipelineSteps.map((step, idx) => {
            const isCompleted = currentStepIdx >= idx && lead.status !== LEAD_STATUS.LOST;
            const isCurrent = lead.status === step.key;

            return (
              <div key={step.key} className="relative z-10 flex flex-col items-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition shadow-xs ${
                    isCurrent
                      ? 'bg-amber-500 text-white ring-4 ring-amber-100'
                      : isCompleted
                      ? 'bg-emerald-500 text-white'
                      : 'bg-white border-2 border-slate-300 text-slate-400'
                  }`}
                >
                  {isCompleted && !isCurrent ? '✓' : idx + 1}
                </div>
                <span
                  className={`text-[11px] font-semibold mt-2 whitespace-nowrap ${
                    isCurrent
                      ? 'text-amber-600 font-bold'
                      : isCompleted
                      ? 'text-slate-800'
                      : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Details + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Lead Information, Qualification, Survey Details, Quote */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer & Site Details Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
            <h2 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
              <User className="w-4 h-4 text-amber-500" />
              Customer & Site Parameters
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-slate-400">Phone / WhatsApp</div>
                  <div className="font-semibold text-slate-800">{lead.phone}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-slate-400">Email Address</div>
                  <div className="font-semibold text-slate-800">{lead.email || 'None'}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-slate-400">Site Location</div>
                  <div className="font-medium text-slate-800">
                    {lead.address}, {lead.city}, {lead.state} - {lead.pincode}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <IndianRupee className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-slate-400">Avg. Monthly Bill</div>
                  <div className="font-bold text-amber-600 text-base">
                    {formatCurrency(lead.monthly_bill)}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Home className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-slate-400">Roof Specs (Reported)</div>
                  <div className="font-medium text-slate-800">
                    {lead.roof_type || 'Flat RCC'} • {lead.roof_area_sqft || '—'} sq. ft.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Zap className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-slate-400">Assigned Account Staff</div>
                  <div className="font-medium text-slate-800">
                    {lead.assigned_to_name || 'Staff Member'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Qualification Details (if qualified) */}
          {lead.qualification_data && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
              <h2 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
                <Zap className="w-4 h-4 text-indigo-500" />
                Lead Qualification Analysis
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="text-xs text-slate-400 font-medium">Suggested System</div>
                  <div className="text-lg font-black text-indigo-600">
                    {formatKW(lead.suggested_kw)}
                  </div>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="text-xs text-slate-400 font-medium">Sanctioned Load</div>
                  <div className="text-lg font-black text-slate-800">
                    {lead.qualification_data.sanctioned_load_kw || '—'} kW
                  </div>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="text-xs text-slate-400 font-medium">Monthly Units</div>
                  <div className="text-lg font-black text-slate-800">
                    {lead.qualification_data.monthly_units || '—'} kWh
                  </div>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="text-xs text-slate-400 font-medium">Roof Viability</div>
                  <div className="text-sm font-bold text-emerald-600 mt-1">
                    {lead.qualification_data.roof_viability || 'HIGH'}
                  </div>
                </div>
              </div>
              <div className="text-xs text-slate-600 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                <span className="font-semibold text-indigo-900">Qualifier Notes: </span>
                {lead.qualification_data.qualifier_notes}
              </div>
            </div>
          )}

          {/* Survey Card (if scheduled, submitted, approved) */}
          {latestSurvey && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <HardHat className="w-4 h-4 text-purple-600" />
                  Technical Site Survey Details
                </h2>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                    latestSurvey.status === 'APPROVED'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : latestSurvey.status === 'SUBMITTED'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : latestSurvey.status === 'REJECTED'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-purple-50 text-purple-700 border-purple-200'
                  }`}
                >
                  Survey {latestSurvey.status}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-xs text-slate-400">Assigned Technician</div>
                  <div className="font-semibold text-slate-800">{latestSurvey.technician_name}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Scheduled Date</div>
                  <div className="font-medium text-slate-800">
                    {formatDateTime(latestSurvey.scheduled_date)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Confirmed Capacity</div>
                  <div className="font-bold text-purple-700">
                    {latestSurvey.recommended_capacity_kw
                      ? formatKW(latestSurvey.recommended_capacity_kw)
                      : 'Pending visit'}
                  </div>
                </div>
              </div>

              {latestSurvey.submitted_at && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-slate-600">
                    <div>
                      <span className="font-semibold">Roof Confirmed: </span>
                      {latestSurvey.roof_type_confirmed}
                    </div>
                    <div>
                      <span className="font-semibold">Mount Structure: </span>
                      {latestSurvey.structure_type}
                    </div>
                    <div>
                      <span className="font-semibold">Cable Run: </span>
                      {latestSurvey.cable_run_meters} meters
                    </div>
                    <div>
                      <span className="font-semibold">Inverter Position: </span>
                      {latestSurvey.inverter_location}
                    </div>
                  </div>
                  <div className="text-slate-700 pt-2 border-t border-slate-200">
                    <span className="font-semibold">Shading Analysis: </span>
                    {latestSurvey.shading_analysis}
                  </div>
                  {latestSurvey.technician_remarks && (
                    <div className="text-slate-700">
                      <span className="font-semibold">Technician Remarks: </span>
                      {latestSurvey.technician_remarks}
                    </div>
                  )}
                  {latestSurvey.review_notes && (
                    <div className="text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-200 mt-2">
                      <span className="font-semibold">Admin Review: </span>
                      {latestSurvey.review_notes} ({latestSurvey.reviewed_by})
                    </div>
                  )}
                </div>
              )}

              {/* Photos Gallery */}
              {latestSurvey.photos && latestSurvey.photos.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-600 uppercase mb-2 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" />
                    Site Survey Photos ({latestSurvey.photos.length})
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {latestSurvey.photos.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative block aspect-video rounded-xl overflow-hidden bg-slate-100 border border-slate-200 hover:opacity-90 transition"
                      >
                        <img
                          src={url}
                          alt={`Site Photo ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                        <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                          Photo {idx + 1}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Generated Quotes Card */}
          {latestQuote && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-600" />
                  Generated Proposal & Quote
                </h2>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200">
                  Quote #{latestQuote.id}
                </span>
              </div>

              <div className="flex items-center justify-between bg-cyan-50/50 p-4 rounded-xl border border-cyan-100">
                <div>
                  <div className="font-bold text-slate-900 text-sm">{latestQuote.template_name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    System: {formatKW(latestQuote.capacity_kw)} • {latestQuote.system_type}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Total with GST</div>
                  <div className="text-xl font-black text-slate-900">
                    {formatCurrency(latestQuote.total_amount)}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Link
                  to={`/quotes/${latestQuote.id}`}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
                >
                  View Quote / BOM / PDF →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Right 1 Column: Activity Timeline */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
            <h2 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              Activity Audit Trail
            </h2>
            <ActivityTimeline activities={lead.activities} />
          </div>
        </div>
      </div>

      {/* 1. QUALIFY MODAL */}
      <Modal
        isOpen={qualifyModalOpen}
        onClose={() => setQualifyModalOpen(false)}
        title="Qualify Solar Lead"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleQualifySubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Suggested Capacity (kW) *
            </label>
            <input
              type="number"
              step="0.5"
              min="1"
              max="100"
              required
              value={qualifyForm.suggested_kw}
              onChange={(e) =>
                setQualifyForm({
                  ...qualifyForm,
                  suggested_kw: e.target.value,
                  monthly_units: Math.round(Number(e.target.value) * 120),
                  sanctioned_load_kw: (Number(e.target.value) * 1.2).toFixed(1),
                })
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Based on monthly bill {formatCurrency(lead.monthly_bill)} (~120 units per kW monthly)
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Sanctioned Load (kW)
              </label>
              <input
                type="number"
                step="0.1"
                value={qualifyForm.sanctioned_load_kw}
                onChange={(e) => setQualifyForm({ ...qualifyForm, sanctioned_load_kw: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Estimated Monthly Units
              </label>
              <input
                type="number"
                value={qualifyForm.monthly_units}
                onChange={(e) => setQualifyForm({ ...qualifyForm, monthly_units: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Roof Viability Assessment
            </label>
            <select
              value={qualifyForm.roof_viability}
              onChange={(e) => setQualifyForm({ ...qualifyForm, roof_viability: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
            >
              <option value="HIGH">High (Unobstructed flat roof / Good tilt)</option>
              <option value="MEDIUM">Medium (Minor parapet shadow)</option>
              <option value="LOW">Low (Heavy shading, needs special structure)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Qualification Remarks
            </label>
            <textarea
              rows={3}
              value={qualifyForm.notes}
              onChange={(e) => setQualifyForm({ ...qualifyForm, notes: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              placeholder="e.g. Verified electricity consumer number; suitable for PM Surya Ghar subsidy."
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setQualifyModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-xs disabled:opacity-50"
            >
              {actionLoading ? 'Saving...' : 'Confirm Qualification'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 2. SCHEDULE SURVEY MODAL */}
      <Modal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title="Assign Technician & Schedule Site Survey"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleScheduleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Select Field Technician *
            </label>
            <select
              required
              value={scheduleForm.technician_id}
              onChange={(e) => setScheduleForm({ ...scheduleForm, technician_id: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.phone || 'Available'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Survey Visit Date & Time *
            </label>
            <input
              type="datetime-local"
              required
              value={scheduleForm.scheduled_date}
              onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_date: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Instructions for Technician
            </label>
            <textarea
              rows={3}
              value={scheduleForm.notes}
              onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              placeholder="e.g. Call customer 30 mins before arrival. Check water tank shadow."
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setScheduleModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-xs disabled:opacity-50"
            >
              {actionLoading ? 'Scheduling...' : 'Confirm Schedule'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 3. REVIEW SURVEY MODAL (Admin Approval / Rejection) */}
      <Modal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        title="Admin Review: Site Survey Feasibility"
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          {latestSurvey && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase">Technician Findings</span>
                <span className="font-bold text-indigo-700">
                  Recommended: {formatKW(latestSurvey.recommended_capacity_kw)}
                </span>
              </div>
              <div className="text-xs text-slate-600">
                <div><strong>Roof Confirmed:</strong> {latestSurvey.roof_type_confirmed}</div>
                <div><strong>Shading:</strong> {latestSurvey.shading_analysis}</div>
                <div><strong>Structure:</strong> {latestSurvey.structure_type}</div>
                <div><strong>Remarks:</strong> {latestSurvey.technician_remarks || 'None'}</div>
              </div>

              {latestSurvey.photos && latestSurvey.photos.length > 0 && (
                <div className="pt-2">
                  <div className="text-[11px] font-semibold text-slate-500 mb-1">Attached Site Photos</div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {latestSurvey.photos.map((p, idx) => (
                      <img
                        key={idx}
                        src={p}
                        alt="Survey thumbnail"
                        className="w-20 h-16 object-cover rounded-lg border border-slate-200 shrink-0"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Admin Review Remarks *
            </label>
            <textarea
              rows={3}
              required
              value={reviewForm.review_notes}
              onChange={(e) => setReviewForm({ ...reviewForm, review_notes: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="e.g. Structure plan verified. Good south azimuth. Approved for 5kW On-Grid quotation."
            />
          </div>

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
            <strong>State Machine Rule:</strong> Approving will move lead to{' '}
            <code className="font-mono bg-white px-1 py-0.5 rounded text-emerald-700">SURVEY_APPROVED</code>, unlocking quotation generation. Rejecting will return the lead back to{' '}
            <code className="font-mono bg-white px-1 py-0.5 rounded text-indigo-700">QUALIFIED</code> for re-survey.
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => handleReviewSubmit('REJECTED')}
              className="px-4 py-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition"
            >
              Reject Survey (Back to QUALIFIED)
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setReviewModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleReviewSubmit('APPROVED')}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
              >
                {actionLoading ? 'Processing...' : 'Approve Survey ✓'}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* 4. MARK LOST MODAL */}
      <Modal
        isOpen={lostModalOpen}
        onClose={() => setLostModalOpen(false)}
        title="Mark Lead as Lost"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleLostSubmit} className="space-y-4">
          <p className="text-xs text-slate-500">
            Marking this lead as closed-lost will archive it and halt future progression.
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Reason for Loss *
            </label>
            <select
              required
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Select a reason...</option>
              <option value="Customer budget constraints">Customer budget constraints</option>
              <option value="Roof structural unsuitability">Roof structural unsuitability</option>
              <option value="Heavy permanent shade from high-rise">Heavy permanent shade from high-rise</option>
              <option value="Competitor chosen">Competitor chosen</option>
              <option value="Customer dropped idea">Customer dropped idea</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setLostModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading || !lostReason}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-xs disabled:opacity-50"
            >
              {actionLoading ? 'Updating...' : 'Mark Closed Lost'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
