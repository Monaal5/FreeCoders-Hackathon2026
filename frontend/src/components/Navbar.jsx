import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Sun, LogOut, ClipboardList, HardHat, FileText, Globe, RefreshCw, Database } from 'lucide-react';

export default function Navbar() {
  const { user, logout, useMock, toggleMockMode, resetMockData } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItemClass = (path) => {
    const active = location.pathname.startsWith(path);
    return `inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition ${
      active
        ? 'bg-amber-50 text-amber-900 font-semibold shadow-xs'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
    }`;
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center text-white shadow-md shadow-amber-500/20 group-hover:scale-105 transition">
                <Sun className="w-6 h-6 animate-spin-slow" />
              </div>
              <div>
                <span className="font-extrabold text-xl tracking-tight text-slate-900">
                  Sun<span className="text-amber-500">Power</span>
                </span>
                <span className="hidden sm:inline-block ml-2 text-[10px] uppercase font-bold tracking-widest text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                  Solar CRM
                </span>
              </div>
            </Link>

            {/* Navigation Links based on role */}
            {user && (
              <nav className="hidden md:flex items-center gap-1.5 ml-4">
                {(user.role === 'ADMIN' || user.role === 'STAFF') && (
                  <Link to="/leads" className={navItemClass('/leads')}>
                    <ClipboardList className="w-4 h-4 text-amber-600" />
                    Lead Inbox
                  </Link>
                )}

                {user.role === 'TECHNICIAN' && (
                  <Link to="/surveys" className={navItemClass('/surveys')}>
                    <HardHat className="w-4 h-4 text-indigo-600" />
                    My Field Surveys
                  </Link>
                )}

                {(user.role === 'ADMIN' || user.role === 'STAFF') && (
                  <Link to="/surveys" className={navItemClass('/surveys')}>
                    <HardHat className="w-4 h-4 text-slate-500" />
                    Technician View
                  </Link>
                )}

                <Link to="/enquiry" target="_blank" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 hover:text-amber-700 bg-slate-50 hover:bg-amber-50 rounded-lg border border-slate-200 transition">
                  <Globe className="w-3.5 h-3.5 text-amber-500" />
                  Public Enquiry Page ↗
                </Link>
              </nav>
            )}
          </div>

          {/* Right section: Mode switch + User status */}
          <div className="flex items-center gap-3">
            {/* Mode Switcher pill */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleMockMode}
                title="Click to toggle between Mock Database and Local PostgreSQL"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition ${
                  useMock
                    ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>{useMock ? 'Mock DB (Offline Demo)' : 'Live Backend (PostgreSQL)'}</span>
              </button>

              {useMock && (
                <button
                  onClick={resetMockData}
                  title="Reset demo data to initial seed"
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {user ? (
              <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-semibold text-slate-800">{user.name}</div>
                  <div className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.2 inline-block rounded-full border border-amber-200">
                    {user.role}
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  title="Logout"
                  className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition"
                >
                  Sign In
                </Link>
                <Link
                  to="/enquiry"
                  className="px-4 py-2 text-sm font-semibold text-amber-900 bg-amber-400 hover:bg-amber-300 rounded-xl shadow-xs transition"
                >
                  Customer Enquiry
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
