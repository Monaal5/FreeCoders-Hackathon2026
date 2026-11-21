import React, { useState } from 'react';
import { apiClient } from '../api/client';
import { Sun, CheckCircle2, Zap, Home, ShieldCheck, ArrowRight, IndianRupee } from 'lucide-react';

export default function PublicEnquiry() {
  const [formData, setFormData] = useState({
    customer_name: '',
    email: '',
    phone: '',
    address: '',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '',
    monthly_bill: '',
    roof_type: 'Flat Concrete',
    roof_area_sqft: '',
    comments: '',
  });

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [leadResult, setLeadResult] = useState(null);
  const [error, setError] = useState('');

  // Live estimated solar requirement based on electricity bill
  const estimatedBill = Number(formData.monthly_bill) || 0;
  const estimatedKW = estimatedBill > 0 ? (estimatedBill / 1200).toFixed(1) : '3.0';

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await apiClient.post('/api/public/enquiries', formData);
      if (res.success) {
        setSubmitted(true);
        setLeadResult(res.data);
      } else {
        setError(res.error?.message || 'Failed to submit enquiry');
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Error sending enquiry');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden py-16 px-4 sm:px-6 lg:px-8 border-b border-slate-800 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-6">
            <Sun className="w-4 h-4 animate-spin-slow" />
            PM Surya Ghar Muft Bijli Yojana Approved Installer
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            Slash Your Electricity Bill by <span className="text-amber-400">up to 90%</span>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto">
            Book a free solar technical site feasibility survey with SunPower. Instant capacity estimation and transparent turnkey installation quotes.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {submitted ? (
          <div className="bg-slate-800/80 border border-emerald-500/30 rounded-3xl p-8 sm:p-12 text-center shadow-2xl backdrop-blur-sm">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-emerald-500/30">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              Solar Enquiry Received Successfully!
            </h2>
            <p className="text-slate-300 max-w-lg mx-auto text-sm sm:text-base mb-6">
              Thank you, <span className="text-amber-400 font-semibold">{formData.customer_name}</span>. Lead reference <span className="font-mono text-emerald-400 font-bold">#{leadResult?.id}</span> has been logged into our system and auto-assigned to sales staff <span className="text-white font-semibold">{leadResult?.assigned_to_name}</span>.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl mx-auto mb-8 text-left bg-slate-900/60 p-4 rounded-2xl border border-slate-700/60">
              <div>
                <div className="text-xs text-slate-400">Estimated Need</div>
                <div className="text-lg font-bold text-amber-400">~{estimatedKW} kW Solar</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Assigned Sales Lead</div>
                <div className="text-sm font-semibold text-white">{leadResult?.assigned_to_name || 'Staff'}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Status</div>
                <div className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 inline-block mt-1">
                  NEW LEAD
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setSubmitted(false);
                setFormData({
                  customer_name: '',
                  email: '',
                  phone: '',
                  address: '',
                  city: 'Pune',
                  state: 'Maharashtra',
                  pincode: '',
                  monthly_bill: '',
                  roof_type: 'Flat Concrete',
                  roof_area_sqft: '',
                  comments: '',
                });
              }}
              className="px-6 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition"
            >
              Submit Another Enquiry
            </button>
          </div>
        ) : (
          <div className="bg-slate-800/90 rounded-3xl border border-slate-700/80 p-6 sm:p-10 shadow-2xl">
            <div className="flex items-center justify-between pb-6 border-b border-slate-700/80 mb-8">
              <div>
                <h2 className="text-xl font-bold text-white">Free Solar Assessment Form</h2>
                <p className="text-xs sm:text-sm text-slate-400">
                  Takes less than 60 seconds. Our engineering team will contact you.
                </p>
              </div>
              {estimatedBill > 0 && (
                <div className="text-right bg-amber-500/10 border border-amber-500/20 px-3.5 py-2 rounded-2xl">
                  <div className="text-[11px] text-amber-400 font-semibold uppercase">Estimated System</div>
                  <div className="text-base font-extrabold text-amber-300">~{estimatedKW} kW</div>
                </div>
              )}
            </div>

            {error && (
              <div className="p-3.5 mb-6 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-300 mb-1.5">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    name="customer_name"
                    value={formData.customer_name}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:outline-none focus:border-amber-400 text-white text-sm"
                    placeholder="e.g. Vikram Joshi"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-300 mb-1.5">
                    Phone / WhatsApp Number *
                  </label>
                  <input
                    type="tel"
                    required
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:outline-none focus:border-amber-400 text-white text-sm"
                    placeholder="+91 98220 12345"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-300 mb-1.5">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:outline-none focus:border-amber-400 text-white text-sm"
                    placeholder="vikram@example.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-300 mb-1.5">
                    Average Monthly Electricity Bill (₹) *
                  </label>
                  <div className="relative">
                    <IndianRupee className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                    <input
                      type="number"
                      required
                      min="500"
                      name="monthly_bill"
                      value={formData.monthly_bill}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:outline-none focus:border-amber-400 text-white text-sm"
                      placeholder="e.g. 4500"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-300 mb-1.5">
                    Site Address & Landmark *
                  </label>
                  <input
                    type="text"
                    required
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:outline-none focus:border-amber-400 text-white text-sm"
                    placeholder="Bungalow / Apartment Name, Street, Landmark"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-300 mb-1.5">
                    City & State *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      className="px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm"
                      placeholder="City"
                    />
                    <input
                      type="text"
                      required
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      className="px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm"
                      placeholder="State"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-300 mb-1.5">
                    PIN Code *
                  </label>
                  <input
                    type="text"
                    required
                    pattern="[0-9]{6}"
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:outline-none focus:border-amber-400 text-white text-sm"
                    placeholder="e.g. 411045"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-300 mb-1.5">
                    Roof Type
                  </label>
                  <select
                    name="roof_type"
                    value={formData.roof_type}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm"
                  >
                    <option value="Flat Concrete">Flat Concrete (RCC)</option>
                    <option value="Sloped Metal Sheet">Sloped Metal Sheet / Tin Shed</option>
                    <option value="Tiled Roof">Tiled / Mangalore Roof</option>
                    <option value="Ground Mount">Ground Mount</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-300 mb-1.5">
                    Approx. Roof Area (sq. ft.)
                  </label>
                  <input
                    type="number"
                    name="roof_area_sqft"
                    value={formData.roof_area_sqft}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm"
                    placeholder="e.g. 600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-300 mb-1.5">
                  Additional Notes / Current Power Cuts
                </label>
                <textarea
                  rows={2}
                  name="comments"
                  value={formData.comments}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm"
                  placeholder="e.g. Interested in battery backup / 3-phase connection available"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-extrabold text-base shadow-xl shadow-amber-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Submitting Enquiry...' : 'Get Free Technical Site Survey'}
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
