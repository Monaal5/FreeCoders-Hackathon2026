import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import SunPowerLogo from '../SunPowerLogo';

// ---------------------------------------------------------------------------
// Content for the public site (template layout, SunPower / India context)
// ---------------------------------------------------------------------------
export const NAV_LINKS = [
  { label: 'Home', href: '#home' },
  { label: 'Storage', href: '#storage' },
  { label: 'Technology', href: '#technology' },
  { label: 'Solutions', href: '#solutions' },
  { label: 'About', href: '#about' },
];

export const HERO_SLIDES = [
  { id: 'pune', location: 'Pune', capacity: '5 kW Rooftop On-Grid', image: '/images/hero.jpg' },
  { id: 'jaipur', location: 'Jaipur', capacity: '3 kW Residential On-Grid', image: '/images/agri.jpg' },
  { id: 'noida', location: 'Noida', capacity: '5 kW School Rooftop', image: '/images/commercial.jpg' },
  { id: 'dehradun', location: 'Dehradun', capacity: '3 kW Off-Grid + Battery', image: '/images/dusk.jpg' },
  { id: 'bhopal', location: 'Bhopal', capacity: '3 kW Rooftop On-Grid', image: '/images/aerial.jpg' },
  { id: 'kanpur', location: 'Kanpur', capacity: '2 kW Home Panel Set', image: '/images/hero.jpg' },
];

const INCLUDED_ITEMS = [
  { title: 'Site survey', description: 'Free technical feasibility visit' },
  { title: 'Solar + storage', description: 'On-grid, off-grid or panel-only packages' },
  { title: 'Installation', description: 'Commissioning, certificate and warranty' },
];

export const SITE_SOLUTIONS = [
  {
    id: 'ongrid',
    title: 'On-grid rooftop systems',
    description: 'Grid-tied rooftop solar that cuts your monthly bill and exports surplus power to the grid.',
    image: '/images/hero.jpg',
    capacityRange: '1 kW – 5 kW',
    storagePairing: 'Grid-tied, net metering',
    highlights: [
      'Panels, inverter, ACDB/DCDB, earthing and lightning arrestor included',
      'Eligible for PM Surya Ghar Muft Bijli Yojana subsidy',
      'Serial-tracked panels and inverter with manufacturer warranty',
    ],
  },
  {
    id: 'offgrid',
    title: 'Off-grid with battery backup',
    description: 'Stable power for homes and farms where outages are frequent, with storage built in from day one.',
    image: '/images/dusk.jpg',
    capacityRange: '1 kW – 5 kW',
    storagePairing: '150 Ah battery bank + MPPT controller',
    highlights: [
      'Everything in on-grid plus battery storage and rack',
      'Automatic backup during power cuts',
      'Charge controller sized to your real consumption',
    ],
  },
  {
    id: 'commercial',
    title: 'Commercial and institutional',
    description: 'Lower peak demand charges for schools, offices and shops with a turnkey rooftop plant.',
    image: '/images/commercial.jpg',
    capacityRange: '5 kW and above',
    storagePairing: 'On-grid or hybrid',
    highlights: [
      'Structural survey and shading analysis on site',
      'GST invoice, quotation PDF and transparent BOM',
      'Signed completion certificate with generation reading',
    ],
  },
];

export const OFFICE_INFO = ['Pune, Maharashtra', 'Mon–Sat, 9:00–18:00', 'Site visits by appointment', 'hello@sunpower.com', '+91 98000 00001'];

const scrollTo = (href) => document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });

const primaryBtn =
  'w-full md:w-auto rounded-full bg-black px-7 py-3 md:py-2.5 text-sm font-medium text-white transition-colors hover:bg-black/85 cursor-pointer';
const lightBtn =
  'rounded-full bg-white px-7 py-3 md:py-2.5 text-sm font-medium text-black transition-colors hover:bg-white/90 cursor-pointer';
const h2Class = 'text-[clamp(1.85rem,3.3vw,3.1rem)] font-medium leading-[1.08] tracking-[-0.03em] text-balance';

// ---------------------------------------------------------------------------
export function HeroSection({ onContactClick }) {
  const [active, setActive] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const t = window.setInterval(() => setActive((p) => (p + 1) % HERO_SLIDES.length), 12000);
    return () => window.clearInterval(t);
  }, []);

  const slide = HERO_SLIDES[active];
  const nav = (href) => {
    setMobileOpen(false);
    scrollTo(href);
  };

  return (
    <section
      id="home"
      className="relative w-full min-h-[720px] md:min-h-[820px] lg:h-[92vh] lg:max-h-[960px] flex flex-col justify-between overflow-hidden bg-black text-white"
    >
      <div className="absolute inset-0">
        {HERO_SLIDES.map((s, i) => (
          <img
            key={s.id}
            src={s.image}
            alt={`${s.location} — ${s.capacity}`}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
              i === active ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/45" aria-hidden="true" />
      </div>

      {/* Top navigation */}
      <header className="relative z-20 flex items-center justify-between gap-8 px-6 md:px-10 pt-6 md:pt-7">
        <a href="#home" onClick={(e) => { e.preventDefault(); nav('#home'); }} aria-label="SunPower home">
          <SunPowerLogo variant="light" size="sm" />
        </a>

        <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-7 text-sm text-white/90">
          {NAV_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              onClick={(e) => { e.preventDefault(); nav(l.href); }}
              className="whitespace-nowrap hover:text-white underline-offset-4 hover:underline"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2 shrink-0">
          <Link
            to="/login"
            className="glass-dark whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-medium text-white hover:bg-white/15 transition"
          >
            Staff Sign In
          </Link>
          <button type="button" onClick={onContactClick} className="whitespace-nowrap rounded-full bg-white px-6 py-2.5 text-sm font-medium text-black hover:bg-white/90 cursor-pointer">
            Contact Us
          </button>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((p) => !p)}
          aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          className="md:hidden inline-flex items-center justify-center w-11 h-11 text-white rounded-full hover:bg-white/10 cursor-pointer"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {mobileOpen && (
        <div className="md:hidden absolute inset-x-0 top-[76px] z-30 mx-6 rounded-2xl glass-dark bg-black/60 p-6">
          <nav className="flex flex-col gap-4">
            {NAV_LINKS.map((l) => (
              <a key={l.label} href={l.href} onClick={(e) => { e.preventDefault(); nav(l.href); }} className="text-base font-medium text-white/90 hover:text-white py-1">
                {l.label}
              </a>
            ))}
            <Link to="/login" className="mt-2 w-full text-center rounded-full border border-white/30 px-6 py-3 text-sm font-medium text-white">
              Staff Sign In
            </Link>
            <button type="button" onClick={() => { setMobileOpen(false); onContactClick(); }} className="w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black cursor-pointer">
              Contact Us
            </button>
          </nav>
        </div>
      )}

      {/* Hero content */}
      <div className="relative z-10 px-6 md:px-10 pb-6 md:pb-8 flex flex-col justify-end flex-1">
        <div className="hidden md:flex items-end justify-between gap-8 pb-10">
          <h1 className="text-[clamp(3rem,5.4vw,5rem)] font-medium leading-[1.03] tracking-[-0.03em] text-white text-balance max-w-2xl">
            Harvest the Sun.
            <br />
            Store the Power.
          </h1>
          <div className="max-w-[285px]">
            <p className="text-sm text-white/90 leading-snug">
              Turnkey rooftop solar and battery storage, from free site survey to commissioning. Cut your electricity
              bill by up to 90%.
            </p>
            <p className="mt-3 text-[11px] text-white/60">PM Surya Ghar Muft Bijli Yojana approved installer</p>
          </div>
        </div>

        <div className="md:hidden flex flex-col items-center text-center my-auto pt-12 pb-8">
          <h1 className="text-4xl font-medium leading-[1.06] tracking-[-0.03em] text-white text-balance">
            Harvest the Sun.
            <br />
            Store the Power.
          </h1>
          <p className="mt-4 text-sm text-white/90 max-w-[280px] leading-snug">
            Turnkey rooftop solar and battery storage, from free site survey to commissioning
          </p>
          <button type="button" onClick={onContactClick} className="mt-7 rounded-full bg-white px-8 py-3 text-sm font-medium text-black cursor-pointer">
            Contact Us
          </button>
        </div>

        <div className="w-full pt-4">
          <div className="hidden md:block mb-2.5 text-xs leading-tight text-white">
            <div className="font-medium">{slide.location}</div>
            <div className="text-white/80">{slide.capacity}</div>
          </div>
          <div className="hidden md:grid grid-cols-6 gap-2.5" role="tablist" aria-label="Installation showcase">
            {HERO_SLIDES.map((s, i) => (
              <button key={s.id} type="button" role="tab" aria-selected={i === active} aria-label={`${s.location} — ${s.capacity}`} onClick={() => setActive(i)} className="group py-2 cursor-pointer">
                <span className={`block h-[2px] w-full rounded-full transition-colors ${i === active ? 'bg-white' : 'bg-white/40 group-hover:bg-white/70'}`} />
              </button>
            ))}
          </div>
          <div className="flex md:hidden items-center justify-center gap-1.5 pt-2">
            {HERO_SLIDES.map((s, i) => (
              <button key={s.id} type="button" aria-label={s.location} onClick={() => setActive(i)} className={`h-1.5 rounded-full transition-all cursor-pointer ${i === active ? 'w-5 bg-white' : 'w-1.5 bg-white/45'}`} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ValuePropositionSection({ onLearnMore }) {
  return (
    <section id="about" className="w-full bg-white px-6 md:px-10 py-16 md:py-24">
      <div className="storia-grid gap-6 items-start">
        <div className="lg:col-span-2">
          <h2 className={h2Class}>
            <span className="text-[#808080]">Building the Future Today</span>
            <br />
            <span className="text-black">with Solar and Storage</span>
          </h2>
        </div>
        <div className="hidden lg:flex justify-end">
          <p className="text-xs text-[#808080] text-right whitespace-nowrap">Clean power, available day and night.</p>
        </div>
      </div>
      <div className="mt-10 md:mt-28 storia-grid gap-8 items-end">
        <div className="hidden lg:block">
          <SunPowerLogo variant="dark" />
        </div>
        <div className="lg:col-span-2">
          <p className="text-[clamp(1.3rem,2.3vw,2.15rem)] font-medium leading-[1.2] tracking-[-0.025em] max-w-xl">
            <span className="text-[#808080]">Every system is sized from your electricity bill, so </span>
            <span className="text-black">the energy you produce pays for itself</span>
            <span className="text-[#808080]"> — day or night</span>
          </p>
          <button type="button" onClick={onLearnMore} className={`mt-8 ${primaryBtn}`}>
            Learn More
          </button>
        </div>
      </div>
    </section>
  );
}

export function ApproachSection({ onOurProjectsClick }) {
  return (
    <section id="technology" className="w-full bg-white px-6 md:px-10 py-14 md:py-24">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
        <div className="lg:col-span-6 flex flex-col justify-between">
          <div>
            <p className="text-xs text-[#808080] mb-4 md:mb-6">Our approach</p>
            <h2 className={h2Class}>
              <span className="text-black">Carefully Engineered to</span>
              <br />
              <span className="text-[#808080]">Every Cell and Panel</span>
            </h2>
            <p className="mt-4 text-xs md:text-sm text-black/80 max-w-[290px] leading-relaxed">
              Every plant is planned around your roof after a technical site survey, with storage available from day one
            </p>
          </div>
          <div className="my-8 lg:hidden rounded-2xl overflow-hidden aspect-[4/3] bg-neutral-100">
            <img src="/images/approach.jpg" alt="Solar engineer inspecting a panel array" className="w-full h-full object-cover" />
          </div>
          <div className="mt-4 lg:mt-14">
            <h3 className="text-base md:text-lg font-semibold text-black mb-5">What&apos;s included</h3>
            <ul className="space-y-4">
              {INCLUDED_ITEMS.map((item) => (
                <li key={item.title} className="grid grid-cols-1 sm:grid-cols-[170px_1fr] gap-1 sm:gap-4 text-xs md:text-sm">
                  <span className="font-medium text-black flex items-center gap-2">
                    <span aria-hidden="true" className="inline-block w-1 h-1 rounded-full bg-black" />
                    {item.title}
                  </span>
                  <span className="text-[#808080] pl-3 sm:pl-0">{item.description}</span>
                </li>
              ))}
            </ul>
            <button type="button" onClick={onOurProjectsClick} className={`mt-9 ${primaryBtn}`}>
              Our Solutions
            </button>
          </div>
        </div>
        <div className="hidden lg:block lg:col-span-6">
          <div className="w-full h-full min-h-[540px] rounded-2xl overflow-hidden bg-neutral-100">
            <img src="/images/approach.jpg" alt="Solar engineer inspecting a panel array" className="w-full h-full object-cover" />
          </div>
        </div>
      </div>
    </section>
  );
}

export function MonitoringBanner() {
  return (
    <section className="relative w-full min-h-[480px] md:min-h-[620px] flex flex-col justify-between overflow-hidden bg-black text-white px-6 md:px-10 py-9 md:py-12">
      <div className="absolute inset-0">
        <img src="/images/dusk.jpg" alt="Solar arrays at dusk" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/45" aria-hidden="true" />
      </div>
      <div className="relative z-10 flex justify-center md:justify-start">
        <SunPowerLogo variant="light" />
      </div>
      <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <h2 className="text-[clamp(2.1rem,4.6vw,4.3rem)] font-medium leading-[1.03] tracking-[-0.03em] text-center md:text-left text-balance">
          Designed to last
          <br />
          long after launch
        </h2>
        <p className="text-xs md:text-sm text-white/90 max-w-[265px] mx-auto md:mx-0 text-center md:text-left leading-snug">
          Every panel, inverter and battery is serial-tracked from warehouse to rooftop, with warranties you can look up
          any time
        </p>
      </div>
    </section>
  );
}

export function DayNightStorageSection({ onGetQuoteClick }) {
  return (
    <section id="storage" className="w-full bg-white px-6 md:px-10 py-16 md:py-24">
      <div className="storia-grid gap-10 items-start">
        <div className="hidden lg:flex flex-col justify-between min-h-[340px]">
          <p className="text-xs text-[#808080] max-w-[260px] leading-relaxed">
            Solar panels only produce while the sun is up. Battery storage keeps that energy ready for when you need it.
          </p>
          <div className="mt-16 w-full max-w-[290px] aspect-[16/10] rounded-2xl overflow-hidden bg-neutral-100">
            <img src="/images/storage.jpg" alt="Two solar engineers reviewing site plans" className="w-full h-full object-cover" />
          </div>
        </div>
        <div className="lg:col-span-2">
          <h2 className="text-[clamp(1.95rem,3.6vw,3.25rem)] font-medium leading-[1.08] tracking-[-0.03em] text-center lg:text-left text-balance">
            <span className="text-[#808080]">Energy you make</span>
            <br />
            <span className="text-[#808080]">by day, </span>
            <span className="text-black">there exactly</span>
            <br />
            <span className="text-black">when you need it.</span>
          </h2>
          <div className="my-8 lg:hidden rounded-2xl overflow-hidden aspect-[16/10] max-w-md mx-auto bg-neutral-100">
            <img src="/images/storage.jpg" alt="Two solar engineers reviewing site plans" className="w-full h-full object-cover" />
          </div>
          <p className="mt-6 text-xs md:text-sm text-black/80 max-w-[375px] mx-auto lg:mx-0 text-center lg:text-left leading-relaxed">
            Whether it&apos;s a home, a school or a shop, every system is sized to your real consumption. You get backup
            during power cuts, lower bills and one team responsible for the result.
          </p>
          <div className="mt-8 flex justify-center lg:justify-start">
            <button type="button" onClick={onGetQuoteClick} className={primaryBtn}>
              Get a quote
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SolutionsCarouselSection({ onSelectSolutionDetails }) {
  const [activeIndex, setActiveIndex] = useState(1);
  const n = SITE_SOLUTIONS.length;
  const prev = (activeIndex - 1 + n) % n;
  const next = (activeIndex + 1) % n;
  const active = SITE_SOLUTIONS[activeIndex];
  const side =
    'relative z-10 w-[140px] sm:w-[260px] md:w-[380px] lg:w-[440px] h-[180px] sm:h-[260px] md:h-[340px] rounded-2xl overflow-hidden bg-neutral-100 shrink-0 transition-transform duration-300 hover:scale-[1.01] cursor-pointer';

  return (
    <section id="solutions" className="w-full bg-white px-6 md:px-10 py-16 md:py-24 overflow-hidden">
      <div className="text-center max-w-2xl mx-auto">
        <p className="text-xs text-[#808080] mb-3">Our solutions</p>
        <h2 className="text-[clamp(1.85rem,3.5vw,3.15rem)] font-medium leading-[1.08] tracking-[-0.03em] text-black text-balance">
          Built for every kind of roof.
        </h2>
        <p className="mt-4 text-xs text-[#808080] max-w-[255px] mx-auto leading-relaxed">
          Different scale, one approach: solar and storage designed together
        </p>
      </div>
      <div className="mt-12 md:mt-16 max-w-[1360px] mx-auto">
        <div className="relative flex items-center justify-center">
          <button type="button" onClick={() => setActiveIndex(prev)} aria-label={`Select ${SITE_SOLUTIONS[prev].title}`} className={`${side} -mr-10 sm:-mr-16 md:-mr-20`}>
            <img src={SITE_SOLUTIONS[prev].image} alt={SITE_SOLUTIONS[prev].title} className="w-full h-full object-cover brightness-95" />
          </button>
          <div className="relative z-20 w-[230px] sm:w-[320px] md:w-[420px] lg:w-[460px] h-[250px] sm:h-[330px] md:h-[420px] lg:h-[440px] rounded-2xl overflow-hidden bg-neutral-100 shadow-2xl shrink-0">
            <img src={active.image} alt={active.title} className="w-full h-full object-cover" />
          </div>
          <button type="button" onClick={() => setActiveIndex(next)} aria-label={`Select ${SITE_SOLUTIONS[next].title}`} className={`${side} -ml-10 sm:-ml-16 md:-ml-20`}>
            <img src={SITE_SOLUTIONS[next].image} alt={SITE_SOLUTIONS[next].title} className="w-full h-full object-cover brightness-95" />
          </button>
        </div>
        <div className="mt-6 w-full max-w-[460px] mx-auto flex flex-col md:flex-row md:items-start justify-between gap-4 text-center md:text-left">
          <div>
            <h3 className="text-sm font-semibold text-black">{active.title}</h3>
            <p className="mt-1 text-xs text-[#808080] max-w-[270px] mx-auto md:mx-0 leading-relaxed">{active.description}</p>
          </div>
          <button type="button" onClick={() => onSelectSolutionDetails(active)} className="w-full md:w-auto rounded-full bg-black px-6 py-3 md:py-2.5 text-xs md:text-sm font-medium text-white whitespace-nowrap shrink-0 hover:bg-black/85 cursor-pointer">
            See more
          </button>
        </div>
      </div>
    </section>
  );
}

export function FutureVisionSection() {
  return (
    <section className="w-full bg-white px-6 md:px-10 py-16 md:py-24">
      <div className="storia-grid gap-6 items-start">
        <div className="lg:col-span-2">
          <h2 className={`${h2Class} text-center lg:text-left max-w-[300px] mx-auto lg:max-w-none lg:mx-0`}>
            <span className="text-black">Advanced </span>
            <span className="text-[#808080]">energy solutions</span>
            <br className="hidden lg:inline" /> <span className="text-black">designed for your future</span>
          </h2>
        </div>
        <div className="hidden lg:flex justify-end">
          <SunPowerLogo variant="dark" />
        </div>
      </div>
      <div className="mt-10 md:mt-24 storia-grid gap-8 items-end">
        <div className="hidden lg:block">
          <p className="text-[11px] text-[#808080] leading-relaxed">
            Powering progress through innovation.
            <br />
            Building a more sustainable tomorrow.
          </p>
        </div>
        <div className="lg:col-span-2">
          <p className="text-xs text-black/85 max-w-[235px] mx-auto lg:mx-0 text-center lg:text-left leading-relaxed">
            Solar power and battery storage, planned as one system around your site, so it keeps working for you well
            into the future
          </p>
          <p className="mt-10 md:mt-16 text-[clamp(1.3rem,2.3vw,2.15rem)] font-medium leading-[1.2] tracking-[-0.025em] max-w-xl mx-auto lg:mx-0 text-center lg:text-left">
            <span className="text-[#808080]">The energy you generate today, </span>
            <span className="text-black">stored and ready tomorrow</span>
            <span className="text-[#808080]">, in a system designed to serve your home for 25 years</span>
          </p>
        </div>
      </div>
    </section>
  );
}

export function TeamBanner({ onOurTeamClick }) {
  return (
    <section className="relative w-full min-h-[600px] md:min-h-[640px] flex flex-col justify-between overflow-hidden bg-neutral-900 text-white px-6 md:px-10 py-9 md:py-12">
      <div className="absolute inset-0">
        <img src="/images/team.jpg" alt="Solar engineers inspecting plans on site at sunset" className="w-full h-full object-cover object-[24%_100%] md:object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-black/25 md:bg-gradient-to-l md:from-black/45 md:via-black/15 md:to-transparent" aria-hidden="true" />
      </div>
      <div className="relative z-10 hidden md:grid grid-cols-12 items-start">
        <div className="col-span-6">
          <SunPowerLogo variant="light" />
        </div>
        <div className="col-span-6">
          <h2 className="text-[clamp(2rem,4vw,3.75rem)] font-medium leading-[1.06] tracking-[-0.03em] text-balance">
            Engineered by people
            <br />
            who stay until it runs
          </h2>
        </div>
      </div>
      <div className="relative z-10 hidden md:grid grid-cols-12 items-end pb-4">
        <div className="col-span-6" />
        <div className="col-span-6">
          <p className="text-xs text-white/95 max-w-[300px] leading-relaxed">
            From the first survey to the signed completion certificate, the same crew stands behind every decision on
            site, so the system you receive is built, tested and ready to run
          </p>
          <button type="button" onClick={onOurTeamClick} className={`mt-5 ${lightBtn}`}>
            Our process
          </button>
        </div>
      </div>
      <div className="relative z-10 md:hidden flex flex-col items-center text-center pt-2 pb-56">
        <h2 className="text-2xl font-medium leading-[1.1] tracking-[-0.02em] max-w-[240px]">Engineered by people who stay until it runs</h2>
        <button type="button" onClick={onOurTeamClick} className={`mt-5 w-full max-w-[220px] ${lightBtn}`}>
          Our process
        </button>
      </div>
    </section>
  );
}

export function ProcessSection() {
  return (
    <section id="process" className="w-full bg-white px-6 md:px-10 py-16 md:py-24">
      <div className="storia-grid gap-6">
        <div className="lg:col-span-2">
          <h2 className={`${h2Class} text-center lg:text-left`}>
            <span className="text-black">A Clear Plan and an Open</span>
            <br />
            <span className="text-black">Process </span>
            <span className="text-[#808080]">from Start to Finish</span>
          </h2>
        </div>
      </div>
      <div className="mt-8 md:mt-20 storia-grid gap-6">
        <div className="hidden lg:block" />
        <div className="lg:col-span-2">
          <p className="text-[clamp(1.2rem,2.2vw,2rem)] font-medium leading-[1.2] tracking-[-0.025em] max-w-xl mx-auto lg:mx-0 text-center lg:text-left">
            <span className="text-[#808080]">Enquiry, survey, quotation, order, installation — </span>
            <span className="text-black">you can track every step of your project online</span>
          </p>
        </div>
      </div>
      <div className="mt-10 md:mt-14 storia-grid gap-8 items-end">
        <div className="hidden lg:block">
          <p className="text-[11px] text-[#808080] leading-relaxed">
            Agreed together.
            <br />
            Built together.
          </p>
        </div>
        <div className="grid grid-cols-2 lg:contents gap-6 text-center lg:text-left">
          <p className="text-xs text-black/85 max-w-[250px] mx-auto lg:mx-0 leading-relaxed">
            It starts on site: a technician surveys your roof, then you get a clear quotation with every part listed
            before a single panel is dispatched
          </p>
          <p className="text-xs text-black/85 max-w-[250px] mx-auto lg:mx-0 leading-relaxed">
            It ends with a handover you can see: the system switched on, tested in front of you and signed off with a
            completion certificate
          </p>
        </div>
      </div>
    </section>
  );
}

export function ConversationBanner({ onStartProjectClick }) {
  return (
    <section className="relative w-full min-h-[480px] md:min-h-[600px] flex flex-col items-center justify-center overflow-hidden bg-black text-white px-6 md:px-10 py-16 text-center">
      <div className="absolute inset-0">
        <img src="/images/aerial.jpg" alt="Aerial view of solar panel rows" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/45" aria-hidden="true" />
      </div>
      <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center">
        <h2 className="text-[clamp(2rem,4.5vw,4.15rem)] font-medium leading-[1.05] tracking-[-0.03em] text-balance">
          Every plant starts
          <br />
          with a conversation
        </h2>
        <p className="mt-5 text-xs md:text-sm text-white/90 max-w-[300px] leading-relaxed">
          Share a few details about your site, and we will come back with a clear plan, timeline and budget for solar
          and storage
        </p>
        <button type="button" onClick={onStartProjectClick} className={`mt-8 w-full max-w-[220px] md:w-auto ${lightBtn}`}>
          Start a project
        </button>
      </div>
    </section>
  );
}

export function SiteDetailModal({ solution, onClose, onRequestQuote }) {
  useEffect(() => {
    if (!solution) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [solution, onClose]);

  if (!solution) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-xl rounded-3xl bg-white/90 backdrop-blur-2xl border border-white/70 text-black overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative h-56 w-full bg-neutral-100">
          <img src={solution.image} alt={solution.title} className="w-full h-full object-cover" />
          <button type="button" onClick={onClose} aria-label="Close" className="absolute top-4 right-4 inline-flex items-center justify-center w-9 h-9 rounded-full bg-white text-black hover:bg-neutral-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 md:p-8">
          <p className="text-xs text-[#808080]">System configuration</p>
          <h3 className="mt-1 text-2xl font-medium tracking-tight">{solution.title}</h3>
          <p className="mt-2 text-sm text-[#404040] leading-relaxed">{solution.description}</p>
          <div className="mt-6 grid grid-cols-2 gap-4 py-4 border-y border-black/10 text-sm">
            <div>
              <span className="block text-xs text-[#808080]">Solar capacity</span>
              <span className="mt-0.5 block font-medium tabular-nums">{solution.capacityRange}</span>
            </div>
            <div>
              <span className="block text-xs text-[#808080]">Storage / grid</span>
              <span className="mt-0.5 block font-medium">{solution.storagePairing}</span>
            </div>
          </div>
          <ul className="mt-5 space-y-2.5">
            {solution.highlights.map((h) => (
              <li key={h} className="flex items-start gap-2.5 text-xs md:text-sm text-[#333]">
                <span aria-hidden="true" className="mt-1.5 w-1.5 h-1.5 rounded-full bg-black shrink-0" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
          <div className="mt-7 flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-full px-5 py-2.5 text-xs md:text-sm font-medium text-[#555] hover:text-black cursor-pointer">
              Close
            </button>
            <button type="button" onClick={() => onRequestQuote(solution.title)} className="rounded-full bg-black px-6 py-2.5 text-xs md:text-sm font-medium text-white hover:bg-black/85 cursor-pointer">
              Request a proposal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { scrollTo };
