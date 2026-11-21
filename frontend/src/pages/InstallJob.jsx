// Phase 3 (B3–B9) – the installation job on the roof, as steps:
// Start -> Checklist -> Scan serials -> Photos -> Test & size -> Customer sign-off -> Success.
// Built for a phone: big tap targets, one step per screen, progress at the top.
// Typed fields + step + signature are kept as a draft in localStorage, so closing the app loses nothing.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { apiClient, openJobCertificate } from '../api/client';
import SignaturePad from '../components/SignaturePad';
import { formatDateTime, formatKW } from '../utils/formatters';
import {
  ArrowLeft, Play, ListChecks, QrCode, Camera, Gauge, PenLine, CheckCircle2, Check, MapPin, Phone, Camera as CameraIcon,
  Loader2, AlertTriangle, Download, ChevronLeft, ChevronRight, X, ScanLine, Sun,
} from 'lucide-react';

const STEPS = [
  { key: 'start', label: 'Start', icon: Play },
  { key: 'checklist', label: 'Checklist', icon: ListChecks },
  { key: 'serials', label: 'Serials', icon: QrCode },
  { key: 'photos', label: 'Photos', icon: Camera },
  { key: 'test', label: 'Test', icon: Gauge },
  { key: 'signoff', label: 'Sign-off', icon: PenLine },
];
const STAGES = ['BEFORE', 'DURING', 'AFTER'];
const MAX_PER_UPLOAD = 8;

const errMsg = (err, fallback) => err?.response?.data?.message || err?.response?.data?.error?.message || err?.message || fallback;

// ---------- B9: draft in localStorage ----------
const draftKey = (id) => `sunpower_job_draft_${id}`;
function readDraft(id) {
  try {
    return JSON.parse(localStorage.getItem(draftKey(id))) || {};
  } catch {
    return {};
  }
}
function writeDraft(id, draft) {
  try {
    localStorage.setItem(draftKey(id), JSON.stringify(draft));
  } catch {
    /* storage full / private mode: the draft is a convenience only */
  }
}

// ---------- B6: shrink phone photos before upload (12 MP -> ~1600 px JPEG) ----------
async function compressImage(file, maxSide = 1600, quality = 0.75) {
  if (!file.type.startsWith('image/')) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file; // already small: keep the original
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file; // unreadable in the browser (e.g. HEIC): let the server decide
  } finally {
    URL.revokeObjectURL(url);
  }
}

function Banner({ tone = 'info', children, onClose }) {
  const tones = {
    info: 'bg-indigo-50 border-indigo-200 text-indigo-900',
    ok: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    error: 'bg-rose-50 border-rose-200 text-rose-900',
    warn: 'bg-amber-50 border-amber-200 text-amber-900',
  };
  return (
    <div className={`flex items-start gap-2 p-3 rounded-xl border text-sm ${tones[tone]}`}>
      <div className="flex-1">{children}</div>
      {onClose && (
        <button onClick={onClose} className="p-1 -m-1" aria-label="Dismiss">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export default function InstallJob() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null); // { tone, text }
  const [draft, setDraftState] = useState(() => readDraft(id));
  const [step, setStep] = useState(() => readDraft(id).step || 'start');

  const setDraft = (patch) =>
    setDraftState((d) => {
      const next = { ...d, ...patch };
      writeDraft(id, next);
      return next;
    });
  const goTo = (key) => {
    setStep(key);
    setFeedback(null);
    setDraft({ step: key });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get(`/api/jobs/${id}`);
      setJob(res.data);
      setLoadError('');
      return res.data;
    } catch (err) {
      setLoadError(errMsg(err, 'Could not load the job'));
      return null;
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load().then((j) => {
      // a job that has not started always opens on the Start step
      if (j && j.status === 'SCHEDULED') setStep('start');
    });
  }, [load]);

  if (loading) {
    return (
      <div className="py-24 flex justify-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }
  if (!job) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8 space-y-4">
        <Banner tone="error">{loadError || 'Job not found'}</Banner>
        <Link to="/today" className="inline-flex items-center gap-1 text-sm font-bold text-indigo-600">
          <ArrowLeft className="w-4 h-4" /> Back to Today
        </Link>
      </div>
    );
  }

  // ---------- progress ----------
  const started = job.status !== 'SCHEDULED';
  const items = job.checklist_items || [];
  const sp = job.serials_progress || { expected: 0, verified: 0, missing: [] };
  const counts = STAGES.reduce((acc, s) => ({ ...acc, [s]: (job.photos || []).filter((p) => p.stage === s).length }), {});
  const minAfter = job.min_after_photos || 2;
  const done = {
    start: started,
    checklist: items.length > 0 && items.every((i) => i.done),
    serials: sp.missing.length === 0,
    photos: counts.AFTER >= minAfter,
    // filled in AND the confirmed size matches the order (the server refuses a mismatch)
    test:
      draft.confirmed_capacity_kw !== undefined && draft.confirmed_capacity_kw !== '' &&
      Number(draft.confirmed_capacity_kw) === Number(job.capacity_kw) &&
      draft.generation_reading_kw !== undefined && draft.generation_reading_kw !== '',
    signoff: job.status === 'COMPLETED',
  };
  const canLead = !!job.you?.can_start;
  const address = [job.address, job.city, job.pincode].filter(Boolean).join(', ');

  if (job.status === 'COMPLETED') {
    return <SuccessScreen job={job} />;
  }

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const current = started ? step : 'start';

  return (
    <div className="max-w-xl mx-auto pb-28">
      {/* header + progress (B3) */}
      <div className="sticky top-16 z-20 bg-slate-50/95 backdrop-blur border-b border-slate-200 px-4 pt-3 pb-3 space-y-3">
        <div className="flex items-center gap-3">
          <Link to="/today" className="p-2 -ml-2 rounded-lg text-slate-600 active:bg-slate-200" aria-label="Back to Today">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-slate-900 truncate">{job.customer_name}</div>
            <div className="text-[11px] text-slate-500 truncate">
              {job.order_number || job.order?.order_number} · {job.package_name || formatKW(job.capacity_kw)}
            </div>
          </div>
          <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${started ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'}`}>
            {started ? 'IN PROGRESS' : 'SCHEDULED'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isCurrent = s.key === current;
            const reachable = started || s.key === 'start';
            return (
              <button
                key={s.key}
                disabled={!reachable}
                onClick={() => goTo(s.key)}
                className="flex-1 flex flex-col items-center gap-1 disabled:opacity-40"
                aria-label={`${s.label}${done[s.key] ? ' (done)' : ''}`}
              >
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition ${
                    done[s.key]
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : isCurrent
                        ? 'bg-white border-indigo-600 text-indigo-600'
                        : 'bg-white border-slate-300 text-slate-400'
                  }`}
                >
                  {done[s.key] ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </span>
                <span className={`text-[10px] font-bold ${isCurrent ? 'text-indigo-700' : 'text-slate-500'}`}>{s.label}</span>
                {i < STEPS.length && <span className={`h-1 w-full rounded-full ${done[s.key] ? 'bg-emerald-400' : isCurrent ? 'bg-indigo-400' : 'bg-slate-200'}`} />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {feedback && (
          <Banner tone={feedback.tone} onClose={() => setFeedback(null)}>
            {feedback.text}
          </Banner>
        )}

        {current === 'start' && (
          <StartStep job={job} address={address} canLead={canLead} busy={busy} onStart={async () => {
            setBusy(true);
            setFeedback(null);
            try {
              await apiClient.post(`/api/jobs/${job.id}/start`, {});
              await load();
              goTo('checklist');
              setFeedback({ tone: 'ok', text: 'Job started. Work through the checklist as you go.' });
            } catch (err) {
              setFeedback({ tone: 'error', text: errMsg(err, 'Could not start the job') });
            } finally {
              setBusy(false);
            }
          }} onContinue={() => goTo('checklist')} />
        )}

        {current === 'checklist' && <ChecklistStep job={job} setJob={setJob} setFeedback={setFeedback} />}
        {current === 'serials' && <SerialsStep job={job} reload={load} setFeedback={setFeedback} />}
        {current === 'photos' && <PhotosStep job={job} reload={load} setFeedback={setFeedback} draft={draft} setDraft={setDraft} />}
        {current === 'test' && <TestStep job={job} draft={draft} setDraft={setDraft} />}
        {current === 'signoff' && (
          <SignoffStep
            job={job}
            draft={draft}
            setDraft={setDraft}
            done={done}
            counts={counts}
            canLead={canLead}
            goTo={goTo}
            setFeedback={setFeedback}
            onCompleted={async () => {
              localStorage.removeItem(draftKey(job.id));
              await load();
            }}
          />
        )}
      </div>

      {/* bottom nav */}
      {started && (
        <div className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-slate-200">
          <div className="max-w-xl mx-auto flex gap-3 p-3">
            <button
              disabled={stepIndex <= 0}
              onClick={() => goTo(STEPS[stepIndex - 1].key)}
              className="flex items-center justify-center gap-1 px-5 py-3.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 disabled:opacity-40 active:bg-slate-100"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            {stepIndex < STEPS.length - 1 && (
              <button
                onClick={() => goTo(STEPS[stepIndex + 1].key)}
                className="flex-1 flex items-center justify-center gap-1 py-3.5 rounded-xl bg-indigo-600 text-white text-sm font-bold active:bg-indigo-700"
              >
                Next: {STEPS[stepIndex + 1].label} <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------------------------
function StartStep({ job, address, canLead, busy, onStart, onContinue }) {
  const started = job.status !== 'SCHEDULED';
  const delivered = ['DELIVERED', 'INSTALLED'].includes(job.order_status || job.order?.status);
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="text-lg font-bold text-slate-900">{job.customer_name}</div>
        {address && (
          <a href={job.maps_url} target="_blank" rel="noreferrer" className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700">
            <MapPin className="w-5 h-5 text-rose-500 shrink-0" />
            <span className="flex-1">{address}</span>
            <span className="text-xs font-bold text-indigo-600">Maps</span>
          </a>
        )}
        {job.phone && (
          <a href={`tel:${job.phone}`} className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700">
            <Phone className="w-5 h-5 text-emerald-600" /> {job.phone}
          </a>
        )}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
            <div className="text-[11px] text-slate-500">System</div>
            <div className="font-bold text-slate-900">{formatKW(job.capacity_kw)}</div>
            <div className="text-[11px] text-slate-500">{job.package_name || job.system_type}</div>
          </div>
          <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100">
            <div className="text-[11px] text-slate-500">Crew</div>
            <div className="text-xs font-semibold text-slate-800">
              {(job.crew || []).map((c) => `${c.name}${c.is_lead ? ' (lead)' : ''}`).join(', ') || job.crew_lead_name || '-'}
            </div>
          </div>
        </div>
      </div>

      {started ? (
        <>
          <Banner tone="ok">Started {formatDateTime(job.started_at)}.</Banner>
          <button onClick={onContinue} className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-bold active:bg-indigo-700">
            Go to checklist
          </button>
        </>
      ) : !delivered ? (
        <Banner tone="warn">
          <div className="flex gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>
              Materials for {job.order_number || job.order?.order_number} are not delivered yet (order is {job.order_status || job.order?.status}). The
              job can start once the office confirms delivery.
            </span>
          </div>
        </Banner>
      ) : !canLead ? (
        <Banner tone="info">Only the crew lead ({job.crew_lead_name || 'not assigned'}) can start this job. Ask them to tap Start.</Banner>
      ) : (
        <button
          onClick={onStart}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 py-5 rounded-2xl bg-emerald-600 text-white text-lg font-extrabold shadow-sm active:bg-emerald-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6" />}
          {busy ? 'Starting...' : 'Start job'}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// B4 – Checklist: big tap targets, each tap saved to the server at once
// ---------------------------------------------------------------------------------------------
function ChecklistStep({ job, setJob, setFeedback }) {
  const [saving, setSaving] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const items = job.checklist_items || [];

  const toggle = async (item) => {
    const value = !item.done;
    const apply = (v) =>
      setJob((j) => ({ ...j, checklist_items: j.checklist_items.map((i) => (i.key === item.key ? { ...i, done: v } : i)) }));
    apply(value); // optimistic
    setSaving(item.key);
    try {
      await apiClient.patch(`/api/jobs/${job.id}/checklist`, { checklist: { [item.key]: value } });
      setSavedAt(new Date());
    } catch (err) {
      apply(!value);
      setFeedback({ tone: 'error', text: errMsg(err, 'Could not save the checklist') });
    } finally {
      setSaving(null);
    }
  };

  const doneCount = items.filter((i) => i.done).length;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900">Installation checklist</h2>
        <span className="text-xs font-bold text-slate-500">
          {doneCount}/{items.length} done
        </span>
      </div>
      {items.map((item) => (
        <button
          key={item.key}
          onClick={() => toggle(item)}
          disabled={saving === item.key}
          aria-pressed={item.done}
          aria-label={item.label}
          className={`w-full min-h-[64px] flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition active:scale-[0.99] ${
            item.done ? 'bg-emerald-50 border-emerald-400' : 'bg-white border-slate-200'
          }`}
        >
          <span
            className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center border-2 ${
              item.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 text-transparent'
            }`}
          >
            {saving === item.key ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : <Check className="w-6 h-6" />}
          </span>
          <span className={`text-base font-semibold ${item.done ? 'text-emerald-900' : 'text-slate-800'}`}>{item.label}</span>
        </button>
      ))}
      <p className="text-center text-[11px] text-slate-400">
        {savedAt ? `Saved automatically at ${savedAt.toLocaleTimeString()}` : 'Every tap is saved automatically.'}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// B5 – Serial verification: same camera scanner as the warehouse (html5-qrcode) + typed fallback
// ---------------------------------------------------------------------------------------------
function SerialsStep({ job, reload, setFeedback }) {
  const [serial, setSerial] = useState('');
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);
  const scannerRef = useRef(null);
  const lastScan = useRef({ code: '', at: 0 });
  const inFlight = useRef(false);
  const sp = job.serials_progress || { expected: 0, verified: 0, missing: [] };

  const verify = useCallback(
    async (raw) => {
      const code = String(raw || '').trim().toUpperCase();
      if (!code || inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      try {
        const res = await apiClient.post(`/api/jobs/${job.id}/serials/verify`, { serial_number: code });
        setFeedback({ tone: 'ok', text: `✓ ${res.data?.serial_number || code} verified${res.data?.name ? ` – ${res.data.name}` : ''}` });
        if (navigator.vibrate) navigator.vibrate(80);
        setSerial('');
        await reload();
      } catch (err) {
        setFeedback({ tone: 'error', text: errMsg(err, `Could not verify ${code}`) });
        if (navigator.vibrate) navigator.vibrate([60, 60, 60]);
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [job.id, reload, setFeedback],
  );

  const stopCamera = useCallback(async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s) {
      try {
        await s.stop();
        s.clear();
      } catch {
        /* already stopped */
      }
    }
    setCamera(false);
  }, []);

  useEffect(() => () => {
    stopCamera();
  }, [stopCamera]);

  const startCamera = () => {
    setCamera(true);
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode('job-qr-reader');
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (text) => {
            const now = Date.now();
            // the same label stays in view for several frames: ignore repeats for 3 s
            if (text === lastScan.current.code && now - lastScan.current.at < 3000) return;
            lastScan.current = { code: text, at: now };
            verify(text);
          },
          () => {},
        );
      } catch {
        setFeedback({ tone: 'error', text: 'Could not open the camera. Allow camera access or type the serial number.' });
        stopCamera();
      }
    }, 100);
  };

  // group the expected units by product for the tick list
  const groups = (job.serials || []).reduce((acc, s) => {
    const k = s.name || s.category || 'Item';
    (acc[k] = acc[k] || []).push(s);
    return acc;
  }, {});
  const pct = sp.expected ? Math.round((sp.verified / sp.expected) * 100) : 100;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Verify installed serials</h2>
          <span className="text-sm font-bold text-slate-700">
            {sp.verified}/{sp.expected}
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>

        {camera ? (
          <div className="space-y-2">
            <div id="job-qr-reader" className="w-full rounded-xl overflow-hidden bg-black" />
            <button onClick={stopCamera} className="w-full py-3 rounded-xl border border-slate-300 text-sm font-bold text-slate-700">
              Stop camera
            </button>
          </div>
        ) : (
          <button
            onClick={startCamera}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-slate-900 text-white font-bold active:bg-slate-800"
          >
            <ScanLine className="w-5 h-5" /> Scan QR / barcode
          </button>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            verify(serial);
          }}
          className="flex gap-2"
        >
          <input
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            placeholder="or type serial number"
            autoCapitalize="characters"
            className="flex-1 min-w-0 px-3 py-3 rounded-xl border border-slate-300 text-sm font-mono uppercase"
          />
          <button disabled={busy || !serial.trim()} className="px-5 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
          </button>
        </form>
      </div>

      {Object.entries(groups).map(([name, list]) => (
        <div key={name} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex justify-between text-xs font-bold text-slate-600">
            <span className="truncate">{name}</span>
            <span>
              {list.filter((s) => s.verified).length}/{list.length}
            </span>
          </div>
          <ul className="divide-y divide-slate-100">
            {list.map((s) => (
              <li key={s.serial_number} className="flex items-center gap-3 px-4 py-2.5">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${s.verified ? 'bg-emerald-500 text-white' : 'border-2 border-slate-300'}`}
                >
                  {s.verified && <Check className="w-4 h-4" />}
                </span>
                <span className={`font-mono text-sm ${s.verified ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{s.serial_number}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {!(job.serials || []).length && <Banner tone="info">This order has no serialized units to verify.</Banner>}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// B6 – Photos: camera capture, stage tabs, thumbnails, compressed before upload
// ---------------------------------------------------------------------------------------------
function PhotosStep({ job, reload, setFeedback, draft, setDraft }) {
  const stage = draft.photo_stage || 'BEFORE';
  const [uploading, setUploading] = useState(0);
  const [preview, setPreview] = useState(null);
  const photos = (job.photos || []).filter((p) => p.stage === stage);
  const count = (s) => (job.photos || []).filter((p) => p.stage === s).length;
  const minAfter = job.min_after_photos || 2;

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, MAX_PER_UPLOAD);
    e.target.value = ''; // allow taking the same photo again
    if (!files.length) return;
    setUploading(files.length);
    setFeedback(null);
    try {
      const small = await Promise.all(files.map((f) => compressImage(f)));
      const fd = new FormData();
      fd.append('stage', stage);
      small.forEach((f) => fd.append('photos', f));
      await apiClient.post(`/api/jobs/${job.id}/photos`, fd);
      const kb = Math.round(small.reduce((n, f) => n + f.size, 0) / 1024);
      setFeedback({ tone: 'ok', text: `${files.length} ${stage.toLowerCase()} photo${files.length > 1 ? 's' : ''} uploaded (${kb} KB).` });
      await reload();
    } catch (err) {
      setFeedback({ tone: 'error', text: errMsg(err, 'Photo upload failed') });
    } finally {
      setUploading(0);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-slate-200/70">
        {STAGES.map((s) => (
          <button
            key={s}
            onClick={() => setDraft({ photo_stage: s })}
            className={`py-3 rounded-xl text-sm font-bold transition ${stage === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
          >
            {s.charAt(0) + s.slice(1).toLowerCase()} <span className="text-xs text-slate-400">({count(s)})</span>
          </button>
        ))}
      </div>

      {stage === 'AFTER' && count('AFTER') < minAfter && (
        <Banner tone="warn">At least {minAfter} AFTER photos are needed before sign-off ({count('AFTER')} so far).</Banner>
      )}

      <label
        className={`w-full flex items-center justify-center gap-2 py-5 rounded-2xl text-white text-base font-bold cursor-pointer ${
          uploading ? 'bg-slate-400' : 'bg-indigo-600 active:bg-indigo-700'
        }`}
      >
        {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <CameraIcon className="w-6 h-6" />}
        {uploading ? `Uploading ${uploading}...` : `Take ${stage.toLowerCase()} photo`}
        <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={onFiles} disabled={!!uploading} />
      </label>

      {photos.length ? (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <button key={p.id} onClick={() => setPreview(p)} className="aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
              <img src={p.url} alt={`${p.stage} photo`} loading="lazy" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      ) : (
        <div className="py-10 text-center text-sm text-slate-400 border border-dashed border-slate-300 rounded-2xl">No {stage.toLowerCase()} photos yet</div>
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

// ---------------------------------------------------------------------------------------------
// Test & size – confirmed capacity + generation reading (kept in the draft until sign-off)
// ---------------------------------------------------------------------------------------------
function TestStep({ job, draft, setDraft }) {
  const ordered = Number(job.capacity_kw);
  const confirmed = draft.confirmed_capacity_kw;
  const mismatch = confirmed !== undefined && confirmed !== '' && Number(confirmed) !== ordered;
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
        <h2 className="text-base font-bold text-slate-900">Test & size</h2>
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 flex items-center gap-3">
          <Sun className="w-6 h-6 text-amber-500" />
          <div>
            <div className="text-[11px] text-slate-500">Ordered capacity</div>
            <div className="text-lg font-extrabold text-slate-900">{formatKW(ordered)}</div>
          </div>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-semibold text-slate-700">Installed capacity confirmed on site (kWp)</span>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={confirmed ?? ''}
              onChange={(e) => setDraft({ confirmed_capacity_kw: e.target.value })}
              className={`flex-1 min-w-0 px-3 py-3 rounded-xl border text-lg font-bold ${mismatch ? 'border-rose-400 bg-rose-50' : 'border-slate-300'}`}
            />
            <button
              type="button"
              onClick={() => setDraft({ confirmed_capacity_kw: String(ordered) })}
              className="px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-700"
            >
              Same as ordered
            </button>
          </div>
          {mismatch && <span className="text-xs text-rose-700">Does not match the ordered {formatKW(ordered)} – sign-off will be refused. Recheck the panel count.</span>}
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-semibold text-slate-700">Generation test reading (kW)</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={draft.generation_reading_kw ?? ''}
            onChange={(e) => setDraft({ generation_reading_kw: e.target.value })}
            placeholder="reading on the inverter display"
            className="w-full px-3 py-3 rounded-xl border border-slate-300 text-lg font-bold"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-semibold text-slate-700">Notes (optional)</span>
          <textarea
            rows={3}
            value={draft.notes ?? ''}
            onChange={(e) => setDraft({ notes: e.target.value })}
            placeholder="anything the office should know"
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
          />
        </label>
        <p className="text-[11px] text-slate-400">Saved on this phone as you type.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// B7 – Customer sign-off: summary, name, signature, Clear / Submit
// ---------------------------------------------------------------------------------------------
function SignoffStep({ job, draft, setDraft, done, counts, canLead, goTo, setFeedback, onCompleted }) {
  const padRef = useRef(null);
  const [hasInk, setHasInk] = useState(!!draft.signature);
  const [busy, setBusy] = useState(false);
  const sp = job.serials_progress || { expected: 0, verified: 0, missing: [] };
  const items = job.checklist_items || [];

  useEffect(() => {
    if (draft.signature) padRef.current?.load(draft.signature);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const checks = [
    { ok: done.checklist, text: `Checklist ${items.filter((i) => i.done).length}/${items.length}`, step: 'checklist' },
    { ok: done.serials, text: `Serials verified ${sp.verified}/${sp.expected}`, step: 'serials' },
    { ok: done.photos, text: `Photos: ${counts.BEFORE} before · ${counts.DURING} during · ${counts.AFTER} after (min ${job.min_after_photos || 2} after)`, step: 'photos' },
    {
      ok: done.test,
      text: draft.confirmed_capacity_kw && draft.generation_reading_kw ? `Capacity ${draft.confirmed_capacity_kw} kWp · reading ${draft.generation_reading_kw} kW` : 'Capacity + generation reading not entered',
      step: 'test',
    },
  ];
  const ready = checks.every((c) => c.ok);

  const submit = async () => {
    if (!draft.signed_by_name?.trim()) return setFeedback({ tone: 'error', text: "Enter the customer's name." });
    if (!hasInk || padRef.current?.isEmpty()) return setFeedback({ tone: 'error', text: 'Ask the customer to sign in the box.' });
    setBusy(true);
    setFeedback(null);
    try {
      await apiClient.post(`/api/jobs/${job.id}/complete`, {
        confirmed_capacity_kw: draft.confirmed_capacity_kw,
        generation_reading_kw: draft.generation_reading_kw,
        notes: draft.notes || undefined,
        signed_by_name: draft.signed_by_name.trim(),
        signature: padRef.current.toDataURL(),
      });
      await onCompleted();
    } catch (err) {
      setFeedback({ tone: 'error', text: errMsg(err, 'Sign-off failed') });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <h2 className="text-base font-bold text-slate-900">Installation summary</h2>
        <div className="text-sm text-slate-700">
          <div className="font-semibold">{job.customer_name}</div>
          <div className="text-xs text-slate-500">
            {formatKW(job.capacity_kw)} {job.package_name || job.system_type} · {job.order_number || job.order?.order_number}
          </div>
        </div>
        <ul className="space-y-2">
          {checks.map((c) => (
            <li key={c.step} className="flex items-center gap-2 text-sm">
              <span className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center ${c.ok ? 'bg-emerald-500 text-white' : 'bg-rose-100 text-rose-600'}`}>
                {c.ok ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
              </span>
              <span className={`flex-1 ${c.ok ? 'text-slate-700' : 'text-rose-800'}`}>{c.text}</span>
              {!c.ok && (
                <button onClick={() => goTo(c.step)} className="text-xs font-bold text-indigo-600 px-2 py-1">
                  Fix
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <h2 className="text-base font-bold text-slate-900">Customer sign-off</h2>
        <p className="text-xs text-slate-500">Hand the phone to the customer: “I confirm the system above was installed and tested at my site.”</p>
        <input
          value={draft.signed_by_name ?? ''}
          onChange={(e) => setDraft({ signed_by_name: e.target.value })}
          placeholder="Customer name"
          autoComplete="off"
          className="w-full px-3 py-3 rounded-xl border border-slate-300 text-base"
        />
        <SignaturePad
          ref={padRef}
          onChange={(data) => {
            setHasInk(!!data);
            setDraft({ signature: data || undefined });
          }}
        />
        <div className="flex gap-3">
          <button
            onClick={() => padRef.current?.clear()}
            className="px-5 py-3.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 active:bg-slate-100"
          >
            Clear
          </button>
          <button
            onClick={submit}
            disabled={busy || !canLead}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-600 text-white text-sm font-extrabold disabled:opacity-50 active:bg-emerald-700"
          >
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            {busy ? 'Submitting...' : 'Submit & complete job'}
          </button>
        </div>
        {!canLead && <p className="text-xs text-amber-700">Only the crew lead ({job.crew_lead_name}) or an admin can submit the sign-off.</p>}
        {canLead && !ready && <p className="text-xs text-slate-500">Items marked ✗ above will block the sign-off – fix them first.</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// B8 – Success + certificate
// ---------------------------------------------------------------------------------------------
function SuccessScreen({ job }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const download = async () => {
    setBusy(true);
    setError('');
    try {
      await openJobCertificate(job.id, `installation-certificate-${job.order_number || job.id}.pdf`);
    } catch (err) {
      setError(errMsg(err, 'Could not download the certificate'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-5 text-center">
      <div className="mx-auto w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-600" />
      </div>
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Installation complete</h1>
        <p className="text-sm text-slate-500 mt-1">
          {job.customer_name} · {formatKW(job.confirmed_capacity_kw || job.capacity_kw)} · signed by {job.signed_by_name}
        </p>
        <p className="text-xs text-slate-400">{formatDateTime(job.completed_at || job.signed_at)}</p>
      </div>
      {job.signature_url && (
        <img src={job.signature_url} alt="Customer signature" className="mx-auto max-h-28 rounded-xl border border-slate-200 bg-white" />
      )}
      {error && <Banner tone="error">{error}</Banner>}
      <button
        onClick={download}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-indigo-600 text-white font-bold active:bg-indigo-700 disabled:opacity-60"
      >
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
        Download certificate
      </button>
      <Link to="/today" className="block w-full py-4 rounded-2xl border border-slate-300 text-slate-700 font-bold">
        Back to Today
      </Link>
    </div>
  );
}
