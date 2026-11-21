// Phase 3 (B2) – Technician "Today" screen: the jobs this technician leads or is crew on.
// Phone first: one big card per job, tap the address to open Google Maps, tap the card to work the job.
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatKW } from '../utils/formatters';
import { MapPin, Phone, Sun, ChevronRight, RefreshCw, AlertTriangle, CalendarDays, Users, QrCode } from 'lucide-react';

const STATUS_STYLE = {
  SCHEDULED: 'bg-indigo-100 text-indigo-800',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
};
const STATUS_LABEL = { SCHEDULED: 'Scheduled', IN_PROGRESS: 'In progress', COMPLETED: 'Completed' };
const PACKAGE_LABEL = { PANEL_SET: 'Panel set', ON_GRID: 'On-Grid', OFF_GRID: 'Off-Grid' };

const dayKey = (d) => (d ? new Date(d).toLocaleDateString('en-CA') : null); // YYYY-MM-DD in local time

function JobCard({ job }) {
  const address = [job.address, job.city, job.pincode].filter(Boolean).join(', ');
  const notDelivered = job.status === 'SCHEDULED' && !['DELIVERED', 'INSTALLED'].includes(job.order_status);
  const expected = Number(job.serials_expected || 0);
  const verified = Number(job.serials_verified || 0);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base font-bold text-slate-900 truncate">{job.customer_name}</div>
            <div className="text-xs text-slate-500">
              {job.order_number} · {formatDate(job.scheduled_date)}
            </div>
          </div>
          <span className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold ${STATUS_STYLE[job.status] || 'bg-slate-100 text-slate-700'}`}>
            {STATUS_LABEL[job.status] || job.status}
          </span>
        </div>

        {address && (
          <a
            href={job.maps_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 active:bg-slate-100"
          >
            <MapPin className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <span className="flex-1">{address}</span>
            <span className="text-xs font-bold text-indigo-600 shrink-0 mt-0.5">Maps</span>
          </a>
        )}

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-xl bg-amber-50 border border-amber-100">
            <Sun className="w-4 h-4 text-amber-500 mx-auto" />
            <div className="text-sm font-bold text-slate-900">{formatKW(job.capacity_kw)}</div>
            <div className="text-[10px] text-slate-500">{PACKAGE_LABEL[job.package_kind || job.system_type] || job.system_type || 'System'}</div>
          </div>
          <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100">
            <QrCode className="w-4 h-4 text-indigo-500 mx-auto" />
            <div className="text-sm font-bold text-slate-900">
              {verified}/{expected}
            </div>
            <div className="text-[10px] text-slate-500">Serials checked</div>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
            <Users className="w-4 h-4 text-slate-500 mx-auto" />
            <div className="text-sm font-bold text-slate-900">{job.is_lead ? 'Lead' : 'Crew'}</div>
            <div className="text-[10px] text-slate-500 truncate">{job.crew_lead_name || 'No lead'}</div>
          </div>
        </div>

        {notDelivered && (
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Materials not delivered yet (order is {job.order_status}). The job can start once the delivery is confirmed.
            </span>
          </div>
        )}
      </div>

      <div className="flex border-t border-slate-100">
        {job.phone && (
          <a href={`tel:${job.phone}`} className="flex items-center justify-center gap-2 px-5 py-4 text-sm font-bold text-slate-700 border-r border-slate-100 active:bg-slate-50">
            <Phone className="w-4 h-4" /> Call
          </a>
        )}
        <Link
          to={`/field/jobs/${job.id}`}
          className="flex-1 flex items-center justify-center gap-2 py-4 text-sm font-bold text-white bg-emerald-600 active:bg-emerald-700"
        >
          {job.status === 'IN_PROGRESS' ? 'Continue job' : job.status === 'COMPLETED' ? 'View job' : 'Open job'}
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

export default function FieldToday() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get('/api/jobs/my');
      setJobs(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not load your jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const today = dayKey(new Date());
  const open = jobs.filter((j) => j.status !== 'COMPLETED');
  const todays = open.filter((j) => j.status === 'IN_PROGRESS' || !j.scheduled_date || dayKey(j.scheduled_date) <= today);
  const upcoming = open.filter((j) => !todays.includes(j));

  return (
    <div className="max-w-xl mx-auto px-4 py-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Today</h1>
          <p className="text-xs text-slate-500">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · {user?.name}
          </p>
        </div>
        <button
          onClick={load}
          className="p-3 rounded-xl bg-white border border-slate-200 text-slate-600 active:bg-slate-100"
          aria-label="Refresh"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800">{error}</div>}

      {loading && !jobs.length ? (
        <div className="py-16 text-center text-sm text-slate-400">Loading your jobs...</div>
      ) : (
        <>
          <section className="space-y-3">
            {todays.length ? (
              todays.map((j) => <JobCard key={j.id} job={j} />)
            ) : (
              <div className="p-6 rounded-2xl bg-white border border-dashed border-slate-300 text-center text-sm text-slate-500">
                No installation jobs for today.
              </div>
            )}
          </section>

          {upcoming.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <CalendarDays className="w-4 h-4" /> Upcoming
              </h2>
              {upcoming.map((j) => (
                <JobCard key={j.id} job={j} />
              ))}
            </section>
          )}

          <Link to="/surveys" className="block text-center text-xs font-bold text-indigo-600 py-2">
            Site surveys & other tasks →
          </Link>
        </>
      )}
    </div>
  );
}
