import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import Modal from '../components/Modal';
import {
  Calendar,
  Truck,
  HardHat,
  User,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

export default function CrewSchedule() {
  const [jobs, setJobs] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Assign Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [crewLeadId, setCrewLeadId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState(null);
  const [assignSuccess, setAssignSuccess] = useState(null);

  const fetchJobsAndTechs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/jobs');
      setJobs(res.data || []);

      // In mock DB or live, get users
      try {
        const usersRes = await api.get('/users');
        // crew lead must be a technician (the API rejects anyone else)
        const techs = (usersRes.data || []).filter((u) => u.role?.toUpperCase() === 'TECHNICIAN');
        setTechnicians(techs);
      } catch (e) {
        // Fallback default technicians
        setTechnicians([
          { id: 3, name: 'Vikram Joshi (Lead Electrician)', role: 'TECHNICIAN' },
          { id: 4, name: 'Ananya Deshmukh (Solar Engineer)', role: 'TECHNICIAN' },
          { id: 2, name: 'Rohan Sharma (Field Tech)', role: 'STAFF' },
        ]);
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
      setError(err.response?.data?.message || 'Failed to load installation jobs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobsAndTechs();
  }, []);

  const handleOpenAssignModal = (job) => {
    setSelectedJob(job);
    setCrewLeadId(job.crew_lead_id?.toString() || (technicians[0]?.id?.toString() || '3'));
    setScheduledDate(
      job.scheduled_date
        ? job.scheduled_date.slice(0, 10)
        : new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10)
    );
    setAssignError(null);
    setAssignSuccess(null);
    setIsAssignModalOpen(true);
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!selectedJob) return;

    try {
      setAssignLoading(true);
      setAssignError(null);
      await api.patch(`/jobs/${selectedJob.id}/assign`, {
        crewLeadId: Number(crewLeadId),
        scheduledDate: scheduledDate,
      });

      setAssignSuccess('Crew lead and date assigned successfully!');
      await fetchJobsAndTechs();
      setTimeout(() => {
        setIsAssignModalOpen(false);
        setAssignSuccess(null);
      }, 1000);
    } catch (err) {
      console.error('Assign error:', err);
      setAssignError(err.response?.data?.message || 'Failed to assign job.');
    } finally {
      setAssignLoading(false);
    }
  };

  // Group jobs by scheduled date
  const groupedJobs = jobs.reduce((acc, job) => {
    const d = job.scheduled_date
      ? new Date(job.scheduled_date).toLocaleDateString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : 'Unscheduled / Pending Date';
    if (!acc[d]) acc[d] = [];
    acc[d].push(job);
    return acc;
  }, {});

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unscheduled';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <Calendar className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Solar Installation Crew Schedule
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Assign lead technicians and scheduled dates for site mounting, cabling, and inverter commissioning.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchJobsAndTechs}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <Link
            to="/orders"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition"
          >
            <Truck className="w-3.5 h-3.5 text-amber-400" />
            <span>View All Orders</span>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
          <p className="text-xs">Loading installation schedule...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center text-rose-500 bg-white rounded-2xl border border-slate-200">
          <AlertCircle className="w-6 h-6 mx-auto mb-2" />
          <p className="text-sm font-semibold">{error}</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <HardHat className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">No installation jobs scheduled</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Installation jobs are automatically created once an order reaches the 30% advance confirmation threshold.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedJobs).map(([dateLabel, dateJobs]) => (
            <div key={dateLabel} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                  {dateLabel}
                </h2>
                <span className="text-xs text-slate-400">
                  ({dateJobs.length} {dateJobs.length === 1 ? 'Job' : 'Jobs'})
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dateJobs.map((job) => (
                  <div
                    key={job.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-indigo-300 transition space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-slate-900">
                        Job #{job.id}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {job.status || 'SCHEDULED'}
                      </span>
                    </div>

                    <div>
                      <div className="font-extrabold text-slate-800 text-sm">
                        {job.lead?.customer_name || 'Customer Project'}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          {job.lead?.city || 'Pune'}
                          {job.lead?.address && ` • ${job.lead.address}`}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1.5 border border-slate-100">
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="font-medium">Order Reference:</span>
                        <Link
                          to={`/orders/${job.order_id}`}
                          className="font-bold text-amber-700 hover:underline"
                        >
                          {job.order?.order_number || `Order #${job.order_id}`}
                        </Link>
                      </div>

                      <div className="flex items-center justify-between text-slate-600">
                        <span className="font-medium">Lead Technician:</span>
                        <span className="font-bold text-slate-800">
                          {job.crew_lead_name || 'Unassigned'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-600">
                        <span className="font-medium">Scheduled Date:</span>
                        <span className="font-bold text-slate-800">
                          {formatDate(job.scheduled_date)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <Link
                        to={`/orders/${job.order_id}`}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                      >
                        <span>View Order</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>

                      <button
                        onClick={() => handleOpenAssignModal(job)}
                        className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition border border-indigo-200"
                      >
                        Assign Crew Lead
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assign Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={`Assign Crew Lead for Job #${selectedJob?.id}`}
      >
        <form onSubmit={handleAssignSubmit} className="space-y-4">
          {assignSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold">
              {assignSuccess}
            </div>
          )}

          {assignError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
              {assignError}
            </div>
          )}

          <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200 text-xs text-indigo-900">
            Assigning installation crew for{' '}
            <strong>{selectedJob?.lead?.customer_name}</strong> (Order #
            {selectedJob?.order?.order_number || selectedJob?.order_id}).
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Lead Technician *
            </label>
            <select
              required
              value={crewLeadId}
              onChange={(e) => setCrewLeadId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Installation Execution Date *
            </label>
            <input
              type="date"
              required
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAssignModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={assignLoading}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition"
            >
              {assignLoading ? 'Saving...' : 'Confirm Assignment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
