import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Sun, Shield, User, HardHat, AlertCircle, ArrowRight } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('admin@sunpower.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/leads';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const result = await login(email, password);
    if (result.success) {
      if (result.user.role === 'TECHNICIAN') {
        navigate('/surveys', { replace: true });
      } else {
        navigate(from === '/login' ? '/leads' : from, { replace: true });
      }
    } else {
      setError(result.message || 'Invalid credentials');
    }
  };

  const handleQuickLogin = (roleEmail, defaultPath = '/leads') => {
    setEmail(roleEmail);
    setPassword('password123');
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-50 to-amber-50/30">
      <div className="max-w-md w-full space-y-8 bg-white p-8 sm:p-10 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
        {/* Brand header */}
        <div className="text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center text-white shadow-lg shadow-amber-500/30">
            <Sun className="w-8 h-8" />
          </div>
          <h2 className="mt-5 text-2xl font-extrabold text-slate-900 tracking-tight">
            SunPower Solar CRM
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Phase 1: Lead → Qualify → Survey → Approval → Quote
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-rose-50 text-rose-700 text-sm border border-rose-200">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
              placeholder="name@sunpower.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 shadow-lg shadow-amber-500/25 transition disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Demo Role Switcher (Crucial for Hackathon Demo & Judges) */}
        <div className="pt-6 border-t border-slate-100">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 text-center mb-3">
            Quick Fill Demo Roles
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin('admin@sunpower.com')}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition ${
                email === 'admin@sunpower.com'
                  ? 'border-amber-500 bg-amber-50 text-amber-900 font-bold'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <Shield className="w-4 h-4 text-purple-600 mb-1" />
              <span>Admin</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('staff@sunpower.com')}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition ${
                email === 'staff@sunpower.com'
                  ? 'border-amber-500 bg-amber-50 text-amber-900 font-bold'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <User className="w-4 h-4 text-amber-600 mb-1" />
              <span>Sales Staff</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('tech@sunpower.com')}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition ${
                email === 'tech@sunpower.com'
                  ? 'border-amber-500 bg-amber-50 text-amber-900 font-bold'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <HardHat className="w-4 h-4 text-indigo-600 mb-1" />
              <span>Technician</span>
            </button>
          </div>
          <p className="mt-2 text-[11px] text-center text-slate-400">
            Password: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">password123</code>
          </p>
        </div>
      </div>
    </div>
  );
}
