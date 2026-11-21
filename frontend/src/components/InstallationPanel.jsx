// Phase 3 (B8, office side) – installation progress inside Order Detail:
// job status, checklist, serial verification, site photos, customer signature + integrity, certificate.
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient, openJobCertificate } from '../api/client';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { Wrench, Check, X, Download, ShieldCheck, ShieldAlert, Loader2, Camera } from 'lucide-react';

const STATUS_STYLE = {
  SCHEDULED: 'bg-indigo-100 text-indigo-800',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
};
const STAGES = ['BEFORE', 'DURING', 'AFTER'];

export default function InstallationPanel({ jobId, canWorkJob, refreshKey }) {
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let alive = true;
    apiClient
      .get(`/api/jobs/${jobId}`)
      .then((res) => alive && (setJob(res.data), setError('')))
      .catch((err) => alive && setError(err.response?.data?.message || 'Could not load the installation job'));
    return () => {
      alive = false;
    };
  }, [jobId, refreshKey]);

  if (error) return <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-sm text-rose-800">{error}</div>;
  if (!job) {
    return (
      <div className="p-6 rounded-2xl bg-white border border-slate-200 flex justify-center text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  const items = job.checklist_items || [];
  const sp = job.serials_progress || { expected: 0, verified: 0, missing: [] };
  const photos = job.photos || [];
  const integrity = job.signature_integrity;

  const download = async () => {
    setDownloading(true);
    try {
      await openJobCertificate(job.id, `installation-certificate-${job.order_number || job.id}.pdf`);
    } catch (err) {
      alert(err.response?.data?.message || 'Could not download the certificate');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <Wrench className="w-4 h-4" />
          </span>
          <h2 className="text-sm font-bold text-slate-900">On-site Installation · Job #{job.id}</h2>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLE[job.status] || 'bg-slate-100 text-slate-700'}`}>
            {job.status}
          </span>
        </div>
        <div className="flex gap-2">
          {canWorkJob && job.status !== 'COMPLETED' && (
            <Link
              to={`/field/jobs/${job.id}`}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
            >
              {job.status === 'IN_PROGRESS' ? 'Continue on-site steps →' : 'Open on-site steps →'}
            </Link>
          )}
          {job.status === 'COMPLETED' && (
            <button
              onClick={download}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-60"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Completion certificate
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-slate-400 font-bold uppercase text-[10px]">Started</div>
          <div className="font-semibold text-slate-800">{job.started_at ? formatDateTime(job.started_at) : '—'}</div>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-slate-400 font-bold uppercase text-[10px]">Completed</div>
          <div className="font-semibold text-slate-800">{job.completed_at ? formatDateTime(job.completed_at) : '—'}</div>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-slate-400 font-bold uppercase text-[10px]">Crew</div>
          <div className="font-semibold text-slate-800">
            {(job.crew || []).map((c) => `${c.name}${c.is_lead ? ' (lead)' : ''}`).join(', ') || job.crew_lead_name || 'Unassigned'}
          </div>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-slate-400 font-bold uppercase text-[10px]">Capacity / reading</div>
          <div className="font-semibold text-slate-800">
            {job.confirmed_capacity_kw != null ? `${Number(job.confirmed_capacity_kw)} kWp` : `${Number(job.capacity_kw)} kWp ordered`}
            {job.generation_reading_kw != null && ` · ${Number(job.generation_reading_kw)} kW`}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Checklist {items.filter((i) => i.done).length}/{items.length}
          </div>
          <ul className="space-y-1.5">
            {items.map((i) => (
              <li key={i.key} className="flex items-center gap-2 text-xs">
                <span className={`w-4 h-4 rounded-full flex items-center justify-center ${i.done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                  {i.done ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                </span>
                <span className={i.done ? 'text-slate-700' : 'text-slate-400'}>{i.label}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Serials verified on site {sp.verified}/{sp.expected}
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-2">
            <div className="h-full bg-emerald-500" style={{ width: `${sp.expected ? (sp.verified / sp.expected) * 100 : 100}%` }} />
          </div>
          {sp.missing.length > 0 && (
            <div className="text-[11px] text-slate-500">
              Waiting: <span className="font-mono">{sp.missing.slice(0, 6).join(', ')}{sp.missing.length > 6 ? ` +${sp.missing.length - 6} more` : ''}</span>
            </div>
          )}
          {job.labour_cost != null && Number(job.labour_cost) > 0 && (
            <div className="mt-3 text-xs text-slate-600">
              <strong>Labour:</strong> {Number(job.labour_hours)} h · {formatCurrency(job.labour_cost)}
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5" /> Site photos ({photos.length})
        </div>
        {photos.length ? (
          <div className="space-y-2">
            {STAGES.map((s) => {
              const list = photos.filter((p) => p.stage === s);
              if (!list.length) return null;
              return (
                <div key={s} className="flex items-start gap-3">
                  <span className="w-14 shrink-0 text-[10px] font-bold text-slate-500 pt-1">{s}</span>
                  <div className="flex flex-wrap gap-2">
                    {list.map((p) => (
                      <button key={p.id} onClick={() => setPreview(p)} className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                        <img src={p.url} alt={`${s} photo`} loading="lazy" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-slate-400">No photos uploaded yet.</div>
        )}
      </div>

      {job.status === 'COMPLETED' && (
        <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
          {job.signature_url && (
            <img src={job.signature_url} alt="Customer signature" className="w-48 h-24 object-contain bg-white rounded-lg border border-slate-200" />
          )}
          <div className="text-xs space-y-1 text-slate-700">
            <div>
              <strong>Signed by:</strong> {job.signed_by_name}
            </div>
            <div>
              <strong>Signed at:</strong> {formatDateTime(job.signed_at)}
            </div>
            {job.notes && (
              <div>
                <strong>Notes:</strong> {job.notes}
              </div>
            )}
            {integrity && (
              <div className={`inline-flex items-center gap-1 font-bold ${integrity.valid ? 'text-emerald-700' : 'text-rose-700'}`}>
                {integrity.valid ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                {integrity.valid ? 'Signature integrity verified' : 'Record changed after signing'}
              </div>
            )}
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={() => setPreview(null)}>
          <div className="flex justify-between items-center p-3 text-white text-xs">
            <span>
              {preview.stage} · {formatDateTime(preview.uploaded_at)} {preview.uploaded_by_name ? `· ${preview.uploaded_by_name}` : ''}
            </span>
            <X className="w-6 h-6" />
          </div>
          <img src={preview.url} alt="" className="flex-1 object-contain min-h-0" />
        </div>
      )}
    </div>
  );
}
