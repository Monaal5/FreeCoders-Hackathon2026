import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { CheckCircle2, ArrowRight, IndianRupee } from 'lucide-react';
import SunPowerLogo from '../components/SunPowerLogo';
import {
  HeroSection,
  ValuePropositionSection,
  ApproachSection,
  MonitoringBanner,
  DayNightStorageSection,
  SolutionsCarouselSection,
  FutureVisionSection,
  TeamBanner,
  ProcessSection,
  ConversationBanner,
  SiteDetailModal,
  NAV_LINKS,
  OFFICE_INFO,
  scrollTo,
} from '../components/landing/LandingSections';

const EMPTY_FORM = {
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
};

export default function PublicEnquiry() {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [leadResult, setLeadResult] = useState(null);
  const [error, setError] = useState('');
  const [selectedSolution, setSelectedSolution] = useState(null);

  // Live estimated solar requirement based on electricity bill
  const estimatedBill = Number(formData.monthly_bill) || 0;
  const estimatedKW = estimatedBill > 0 ? (estimatedBill / 1200).toFixed(1) : '3.0';

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
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

  const scrollToContactAndFocus = () => {
    scrollTo('#contact');
    window.setTimeout(() => document.getElementById('enquiry-name')?.focus({ preventScroll: true }), 450);
  };

  const handleRequestQuoteFromModal = (title) => {
    setFormData((prev) => ({
      ...prev,
      comments: prev.comments ? prev.comments : `Interested in: ${title}`,
    }));
    setSelectedSolution(null);
    setSubmitted(false);
    scrollToContactAndFocus();
  };

  const field =
    'w-full border-b border-black/20 focus:border-black py-3 text-sm text-black placeholder:text-[#9a9a9a] bg-transparent outline-none transition-colors';
  const label = 'block text-[11px] font-medium text-[#808080]';

  return (
    <div className="min-h-screen w-full bg-white text-black">
      <main>
        <HeroSection onContactClick={scrollToContactAndFocus} />
        <ValuePropositionSection onLearnMore={() => scrollTo('#technology')} />
        <ApproachSection onOurProjectsClick={() => scrollTo('#solutions')} />
        <MonitoringBanner />
        <DayNightStorageSection onGetQuoteClick={scrollToContactAndFocus} />
        <SolutionsCarouselSection onSelectSolutionDetails={setSelectedSolution} />
        <FutureVisionSection />
        <TeamBanner onOurTeamClick={() => scrollTo('#process')} />
        <ProcessSection />
        <ConversationBanner onStartProjectClick={scrollToContactAndFocus} />
      </main>

      {/* Enquiry + footer (template layout, existing enquiry form & API) */}
      <footer id="contact" className="w-full bg-white px-6 md:px-10 pt-16 pb-12 md:py-24">
        <div className="flex flex-col lg:grid lg:grid-cols-[49fr_51fr] gap-12 lg:gap-16 items-start">
          {/* Headline + office / navigation */}
          <div className="w-full flex flex-col justify-between lg:h-full">
            <div>
              <div className="hidden lg:block mb-14">
                <SunPowerLogo variant="dark" />
              </div>
              <h2 className="text-[clamp(1.85rem,3.3vw,3.1rem)] font-medium leading-[1.08] tracking-[-0.03em] text-balance">
                <span className="text-[#808080]">Tell us about your site,</span>
                <br />
                <span className="text-black">we will plan the rest</span>
              </h2>
              <p className="mt-4 text-xs text-black/80 max-w-[320px] leading-relaxed">
                Book a free technical site feasibility survey. Takes less than 60 seconds — our engineering team will
                contact you with a proposal built around your numbers.
              </p>

              {estimatedBill > 0 && !submitted && (
                <div className="mt-8 inline-flex flex-col rounded-2xl border border-black/10 bg-neutral-50 px-5 py-4">
                  <span className="text-[11px] text-[#808080]">Estimated system</span>
                  <span className="text-3xl font-medium tracking-tight">~{estimatedKW} kW</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-8 mt-14 lg:mt-24">
              <div>
                <h3 className="text-xs font-semibold text-black mb-3">Office</h3>
                <ul className="space-y-1.5 text-xs text-[#404040]">
                  {OFFICE_INFO.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-black mb-3">Navigation</h3>
                <ul className="space-y-1.5 text-xs text-[#404040]">
                  {NAV_LINKS.map((l) => (
                    <li key={l.label}>
                      <a href={l.href} onClick={(e) => { e.preventDefault(); scrollTo(l.href); }} className="hover:text-black transition-colors">
                        {l.label}
                      </a>
                    </li>
                  ))}
                  <li>
                    <Link to="/login" className="hover:text-black transition-colors">
                      Staff sign in
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="w-full">
            {submitted ? (
              <div className="w-full rounded-3xl border border-black/10 bg-neutral-50 p-8" role="status">
                <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center mb-5">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-medium tracking-tight">Solar enquiry received</h3>
                <p className="mt-2 text-sm text-[#404040] leading-relaxed">
                  Thank you, <span className="font-medium text-black">{formData.customer_name}</span>. Lead reference{' '}
                  <span className="font-mono font-medium text-black">#{leadResult?.id}</span> has been logged into our system
                  and auto-assigned to sales staff{' '}
                  <span className="font-medium text-black">{leadResult?.assigned_to_name}</span>.
                </p>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 py-4 border-y border-black/10">
                  <div>
                    <div className="text-[11px] text-[#808080]">Estimated need</div>
                    <div className="text-base font-medium">~{estimatedKW} kW Solar</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#808080]">Assigned sales lead</div>
                    <div className="text-sm font-medium">{leadResult?.assigned_to_name || 'Staff'}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#808080]">Status</div>
                    <div className="mt-1 inline-block text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-black text-white">
                      NEW LEAD
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSubmitted(false);
                    setFormData(EMPTY_FORM);
                  }}
                  className="mt-6 rounded-full bg-black px-6 py-2.5 text-xs font-medium text-white hover:bg-black/85 cursor-pointer"
                >
                  Submit Another Enquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="w-full">
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="text-base font-semibold">Free Solar Assessment Form</h3>
                  <span className="text-[11px] text-[#808080]">* required</span>
                </div>

                {error && (
                  <div className="my-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm" role="alert">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 mt-4">
                  <div>
                    <label htmlFor="enquiry-name" className={label}>Full Name *</label>
                    <input id="enquiry-name" type="text" required name="customer_name" value={formData.customer_name} onChange={handleChange} className={field} placeholder="e.g. Vikram Joshi" />
                  </div>
                  <div>
                    <label className={label}>Phone / WhatsApp Number *</label>
                    <input type="tel" required name="phone" value={formData.phone} onChange={handleChange} className={field} placeholder="+91 98220 12345" />
                  </div>
                  <div>
                    <label className={label}>Email Address *</label>
                    <input type="email" required name="email" value={formData.email} onChange={handleChange} className={field} placeholder="vikram@example.com" />
                  </div>
                  <div>
                    <label className={label}>Average Monthly Electricity Bill (₹) *</label>
                    <div className="relative">
                      <IndianRupee className="w-3.5 h-3.5 absolute left-0 top-1/2 -translate-y-1/2 text-[#808080]" />
                      <input type="number" required min="500" name="monthly_bill" value={formData.monthly_bill} onChange={handleChange} className={`${field} pl-5`} placeholder="e.g. 4500" />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={label}>Site Address &amp; Landmark *</label>
                    <input type="text" required name="address" value={formData.address} onChange={handleChange} className={field} placeholder="Bungalow / Apartment Name, Street, Landmark" />
                  </div>
                  <div>
                    <label className={label}>City &amp; State *</label>
                    <div className="grid grid-cols-2 gap-4">
                      <input type="text" required name="city" value={formData.city} onChange={handleChange} className={field} placeholder="City" />
                      <input type="text" required name="state" value={formData.state} onChange={handleChange} className={field} placeholder="State" />
                    </div>
                  </div>
                  <div>
                    <label className={label}>PIN Code *</label>
                    <input type="text" required pattern="[0-9]{6}" name="pincode" value={formData.pincode} onChange={handleChange} className={field} placeholder="e.g. 411045" />
                  </div>
                  <div>
                    <label className={label}>Roof Type</label>
                    <select name="roof_type" value={formData.roof_type} onChange={handleChange} className={`${field} cursor-pointer`}>
                      <option value="Flat Concrete">Flat Concrete (RCC)</option>
                      <option value="Sloped Metal Sheet">Sloped Metal Sheet / Tin Shed</option>
                      <option value="Tiled Roof">Tiled / Mangalore Roof</option>
                      <option value="Ground Mount">Ground Mount</option>
                    </select>
                  </div>
                  <div>
                    <label className={label}>Approx. Roof Area (sq. ft.)</label>
                    <input type="number" name="roof_area_sqft" value={formData.roof_area_sqft} onChange={handleChange} className={field} placeholder="e.g. 600" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={label}>Additional Notes / Current Power Cuts</label>
                    <textarea rows={2} name="comments" value={formData.comments} onChange={handleChange} className={`${field} resize-none`} placeholder="e.g. Interested in battery backup / 3-phase connection available" />
                  </div>
                </div>

                <div className="pt-8 flex flex-col sm:flex-row sm:items-center gap-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-black px-8 py-3.5 md:py-3 text-sm font-medium text-white hover:bg-black/85 transition disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? 'Submitting Enquiry...' : 'Get Free Technical Site Survey'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <span className="text-[11px] text-[#808080]">No spam. One call from our engineering team.</span>
                </div>
              </form>
            )}
          </div>
        </div>

        <div className="mt-16 pt-6 border-t border-black/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[#808080]">
          <span>© {new Date().getFullYear()} SunPower. Solar energy &amp; storage.</span>
        </div>
      </footer>

      <SiteDetailModal solution={selectedSolution} onClose={() => setSelectedSolution(null)} onRequestQuote={handleRequestQuoteFromModal} />
    </div>
  );
}
