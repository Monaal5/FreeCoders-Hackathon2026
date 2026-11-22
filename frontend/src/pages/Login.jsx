import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, ArrowRight, ArrowLeft, KeyRound, Mail, Lock } from 'lucide-react';
import SunPowerLogo from '../components/SunPowerLogo';

export default function Login() {
  // No role picker: the role belongs to the account and comes back inside the signed token.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        navigate('/today', { replace: true });
      } else {
        navigate(from === '/login' ? '/leads' : from, { replace: true });
      }
    } else {
      setError(result.message || 'Invalid credentials');
    }
  };

  const inputClass =
    'w-full pl-11 pr-4 py-3 rounded-full bg-white/10 border border-white/20 text-sm text-white placeholder:text-white/45 outline-none transition focus:bg-white/15 focus:border-white/60';

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black text-white">
      {/* Background photography from the template */}
      <div className="absolute inset-0">
        <img src="/images/hero.jpg" alt="" className="w-full h-full object-cover scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/55" aria-hidden="true" />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-4 px-6 md:px-10 pt-6">
          <Link to="/enquiry" aria-label="SunPower public site">
            <SunPowerLogo variant="light" size="sm" />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/enquiry"
              className="glass-dark inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium text-white hover:bg-white/15 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Public Site</span>
            </Link>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 grid lg:grid-cols-2 items-center gap-10 px-6 md:px-10 py-10">
          <div className="hidden lg:block">
            <h1 className="text-[clamp(3rem,5vw,4.75rem)] font-medium leading-[1.03] tracking-[-0.03em] text-balance">
              Harvest the Sun.
              <br />
              Store the Power.
            </h1>
            <p className="mt-5 text-sm text-white/80 max-w-sm leading-relaxed">
              One workspace for the whole solar lifecycle — leads, surveys, quotes, orders, dispatch and on-site
              installation.
            </p>
          </div>

          <div className="w-full max-w-md mx-auto lg:ml-auto lg:mr-0">
            <div className="glass-dark rounded-[28px] p-8 sm:p-10 shadow-2xl shadow-black/40">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-white/60">SunPower Solar CRM · Team access</p>
                  <h2 className="mt-0.5 text-2xl font-medium tracking-tight">Sign in</h2>
                  <p className="mt-1 text-xs text-white/60">Lead → Qualify → Survey → Approval → Quote</p>
                </div>
              </div>

              {error && (
                <div className="mt-6 flex items-center gap-2.5 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-300/30 text-rose-100 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1.5 ml-4">Email address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-white/50" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClass}
                      placeholder="name@sunpower.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1.5 ml-4">Password</label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-white/50" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputClass}
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded-full text-sm font-medium text-black bg-white hover:bg-white/90 transition disabled:opacity-50"
                >
                  {loading ? 'Authenticating...' : 'Sign In'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              {/* No role buttons: sign in with your own account; the role is read from the signed token */}
              <div className="mt-7 pt-6 border-t border-white/15 flex gap-3 text-xs text-white/65">
                <KeyRound className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  Your role (Admin, Staff or Technician) comes from your account. You land on the right screens
                  automatically after signing in.
                  <span className="block mt-1 text-white/45">
                    Demo accounts: admin@, staff@, tech@sunpower.com · password123
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="pb-6 text-center text-[11px] text-white/50">
          Roles are enforced by the server on every request.
        </p>
      </div>
    </div>
  );
}
