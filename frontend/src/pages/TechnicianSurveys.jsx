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
  AlertCircle
} from 'lucide-react';

export default function TechnicianSurveys() {
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('ALL');
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchMySurveys = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/surveys/my');
      if (res.success) {
        setSurveys(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load surveys', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMySurveys();
  }, []);

  const filteredSurveys = surveys.filter((s) => {
    if (tab === 'ALL') return true;
    if (tab === 'PENDING') return s.status === 'SCHEDULED';
    if (tab === 'COMPLETED') return s.status === 'SUBMITTED' || s.status === 'APPROVED';
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Mobile-Friendly Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-900 to-indigo-950 p-6 rounded-3xl text-white shadow-xl">
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

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-indigo-500/30 border border-indigo-400/40 text-indigo-100">
            {surveys.filter((s) => s.status === 'SCHEDULED').length} Scheduled Visits
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setTab('ALL')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            tab === 'ALL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All Surveys ({surveys.length})
        </button>
        <button
          onClick={() => setTab('PENDING')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            tab === 'PENDING'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          To Do ({surveys.filter((s) => s.status === 'SCHEDULED').length})
        </button>
        <button
          onClick={() => setTab('COMPLETED')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            tab === 'COMPLETED'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Completed ({surveys.filter((s) => s.status === 'SUBMITTED' || s.status === 'APPROVED').length})
        </button>
      </div>

      {/* Surveys List */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm">
          Loading assigned surveys...
        </div>
      ) : filteredSurveys.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200 p-8">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Surveys in this tab</h3>
          <p className="text-xs text-slate-400 mt-1">
            You're all caught up! New site visits will appear here when assigned.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSurveys.map((survey) => {
            const isScheduled = survey.status === 'SCHEDULED';
            const isApproved = survey.status === 'APPROVED';
            const isSubmitted = survey.status === 'SUBMITTED';

            return (
              <div
                key={survey.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
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
                    <span className="text-xs text-slate-400">
                      Survey #{survey.id}
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
        </div>
      )}
    </div>
  );
}
