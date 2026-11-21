import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Sun,
  LogOut,
  ClipboardList,
  HardHat,
  Globe,
  RefreshCw,
  Database,
  Package,
  Layers,
  Truck,
  TrendingUp,
  Menu,
  X,
} from 'lucide-react';
import SunPowerLogo from './SunPowerLogo';

export default function Navbar() {
  const { user, logout, useMock, toggleMockMode, resetMockData } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Same links per role as before – only the presentation changed.
  const links = [];
  if (user && (user.role === 'ADMIN' || user.role === 'STAFF')) {
    links.push(
      { to: '/leads', label: 'Leads', icon: ClipboardList },
      { to: '/orders', label: 'Orders & Dispatch', icon: Package },
      { to: '/inventory', label: 'Inventory', icon: Layers },
      { to: '/jobs', label: 'Crew Schedule', icon: Truck },
      { to: '/revenue', label: 'Revenue & Profit', icon: TrendingUp },
    );
  }
  if (user && user.role === 'TECHNICIAN') {
    links.push(
      { to: '/today', label: 'Today', icon: Sun },
      { to: '/surveys', label: 'My Tasks & To-Do', icon: HardHat },
      { to: '/jobs', label: 'Installation Schedule', icon: Truck },
    );
  }
  if (user && (user.role === 'ADMIN' || user.role === 'STAFF')) {
    links.push({ to: '/surveys', label: 'Technician View', icon: HardHat });
  }

  const navItemClass = (path) => {
    const active = location.pathname.startsWith(path);
    return `inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition ${
      active ? 'bg-black text-white shadow-sm' : 'text-neutral-600 hover:text-black hover:bg-white/70'
    }`;
  };

  return (
    <header className="sticky top-0 z-40 no-print">
      <div className="bg-white/55 backdrop-blur-2xl border-b border-white/70 shadow-[0_8px_30px_-18px_rgba(0,0,0,0.25)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Brand Logo */}
            <div className="flex items-center gap-4 min-w-0">
              <Link to="/" className="flex items-center gap-2 group shrink-0" aria-label="SunPower home">
                <SunPowerLogo variant="dark" size="xs" className="h-10" />
                <span className="hidden sm:inline-block text-[10px] uppercase font-semibold tracking-[0.2em] text-neutral-500 border border-black/10 bg-white/60 px-2 py-0.5 rounded-full">
                  CRM
                </span>
              </Link>

              {/* Navigation Links based on role */}
              {user && (
                <nav className="hidden xl:flex items-center gap-1 ml-2 p-1 rounded-full bg-white/40 border border-white/70">
                  {links.map(({ to, label, icon: Icon }) => (
                    <Link key={to + label} to={to} className={navItemClass(to)}>
                      <Icon className="w-3.5 h-3.5" />
                      <span>{label}</span>
                    </Link>
                  ))}
                  <Link
                    to="/enquiry"
                    target="_blank"
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-neutral-500 hover:text-black rounded-full transition"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Enquiry ↗</span>
                  </Link>
                </nav>
              )}
            </div>

            {/* Right section: Mode switch + User status */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="flex items-center gap-1">
                <button
                  onClick={toggleMockMode}
                  title="Click to toggle between Mock Database and Local PostgreSQL"
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border backdrop-blur transition ${
                    useMock
                      ? 'bg-white/60 text-neutral-800 border-black/10 hover:bg-white'
                      : 'bg-emerald-50/70 text-emerald-800 border-emerald-200 hover:bg-emerald-50'
                  }`}
                >
                  <Database className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{useMock ? 'Mock DB' : 'PostgreSQL'}</span>
                </button>

                {useMock && (
                  <button
                    onClick={resetMockData}
                    title="Reset demo data to initial seed"
                    className="p-1.5 text-neutral-500 hover:text-black rounded-full hover:bg-white/70"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {user ? (
                <div className="flex items-center gap-2.5 pl-2.5 border-l border-black/10">
                  <div className="text-right hidden sm:block leading-tight">
                    <div className="text-xs font-medium text-black">{user.name}</div>
                    <div className="text-[10px] font-medium tracking-wider text-neutral-500 uppercase">{user.role}</div>
                  </div>
                  <div className="hidden sm:flex w-8 h-8 rounded-full bg-black text-white items-center justify-center text-xs font-medium">
                    {(user.name || '?').charAt(0)}
                  </div>
                  <button
                    onClick={handleLogout}
                    title="Logout"
                    className="p-2 text-neutral-500 hover:text-rose-600 hover:bg-white/70 rounded-full transition"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setMobileOpen((v) => !v)}
                    aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
                    className="xl:hidden p-2 text-neutral-700 hover:bg-white/70 rounded-full transition"
                  >
                    {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    to="/login"
                    className="px-4 py-1.5 text-xs font-medium text-white bg-black hover:bg-black/85 rounded-full transition"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/enquiry"
                    className="px-4 py-1.5 text-xs font-medium text-black bg-white/70 border border-black/10 hover:bg-white rounded-full transition"
                  >
                    Enquiry
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile / tablet navigation */}
        {user && mobileOpen && (
          <div className="xl:hidden border-t border-white/70 px-4 pb-4 pt-3">
            <nav className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {links.map(({ to, label, icon: Icon }) => (
                <Link key={to + label} to={to} onClick={() => setMobileOpen(false)} className={navItemClass(to)}>
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </Link>
              ))}
              <Link
                to="/enquiry"
                target="_blank"
                onClick={() => setMobileOpen(false)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs text-neutral-500 hover:text-black rounded-full"
              >
                <Globe className="w-4 h-4" />
                <span>Enquiry ↗</span>
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
