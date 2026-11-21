import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { apiClient, openQuotePdf, isMockMode } from '../api/client';
import { formatCurrency, formatDate, formatKW } from '../utils/formatters';
import {
  ArrowLeft,
  Printer,
  Download,
  CheckCircle,
  XCircle,
  Sun,
  ShieldCheck,
  FileText,
  Building,
  Phone,
  Mail,
  Award
} from 'lucide-react';

export default function QuoteView() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchQuote = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/api/quotes/${id}`);
      if (res.success) {
        setQuote(res.data);
      } else {
        setError(res.error?.message || 'Quote not found');
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to fetch quote');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuote();
  }, [id]);

  useEffect(() => {
    if (searchParams.get('print') === 'true' && quote) {
      window.print();
    }
  }, [searchParams, quote]);

  const handleUpdateStatus = async (newStatus) => {
    setActionLoading(true);
    try {
      const res = await apiClient.patch(`/api/quotes/${id}/status`, { status: newStatus });
      if (res.success) {
        if (newStatus === 'ACCEPTED') {
          alert('🎉 Congratulations! Customer accepted the quote. Lead is now WON!');
        }
        fetchQuote();
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to update quote status');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    try {
      await openQuotePdf(quote.id, `${quote.quote_number || `quote-${quote.id}`}.pdf`);
    } catch (err) {
      alert('Could not download the PDF. Is the backend running?');
    }
  };

  if (loading) {
    return <div className="py-16 text-center text-slate-400">Loading quotation #{id}...</div>;
  }

  if (error || !quote) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-rose-600 font-semibold mb-3">{error || 'Quote not found'}</p>
        <Link to="/leads" className="text-sm text-amber-600 underline">
          ← Back to Leads
        </Link>
      </div>
    );
  }

  const isWon = quote.status === 'ACCEPTED';
  const isRejected = quote.status === 'REJECTED';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Top action bar (hidden during print) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(quote.lead_id ? `/leads/${quote.lead_id}` : '/leads')}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900">
                Quotation {quote.quote_number || `#${quote.id}`}
              </h1>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                  isWon
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : isRejected
                    ? 'bg-rose-50 text-rose-700 border-rose-300'
                    : 'bg-cyan-50 text-cyan-700 border-cyan-300'
                }`}
              >
                {quote.status}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              For Lead #{quote.lead_id} ({quote.lead?.customer_name})
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-2xs transition"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print / PDF</span>
          </button>

          {!isMockMode() && (
            <button
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-2xs transition"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Download PDF</span>
            </button>
          )}

          {quote.status === 'DRAFT' && (
            <button
              disabled={actionLoading}
              onClick={() => handleUpdateStatus('SENT')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-cyan-200 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 font-semibold text-xs transition"
            >
              <Mail className="w-4 h-4" />
              <span>Mark Sent</span>
            </button>
          )}

          {!isWon && !isRejected && (
            <>
              <button
                disabled={actionLoading}
                onClick={() => handleUpdateStatus('ACCEPTED')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Mark Accepted (WON)</span>
              </button>

              <button
                disabled={actionLoading}
                onClick={() => handleUpdateStatus('REJECTED')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold text-xs transition"
              >
                <XCircle className="w-4 h-4" />
                <span>Rejected</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Won Notification Banner */}
      {isWon && (
        <div className="no-print bg-gradient-to-r from-emerald-500 to-green-600 text-white p-4 rounded-2xl shadow-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Award className="w-6 h-6 shrink-0" />
            <div>
              <div className="font-extrabold text-sm">Deal Closed Won!</div>
              <div className="text-xs text-emerald-100">
                Customer accepted the proposal. Lead status updated to WON.
              </div>
            </div>
          </div>
          <Link
            to={`/leads/${quote.lead_id}`}
            className="px-3 py-1.5 bg-white text-emerald-800 text-xs font-bold rounded-xl shadow-xs hover:bg-emerald-50 transition"
          >
            View Lead Dossier →
          </Link>
        </div>
      )}

      {/* Printable Proposal Document */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-lg p-8 sm:p-12 print:shadow-none print:border-none print:p-0 space-y-8">
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b-2 border-slate-900">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-white font-black text-lg">
                <Sun className="w-5 h-5" />
              </div>
              <span className="text-2xl font-black tracking-tight text-slate-900">
                Sun<span className="text-amber-500">Power</span> Solutions
              </span>
            </div>
            <p className="text-xs text-slate-500 max-w-sm">
              Empowering India with Clean Solar Energy • PM Surya Ghar Channel Partner
            </p>
            <div className="text-[11px] text-slate-400 mt-2 space-y-0.5">
              <div>GSTIN: 27AABCS1429B1Z8 • Reg: Pune, Maharashtra</div>
              <div>support@sunpower.com • +91 20 4000 8900</div>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="inline-block text-xs uppercase font-extrabold tracking-widest text-amber-700 bg-amber-100 px-3 py-1 rounded-full mb-2">
              Turnkey Solar Proposal
            </span>
            <div className="text-xl font-black text-slate-900">
              {quote.quote_number || `#${quote.id}`}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              <strong>Date:</strong> {formatDate(quote.created_at)}
            </div>
            <div className="text-xs text-slate-500">
              <strong>Valid Until:</strong> {formatDate(quote.valid_until)}
            </div>
          </div>
        </div>

        {/* Customer & System Specification Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100 text-xs">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Customer & Installation Site
            </div>
            <div className="text-sm font-black text-slate-900">
              {quote.lead?.customer_name || 'Customer'}
            </div>
            <div className="text-slate-600 mt-1">
              {quote.lead?.address}, {quote.lead?.city}, {quote.lead?.state} - {quote.lead?.pincode}
            </div>
            <div className="text-slate-600 mt-1">
              Phone: {quote.lead?.phone} • Email: {quote.lead?.email || 'N/A'}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Proposed System Architecture
            </div>
            <div className="text-sm font-black text-amber-600">
              {quote.template_name}
            </div>
            <div className="text-slate-600 mt-1">
              System Capacity: <span className="font-semibold text-slate-900">{formatKW(quote.capacity_kw)}</span>
            </div>
            <div className="text-slate-600 mt-0.5">
              Type: <span className="font-semibold text-slate-900">{quote.system_type}</span>
            </div>
            <div className="text-slate-600 mt-0.5">
              Scope: Turnkey Supply, Fabrication, Wiring, Inverter & Net Metering
            </div>
          </div>
        </div>

        {/* Bill of Materials (BOM) Table */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center justify-between">
            <span>Bill of Materials (BOM) & Equipment Schedule</span>
            <span className="text-slate-400 font-normal">{quote.items?.length || 0} Components</span>
          </div>

          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-slate-900 bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Component / Specification</th>
                <th className="py-2.5 px-3 text-center">Qty / UOM</th>
                <th className="py-2.5 px-3 text-right">Unit Rate (₹)</th>
                <th className="py-2.5 px-3 text-right">Line Total (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(quote.items || []).map((item, idx) => (
                <tr key={idx}>
                  <td className="py-2.5 px-3 text-slate-400">{idx + 1}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-800">
                    {item.product_name}
                    {item.sku && <span className="text-[10px] text-slate-400 ml-1">({item.sku})</span>}
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-600">
                    {item.quantity} {item.uom}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-600">
                    {formatCurrency(item.unit_price)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                    {formatCurrency(item.total_price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Financial Summary */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-4 border-t border-slate-200">
          <div className="text-xs text-slate-500 max-w-sm space-y-1">
            <div className="font-bold text-slate-700">Proposal Terms:</div>
            <p>{quote.notes || 'All equipment backed by manufacturer warranties.'}</p>
            <div className="text-[11px] text-slate-400 pt-2">
              • 25 Years Linear Performance Warranty on Solar PV Panels
              <br />• 5 Years Comprehensive On-Site System Warranty
              <br />• Net-metering liaisoning with State Discom included
            </div>
          </div>

          <div className="w-full sm:w-64 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-semibold text-slate-900">{formatCurrency(quote.subtotal)}</span>
            </div>

            {quote.discount_amount > 0 && (
              <div className="flex justify-between text-rose-600 font-medium">
                <span>Discount ({quote.discount_pct}%):</span>
                <span>- {formatCurrency(quote.discount_amount)}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-600">
              <span>Taxable Subtotal:</span>
              <span className="font-semibold text-slate-900">{formatCurrency(quote.taxable_amount)}</span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span>{quote.gst_pct ? `GST (${quote.gst_pct}%):` : 'GST (as applicable):'}</span>
              <span className="font-semibold text-slate-900">{formatCurrency(quote.gst_amount)}</span>
            </div>

            <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t-2 border-slate-900">
              <span>Grand Total:</span>
              <span className="text-amber-600">{formatCurrency(quote.total_amount)}</span>
            </div>
          </div>
        </div>

        {/* Signature Box */}
        <div className="pt-8 border-t border-slate-200 flex justify-between items-end text-xs text-slate-400">
          <div>
            <div className="w-40 border-b border-slate-300 pb-1 mb-1"></div>
            <div>Authorized Signatory, SunPower</div>
          </div>
          <div className="text-right">
            <div className="w-40 border-b border-slate-300 pb-1 mb-1"></div>
            <div>Customer Acceptance Signature</div>
          </div>
        </div>
      </div>
    </div>
  );
}
