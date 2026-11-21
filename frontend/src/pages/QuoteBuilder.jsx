import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { formatCurrency, formatKW } from '../utils/formatters';
import { LEAD_STATUS } from '../utils/leadStatus';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  FileText,
  Percent,
  CheckCircle2,
  AlertTriangle,
  Layers,
  IndianRupee,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

export default function QuoteBuilder() {
  const { leadId } = useParams();
  const navigate = useNavigate();

  const [lead, setLead] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [discountPct, setDiscountPct] = useState(0);
  const [notes, setNotes] = useState('Includes PM Surya Ghar subsidy processing and turnkey execution.');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [gateBlocked, setGateBlocked] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        // 1. Fetch Lead
        const leadRes = await apiClient.get(`/api/leads/${leadId}`);
        if (!leadRes.success) throw new Error('Lead not found');
        const l = leadRes.data;
        setLead(l);

        // Check Survey Gate: 409 unless SURVEY_APPROVED
        if (l.status !== LEAD_STATUS.SURVEY_APPROVED) {
          setGateBlocked(true);
        }

        // 2. Fetch Templates
        const templRes = await apiClient.get('/api/templates');
        if (templRes.success) {
          const list = templRes.data || [];
          setTemplates(list);

          // Auto-select the smallest package that covers the lead's suggested / survey-approved kW,
          // preferring the system type chosen during qualification (default On-Grid).
          const target = Number(l.suggested_kw) || 3.0;
          const wantedType = l.qualification_data?.system_type || 'ON_GRID';
          const pool = list.filter((t) => !t.system_type || t.system_type === wantedType);
          const candidates = (pool.length ? pool : list).slice().sort((a, b) => a.capacity_kw - b.capacity_kw);
          const matched =
            candidates.find((t) => Number(t.capacity_kw) >= target) || candidates[candidates.length - 1] || list[0];
          if (matched) {
            setSelectedTemplateId(matched.id);
          }
        }
      } catch (err) {
        setError(err.response?.data?.error?.message || err.message || 'Failed to load details');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [leadId]);

  const selectedTemplate = templates.find((t) => t.id === Number(selectedTemplateId));

  // Automatic BOM calculation – same maths as the backend (per-item GST on the discounted value),
  // so the preview always equals the saved quote. Items without gst_rate (mock data) use 18%.
  const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const bomItems = selectedTemplate?.items || [];
  const discountFactor = 1 - Number(discountPct || 0) / 100;
  const subtotal = round2(bomItems.reduce((acc, item) => acc + round2(item.quantity * item.unit_price), 0));
  const discountAmount = round2((subtotal * Number(discountPct || 0)) / 100);
  const taxableAmount = round2(subtotal - discountAmount);
  const gstAmount = round2(
    bomItems.reduce(
      (acc, item) => acc + round2(item.quantity * item.unit_price * discountFactor * ((item.gst_rate ?? 18) / 100)),
      0,
    ),
  );
  const hasItemGst = bomItems.some((item) => item.gst_rate !== undefined);
  const totalAmount = round2(taxableAmount + gstAmount);

  const handleSubmitQuote = async (e) => {
    e.preventDefault();
    if (!selectedTemplate) return;

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        template_id: selectedTemplate.id,
        discount_percentage: Number(discountPct),
        notes,
      };

      const res = await apiClient.post(`/api/leads/${leadId}/quotes`, payload);
      if (res.success) {
        confetti({ particleCount: 75, spread: 60 });
        navigate(`/quotes/${res.data.id}`);
      }
    } catch (err) {
      if (err.response?.status === 409) {
        setError(err.response.data?.error?.message || 'Survey Gate Blocked: Survey must be APPROVED first.');
      } else {
        setError(err.response?.data?.error?.message || 'Error generating quote');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="py-16 text-center text-slate-400">Loading quote builder...</div>;
  }

  // Survey Gate Block Screen
  if (gateBlocked) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="bg-amber-50 border border-amber-300 rounded-3xl p-8 sm:p-10 shadow-lg">
          <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-300">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-amber-900 mb-2">
            Survey Gate Blocked (HTTP 409)
          </h2>
          <p className="text-sm text-amber-800 mb-6">
            A quotation cannot be created for lead <span className="font-bold">#{leadId}</span> because its current status is <code className="bg-amber-200 px-1.5 py-0.5 rounded font-mono font-bold text-amber-900">{lead?.status}</code>.
            According to business rules, a site survey must be submitted by a technician and <strong>APPROVED</strong> by an admin before quoting.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              to={`/leads/${leadId}`}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition shadow-xs"
            >
              ← Go to Lead Dossier to Review Survey
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/leads/${leadId}`)}
          className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Generate Solar Quotation & BOM
          </h1>
          <p className="text-xs text-slate-500">
            Lead: <span className="font-semibold text-slate-800">{lead?.customer_name}</span> • Target:{' '}
            <span className="font-bold text-emerald-600">{formatKW(lead?.suggested_kw || 3.0)}</span>
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmitQuote} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Template selector & Automated BOM Table */}
        <div className="lg:col-span-2 space-y-6">
          {/* Template Selector Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-500" />
                Select Package Template
              </h2>
              <span className="text-xs text-slate-400">10 Standard System Packages</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                System Template (Automates BOM Generation) *
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50/50"
              >
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} — {formatCurrency(tpl.base_price)} ({tpl.system_type})
                  </option>
                ))}
              </select>
            </div>

            {selectedTemplate && (
              <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
                {selectedTemplate.description}
              </p>
            )}
          </div>

          {/* Automated BOM Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Automated Bill of Materials (BOM)
                </h3>
                <p className="text-xs text-slate-400">
                  Derived directly from package template specifications.
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {bomItems.length} Line Items
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 uppercase font-bold">
                    <th className="py-3 px-4">Component / Product</th>
                    <th className="py-3 px-4 text-center">Qty</th>
                    <th className="py-3 px-4 text-right">Unit Rate</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bomItems.map((item, idx) => {
                    const lineTotal = item.quantity * item.unit_price;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {item.product_name}
                        </td>
                        <td className="py-3 px-4 text-center font-medium text-slate-600">
                          {item.quantity} {item.uom}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600">
                          {formatCurrency(item.unit_price)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          {formatCurrency(lineTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quotation Notes */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Proposal Terms & Custom Scope Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800"
              placeholder="Add client-specific notes, warranties, or payment schedule..."
            />
          </div>
        </div>

        {/* Right 1 Col: Pricing Summary & Confirm Button */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5 sticky top-24">
            <h2 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-600" />
              Quotation Summary
            </h2>

            {/* Discount adjustment */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
                <span>Discount Allowed</span>
                <span className="text-amber-600 font-bold">{discountPct}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="25"
                step="1"
                value={discountPct}
                onChange={(e) => setDiscountPct(e.target.value)}
                className="w-full accent-amber-500"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>0%</span>
                <span>Max 25%</span>
              </div>
            </div>

            {/* Calculations breakdown */}
            <div className="space-y-2.5 text-xs pt-3 border-t border-slate-100 text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal (BOM Sum)</span>
                <span className="font-semibold text-slate-800">{formatCurrency(subtotal)}</span>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Special Discount ({discountPct}%)</span>
                  <span>- {formatCurrency(discountAmount)}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span>Taxable Amount</span>
                <span className="font-semibold text-slate-800">{formatCurrency(taxableAmount)}</span>
              </div>

              <div className="flex justify-between">
                <span>{hasItemGst ? 'GST (5% modules & inverters, 18% others)' : 'GST (18% Statutory)'}</span>
                <span className="font-semibold text-slate-800">{formatCurrency(gstAmount)}</span>
              </div>

              <div className="flex justify-between text-base font-black text-slate-900 pt-3 border-t border-slate-200">
                <span>Total Proposal Value</span>
                <span className="text-amber-600">{formatCurrency(totalAmount)}</span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || !selectedTemplate}
              className="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-sm shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? 'Generating Proposal...' : 'Create Formal Quote →'}
            </button>
            <p className="text-[11px] text-slate-400 text-center">
              Advances lead to <span className="font-bold text-cyan-600">QUOTED</span> and prepares printable PDF.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
