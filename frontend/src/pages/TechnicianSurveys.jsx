import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatDateTime, formatDate, formatKW } from '../utils/formatters';
import {
  HardHat,
  Calendar,
  MapPin,
  Phone,
  CheckCircle,
  Clock,
  ChevronRight,
  Camera,
  AlertCircle,
  Truck,
  Package,
  QrCode,
  Layers,
  Wrench,
} from 'lucide-react';

export default function TechnicianSurveys() {
  const [surveys, setSurveys] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('TODO'); // 'TODO' | 'INSTALLATIONS' | 'SURVEYS' | 'COMPLETED' | 'ALL'
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchMyWork = async () => {
    setLoading(true);
    try {
      const [surveysRes, jobsRes] = await Promise.all([
        apiClient.get('/api/surveys/my').catch(() => ({ success: true, data: [] })),
        apiClient.get('/api/jobs').catch(() => ({ success: true, data: [] })),
      ]);

      const surveyList = surveysRes.data || [];
      const jobList = jobsRes.data || [];

      setSurveys(surveyList);
      setJobs(jobList);
    } catch (err) {
      console.error('Failed to load technician work', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyWork();
  }, []);

  const scheduledSurveys = surveys.filter((s) => s.status === 'SCHEDULED');
  const completedSurveys = surveys.filter(
    (s) => s.status === 'SUBMITTED' || s.status === 'APPROVED'
  );

  const scheduledJobs = jobs.filter(
    (j) => j.status === 'SCHEDULED' || j.status === 'IN_PROGRESS'
  );
  const completedJobs = jobs.filter((j) => j.status === 'COMPLETED');

  const todoCount = scheduledSurveys.length + scheduledJobs.length;
  const completedCount = completedSurveys.length + completedJobs.length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Mobile-Friendly Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-indigo-950 p-6 rounded-3xl text-white shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
            <HardHat className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Field Technician Portal</h1>
            <p className="text-xs text-indigo-200">
              Logged in as <span className="font-semibold text-white">{user?.name}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-indigo-500/30 border border-indigo-400/40 text-indigo-100 flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5" />
            <span>{scheduledSurveys.length} Surveys</span>
          </span>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/30 border border-emerald-400/40 text-emerald-100 flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5" />
            <span>{scheduledJobs.length} Installations</span>
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setTab('TODO')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
            tab === 'TODO'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span>To Do</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              tab === 'TODO' ? 'bg-purple-800 text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {todoCount}
          </span>
        </button>

        <button
          onClick={() => setTab('INSTALLATIONS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
            tab === 'INSTALLATIONS'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          <span>Installations</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              tab === 'INSTALLATIONS' ? 'bg-indigo-800 text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {jobs.length}
          </span>
        </button>

        <button
          onClick={() => setTab('SURVEYS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
            tab === 'SURVEYS'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Surveys</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              tab === 'SURVEYS' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {surveys.length}
          </span>
        </button>

        <button
          onClick={() => setTab('COMPLETED')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
            tab === 'COMPLETED'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <CheckCircle className="w-3.5 h-3.5" />
          <span>Completed</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              tab === 'COMPLETED' ? 'bg-emerald-800 text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {completedCount}
          </span>
        </button>

        <button
          onClick={() => setTab('ALL')}
          className={`px-3 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
            tab === 'ALL'
              ? 'bg-slate-200 text-slate-900 font-bold'
              : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          All ({surveys.length + jobs.length})
        </button>
      </div>

      {/* Main List */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm">
          Loading assigned work queue...
        </div>
      ) : (
        <div className="space-y-4">
          {/* SECTION 1: INSTALLATION JOBS */}
          {(tab === 'TODO' || tab === 'INSTALLATIONS' || tab === 'ALL' || tab === 'COMPLETED') && (
            <>
              {(tab === 'TODO'
                ? scheduledJobs
                : tab === 'INSTALLATIONS'
                ? jobs
                : tab === 'COMPLETED'
                ? completedJobs
                : jobs
              ).map((job) => (
                <div
                  key={`job-${job.id}`}
                  className="bg-white rounded-2xl border-2 border-indigo-100 hover:border-indigo-300 shadow-xs hover:shadow-md transition p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Installation Job #{job.id}</span>
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                        {job.order?.order_number || job.order_number || `ORD-${job.order_id}`}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {job.status || 'SCHEDULED'}
                      </span>
                    </div>

                    <h3 className="text-base font-extrabold text-slate-900">
                      {job.lead?.customer_name || job.customer_name || 'Customer Project'}
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          {job.lead?.address || job.address || 'Site Address'}
                          {job.lead?.city && `, ${job.lead.city}`}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <a
                          href={`tel:${job.lead?.phone || job.phone}`}
                          className="text-amber-600 font-semibold hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {job.lead?.phone || job.phone || '—'}
                        </a>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-bold text-slate-800">
                          Execution Date: {formatDate(job.scheduled_date)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          System: {job.capacity_kw || 3.0} kW ({job.system_type || 'Solar System'})
                        </span>
                      </div>
                    </div>

                    {job.notes && (
                      <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <strong>Notes: </strong> {job.notes}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 shrink-0">
                    {job.status !== 'COMPLETED' ? (
                      <Link
                        to={`/field/jobs/${job.id}`}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>{job.status === 'IN_PROGRESS' ? 'Continue Installation →' : 'Open Installation Job →'}</span>
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Installation Completed</span>
                      </span>
                    )}

                    <Link
                      to={`/orders/${job.order_id}`}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 transition"
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>View Order & Pick List →</span>
                    </Link>
                    <Link
                      to={`/orders/${job.order_id}/scan`}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition"
                    >
                      <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Warehouse / Site Scan</span>
                    </Link>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* SECTION 2: SITE SURVEYS */}
          {(tab === 'TODO' || tab === 'SURVEYS' || tab === 'ALL' || tab === 'COMPLETED') && (
            <>
              {(tab === 'TODO'
                ? scheduledSurveys
                : tab === 'SURVEYS'
                ? surveys
                : tab === 'COMPLETED'
                ? completedSurveys
                : surveys
              ).map((survey) => {
                const isScheduled = survey.status === 'SCHEDULED';
                const isApproved = survey.status === 'APPROVED';
                const isSubmitted = survey.status === 'SUBMITTED';

                return (
                  <div
                    key={`survey-${survey.id}`}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 flex items-center gap-1">
                          <Camera className="w-3.5 h-3.5 text-slate-500" />
                          <span>Feasibility Survey #{survey.id}</span>
                        </span>
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                            isApproved
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : isSubmitted
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-purple-50 text-purple-700 border-purple-200'
                          }`}
                        >
                          {survey.status}
                        </span>
                      </div>

                      <h3 className="text-base font-extrabold text-slate-900">
                        {survey.lead?.customer_name || 'Customer'}
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">
                            {survey.lead?.address}, {survey.lead?.city}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <a
                            href={`tel:${survey.lead?.phone}`}
                            className="text-amber-600 font-semibold hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {survey.lead?.phone}
                          </a>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Visit: {formatDateTime(survey.scheduled_date)}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Target: ~{formatKW(survey.lead?.suggested_kw || 3.0)}</span>
                        </div>
                      </div>

                      {survey.notes && (
                        <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <strong>Staff Note: </strong>
                          {survey.notes}
                        </div>
                      )}
                    </div>

                    {/* Action button */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 shrink-0">
                      {isScheduled ? (
                        <button
                          onClick={() => navigate(`/surveys/${survey.id}/execute`)}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-600/20 transition"
                        >
                          <Camera className="w-4 h-4" />
                          <span>Start Field Survey →</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => navigate(`/surveys/${survey.id}/execute`)}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition"
                        >
                          <span>View Submitted Form</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* Empty state */}
          {((tab === 'TODO' && todoCount === 0) ||
            (tab === 'INSTALLATIONS' && jobs.length === 0) ||
            (tab === 'SURVEYS' && surveys.length === 0) ||
            (tab === 'COMPLETED' && completedCount === 0) ||
            (tab === 'ALL' && surveys.length + jobs.length === 0)) && (
            <div className="py-16 text-center bg-white rounded-3xl border border-slate-200 p-8">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">No tasks in this tab</h3>
              <p className="text-xs text-slate-400 mt-1">
                You're all caught up! New surveys and installation jobs will appear here when assigned.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
