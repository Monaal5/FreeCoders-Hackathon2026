import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { openQuotePdf, openJobCertificate } from '../api/client';
import {
  Sun,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Truck,
  FileText,
  Star,
  MapPin,
  Calendar,
  AlertCircle,
  Phone,
  Layers,
  Award,
  RefreshCw,
  Download,
} from 'lucide-react';

export default function CustomerPortal() {
  const { orderNumber } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Review / rating state
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  const fetchPortalData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/public/portal/${orderNumber}`);
      const portalData = res.data || res;
      setData(portalData);
      if (portalData.customer_rating) {
        setRating(portalData.customer_rating);
        setFeedback(portalData.customer_feedback || '');
        setReviewSuccess(true);
      }
    } catch (err) {
      console.error('Error loading customer portal:', err);
      setError(err.response?.data?.message || 'We could not find a solar project with this order number.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderNumber) {
      fetchPortalData();
    }
  }, [orderNumber]);

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    try {
      setSubmittingReview(true);
      await api.post(`/public/portal/${orderNumber}/feedback`, {
        rating,
        feedback: feedback.trim(),
      });
      setReviewSuccess(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit feedback.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Sun className="w-10 h-10 text-amber-500 animate-spin-slow mb-3" />
        <h2 className="text-base font-bold text-slate-800">Loading your rooftop solar project...</h2>
        <p className="text-xs text-slate-400 mt-1">Fetching live installation and warranty records</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl max-w-md w-full text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-xl font-black text-slate-900">Project Not Found</h2>
          <p className="text-xs text-slate-500">
            {error || `No active order matching "${orderNumber}". Please verify your order number or check your email confirmation.`}
          </p>
          <Link
            to="/enquiry"
            className="inline-block px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs"
          >
            Submit an Enquiry
          </Link>
        </div>
      </div>
    );
  }

  const isAdvancePaid = Number(data.amount_paid) >= Number(data.advance_required || 0);
  const isConfirmed = ['CONFIRMED', 'DISPATCHED', 'DELIVERED', 'INSTALLED'].includes(data.status);
  const isDispatched = ['DISPATCHED', 'DELIVERED', 'INSTALLED'].includes(data.status);
  const isDelivered = ['DELIVERED', 'INSTALLED'].includes(data.status);
  const isInstalled = data.status === 'INSTALLED' || data.job_status === 'COMPLETED';

  const steps = [
    {
      title: 'Booking & Advance',
      desc: isAdvancePaid ? 'Advance cleared' : 'Awaiting advance payment',
      done: isAdvancePaid || isConfirmed,
      current: !isAdvancePaid && !isConfirmed,
    },
    {
      title: 'Equipment Staged',
      desc: 'Physical serials reserved in warehouse',
      done: isConfirmed,
      current: isConfirmed && !isDispatched,
    },
    {
      title: 'Logistics & Dispatch',
      desc: data.vehicle_no ? `Vehicle: ${data.vehicle_no}` : 'Truck staging',
      done: isDispatched,
      current: isDispatched && !isDelivered,
    },
    {
      title: 'Site Delivery',
      desc: isDelivered ? 'Delivered & warranties active' : 'En route to your roof',
      done: isDelivered,
      current: isDelivered && !isInstalled,
    },
    {
      title: 'Commissioned',
      desc: isInstalled ? 'Net metering complete' : 'Final rooftop installation',
      done: isInstalled,
      current: isInstalled,
    },
  ];

  const total = Number(data.total_amount || 0);
  const paid = Number(data.amount_paid || 0);
  const due = Math.max(0, total - paid);
  const paidPct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

  return (
    <div className="min-h-screen bg-slate-50 pb-16 font-sans">
      {/* Brand Hero Top Header */}
      <header className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white py-10 px-4 sm:px-6 lg:px-8 border-b border-indigo-900/50">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-white font-black">
                <Sun className="w-5 h-5 animate-spin-slow" />
              </div>
              <span className="font-extrabold text-xl tracking-tight">
                Sun<span className="text-amber-400">Power</span> Solutions
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest bg-white/10 px-2 py-0.5 rounded-full text-indigo-200">
                Customer Project Portal
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {data.customer_name ? `Welcome, ${data.customer_name}` : 'Rooftop Solar Tracker'}
            </h1>
            <p className="text-xs text-indigo-200 flex items-center gap-1.5 flex-wrap">
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              <span>{data.address ? `${data.address}, ${data.city}` : data.city || 'Installation Site'}</span>
              <span>•</span>
              <span className="font-bold text-amber-300">Order #{data.order_number}</span>
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl flex items-center gap-4 self-start md:self-auto">
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-indigo-200">
                System Capacity
              </div>
              <div className="text-xl font-black text-amber-300">
                {data.capacity_kw || 3.0} kW
              </div>
              <div className="text-[11px] text-white/80">
                {data.package_kind || 'On-Grid Solar System'}
              </div>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-indigo-200">
                Project State
              </div>
              <span className="inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-slate-950">
                {data.status}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 space-y-6">
        {/* Live Project Stepper */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>Live Rooftop Project Timeline</span>
            </h2>
            <button
              onClick={fetchPortalData}
              className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 font-medium"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Refresh Status</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {steps.map((st, idx) => (
              <div
                key={st.title}
                className={`p-3.5 rounded-2xl border transition ${
                  st.current
                    ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/20'
                    : st.done
                    ? 'bg-slate-50 border-slate-200'
                    : 'bg-white border-dashed border-slate-200 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-black uppercase text-slate-400">
                    Step 0{idx + 1}
                  </span>
                  {st.done ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : st.current ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-slate-300" />
                  )}
                </div>
                <div className="text-xs font-bold text-slate-900">{st.title}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{st.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Financial Summary & Documents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Payment Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs md:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Investment & Payment Clearance</span>
              </h2>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                {paidPct}% Paid
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 py-2 border-y border-slate-100">
              <div>
                <div className="text-[11px] text-slate-400 font-medium">Total Cost</div>
                <div className="text-lg font-black text-slate-900 mt-0.5">
                  {formatCurrency(total)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400 font-medium">Paid So Far</div>
                <div className="text-lg font-black text-emerald-600 mt-0.5">
                  {formatCurrency(paid)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400 font-medium">Remaining Due</div>
                <div className="text-lg font-black text-amber-600 mt-0.5">
                  {formatCurrency(due)}
                </div>
              </div>
            </div>

            <div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                <div
                  className={`h-full transition-all duration-500 ${
                    paid >= total ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${paidPct}%` }}
                />
              </div>
            </div>

            {data.payments && data.payments.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-bold uppercase text-slate-400">
                  Payment Receipts ({data.payments.length})
                </div>
                <div className="divide-y divide-slate-100 text-xs">
                  {data.payments.map((p) => (
                    <div key={p.id} className="py-1.5 flex justify-between items-center text-slate-600">
                      <span>{p.type} via {p.mode} on {formatDate(p.paid_at)}</span>
                      <strong className="text-emerald-700">{formatCurrency(p.amount)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Official Document Downloads */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>Project Documents</span>
            </h2>

            <div className="space-y-2.5">
              {data.quote_id && (
                <button
                  onClick={() => openQuotePdf(data.quote_id)}
                  className="w-full p-3 rounded-2xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 transition text-left flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                      <FileText className="w-4 h-4" />
                    </span>
                    <div>
                      <div className="text-xs font-bold text-slate-900 group-hover:text-amber-800">
                        Turnkey Solar Proposal
                      </div>
                      <div className="text-[10px] text-slate-400">MNRE Subsidy & BOM</div>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-slate-400 group-hover:text-amber-600" />
                </button>
              )}

              {data.job_id && isInstalled && (
                <button
                  onClick={() => openJobCertificate(data.job_id)}
                  className="w-full p-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/70 transition text-left flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 bg-emerald-600 text-white rounded-xl">
                      <Award className="w-4 h-4" />
                    </span>
                    <div>
                      <div className="text-xs font-bold text-emerald-950">
                        Commissioning Certificate
                      </div>
                      <div className="text-[10px] text-emerald-700 font-medium">
                        Net Metering & Technician Seal
                      </div>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-emerald-700" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Installed Hardware Traceability */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Installed Solar Hardware & Traceable Serials</span>
            </h2>
            <span className="text-xs font-semibold text-slate-400">
              Verified Physical Equipment
            </span>
          </div>

          {!data.serials || data.serials.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
              Hardware serial numbers will be displayed here once scanned in the warehouse.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.serials.map((s) => (
                <div
                  key={s.serial_number}
                  className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-start justify-between"
                >
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      {s.category || 'Component'}
                    </span>
                    <div className="text-xs font-extrabold text-slate-900 mt-0.5">
                      {s.product_name}
                    </div>
                    <div className="font-mono text-xs text-indigo-700 font-bold mt-1">
                      {s.serial_number}
                    </div>
                  </div>
                  <span className="p-1 bg-emerald-100 text-emerald-700 rounded-lg" title="Verified by SunPower">
                    <ShieldCheck className="w-4 h-4" />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Warranties Countdown */}
        {data.warranties && data.warranties.length > 0 && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Active Warranty Protection</span>
              </h2>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Official Manufacturer Warranty
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.warranties.map((w) => {
                const end = new Date(w.end_date);
                const now = new Date();
                const diffDays = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));

                return (
                  <div
                    key={w.id}
                    className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        {w.product_name}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                        SN: {w.serial_number}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Valid until: <strong>{formatDate(w.end_date)}</strong>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-600 text-white inline-block">
                        {w.months} Months
                      </span>
                      <div className="text-[10px] text-emerald-700 font-semibold mt-1">
                        {diffDays.toLocaleString()} days remaining
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Customer Rating & Review Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            <span>Rate Your Solar Installation Experience</span>
          </h2>

          {reviewSuccess ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <div className="font-bold">Thank you for your feedback!</div>
                <div>Your {rating}-star rating has been registered with SunPower Customer Care.</div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmitReview} className="space-y-3">
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1 focus:outline-none transition"
                  >
                    <Star
                      className={`w-7 h-7 ${
                        star <= rating
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
                <span className="text-xs font-bold text-slate-600 ml-2">
                  {rating === 5
                    ? 'Excellent (5/5)'
                    : rating === 4
                    ? 'Very Good (4/5)'
                    : rating === 3
                    ? 'Good (3/5)'
                    : 'Needs Improvement'}
                </span>
              </div>

              <div>
                <textarea
                  rows={3}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Share a comment about your technician, installation speed, or overall experience..."
                  className="w-full px-3.5 py-2 text-xs rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <button
                type="submit"
                disabled={submittingReview}
                className="px-5 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl shadow-xs transition"
              >
                {submittingReview ? 'Submitting...' : 'Submit Review'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
