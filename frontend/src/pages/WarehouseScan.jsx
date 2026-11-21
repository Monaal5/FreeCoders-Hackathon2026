import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import api, { isMockMode } from '../api/client';

// Static classes so Tailwind keeps them in the build
const DEMO_TONES = {
  rose: { box: 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-900', accent: 'text-rose-600', mono: 'text-rose-700/80' },
  indigo: { box: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-900', accent: 'text-indigo-600', mono: 'text-indigo-700/80' },
  emerald: { box: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-900', accent: 'text-emerald-600', mono: 'text-emerald-700/80' },
  amber: { box: 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-900', accent: 'text-amber-600', mono: 'text-amber-700/80' },
};

// Offline mock data uses its own sample serials
const MOCK_DEMO_SCANS = [
  { serial: 'BAT-LIFE-5K-0003', label: '⚡ Demo Conflict (409)', tag: 'Reserved', note: 'Tests rule: Battery already reserved for ORD-0003', tone: 'rose' },
  { serial: 'INV-HYB-5K-0001', label: '✓ Valid Inverter', tag: 'In Stock', note: 'Reserves SolarEdge 5kW unit', tone: 'indigo' },
  { serial: 'BAT-LIFE-5K-0001', label: '✓ Valid Battery', tag: 'In Stock', note: 'Reserves Luminous Li-5000 unit', tone: 'emerald' },
  { serial: 'PANEL-MONO-540-0001', label: '✓ Valid Panel', tag: 'In Stock', note: 'Reserves Adani Mono PERC', tone: 'amber' },
];

const CATEGORY_TONE = { INVERTER: 'indigo', BATTERY: 'emerald', PANEL: 'amber' };

/** Live mode: real serials – one already taken elsewhere (409 demo) + a free unit for each open line. */
async function buildLiveDemoScans(orderId, lines) {
  const out = [];
  const taken = (status) =>
    api
      .get('/inventory/serials', { params: { status } })
      .then((r) => (r.data || []).find((s) => String(s.order_id) !== String(orderId)))
      .catch(() => null);
  const conflict = (await taken('RESERVED')) || (await taken('DISPATCHED'));
  if (conflict) {
    out.push({
      serial: conflict.serial_number,
      label: '⚡ Demo Conflict (409)',
      tag: conflict.status,
      note: `Already ${conflict.status.toLowerCase()}${conflict.order_number ? ` for ${conflict.order_number}` : ''}`,
      tone: 'rose',
    });
  }
  const open = lines.filter((l) => l.product?.is_serialized && Number(l.qty_scanned) < Number(l.qty_required)).slice(0, 3);
  for (const l of open) {
    const free = await api
      .get('/inventory/serials', { params: { productId: l.product_id, status: 'IN_STOCK' } })
      .then((r) => (r.data || [])[0])
      .catch(() => null);
    if (free) {
      out.push({
        serial: free.serial_number,
        label: `✓ Valid ${(l.product.category || 'item').toLowerCase()}`,
        tag: 'In Stock',
        note: `Reserves ${l.product.name}`,
        tone: CATEGORY_TONE[l.product.category] || 'indigo',
      });
    }
  }
  return out;
}
import {
  QrCode,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Camera,
  CameraOff,
  Trash2,
  RefreshCw,
  Package,
  Layers,
  Sparkles,
  Truck,
  Check,
  AlertTriangle,
  Info,
} from 'lucide-react';

export default function WarehouseScan() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [pickList, setPickList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Scanner inputs
  const [serialInput, setSerialInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [scanFeedback, setScanFeedback] = useState(null); // { type: 'success' | 'error', message: string, serial: string }
  const [cameraActive, setCameraActive] = useState(false);
  const html5QrCodeRef = useRef(null);
  const inputRef = useRef(null);

  const fetchOrderAndPickList = async () => {
    try {
      setLoading(true);
      setError(null);
      const [orderRes, pickRes] = await Promise.all([
        api.get(`/orders/${id}`),
        api.get(`/orders/${id}/pick-list`),
      ]);
      setOrder(orderRes.data);
      setPickList(pickRes.data || orderRes.data?.pick_list || []);
    } catch (err) {
      console.error('Error fetching order pick-list:', err);
      setError(err.response?.data?.message || 'Failed to load order pick list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderAndPickList();
  }, [id]);

  // Sample serials for the demo buttons (refreshed whenever the pick list changes)
  const [demoScans, setDemoScans] = useState([]);
  useEffect(() => {
    if (isMockMode()) {
      setDemoScans(MOCK_DEMO_SCANS);
      return;
    }
    let cancelled = false;
    buildLiveDemoScans(id, pickList).then((list) => !cancelled && setDemoScans(list));
    return () => {
      cancelled = true;
    };
  }, [id, pickList]);

  // Focus input on load
  useEffect(() => {
    if (!loading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [loading]);

  // Stop camera when unmounting
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current
          .stop()
          .then(() => html5QrCodeRef.current?.clear())
          .catch((err) => console.log('Camera stop cleanup err:', err));
      }
    };
  }, []);

  const handleScanSerial = async (serialToScan) => {
    const sn = (serialToScan || serialInput).trim();
    if (!sn) return;

    try {
      setSubmitting(true);
      setScanFeedback(null);

      const res = await api.post(`/orders/${id}/scan`, {
        serialNumber: sn,
      });

      setScanFeedback({
        type: 'success',
        message: `Successfully verified and reserved ${sn} for this order!`,
        serial: sn,
        item: res.data?.item,
      });

      setSerialInput('');
      // Refresh pick list & order
      await fetchOrderAndPickList();
    } catch (err) {
      console.error('Scan error:', err);
      const msg =
        err.response?.data?.message ||
        'Scan failed: Item could not be verified or added.';
      setScanFeedback({
        type: 'error',
        message: msg,
        serial: sn,
      });
    } finally {
      setSubmitting(false);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  const handleUndoScan = async (serialNumber) => {
    if (!window.confirm(`Undo scan for serial ${serialNumber}?`)) return;

    try {
      setSubmitting(true);
      setScanFeedback(null);
      await api.delete(`/orders/${id}/scan/${encodeURIComponent(serialNumber)}`);
      setScanFeedback({
        type: 'success',
        message: `Undid scan for ${serialNumber}. Unit returned to IN_STOCK.`,
        serial: serialNumber,
      });
      await fetchOrderAndPickList();
    } catch (err) {
      console.error('Undo scan error:', err);
      setScanFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to undo scan.',
        serial: serialNumber,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCamera = async () => {
    if (cameraActive) {
      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop();
          await html5QrCodeRef.current.clear();
        } catch (e) {
          console.warn('Error stopping camera:', e);
        }
        html5QrCodeRef.current = null;
      }
      setCameraActive(false);
    } else {
      try {
        setCameraActive(true);
        // Small delay so DOM node renders
        setTimeout(async () => {
          try {
            const scanner = new Html5Qrcode('qr-reader');
            html5QrCodeRef.current = scanner;
            await scanner.start(
              { facingMode: 'environment' },
              {
                fps: 10,
                qrbox: { width: 250, height: 250 },
              },
              (decodedText) => {
                // Throttle / handle scanned
                handleScanSerial(decodedText);
              },
              (error) => {
                // ignore frame failure
              }
            );
          } catch (camErr) {
            console.error('Camera start error:', camErr);
            setScanFeedback({
              type: 'error',
              message:
                'Could not access camera. Please allow camera permissions or use USB barcode / keyboard input.',
            });
            setCameraActive(false);
          }
        }, 100);
      } catch (err) {
        console.error(err);
      }
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-slate-400">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm">Loading warehouse scanner...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800">Cannot Open Pick List</h2>
        <p className="text-xs text-slate-500 mt-1">{error || 'Order does not exist.'}</p>
        <Link
          to={`/orders/${id}`}
          className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Order
        </Link>
      </div>
    );
  }

  const isPickListComplete =
    pickList.length > 0 &&
    pickList.every((it) => it.qty_scanned >= it.qty_required);

  const scannedSerials = order.scanned_serials || [];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to={`/orders/${id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Order {order.order_number}
          </Link>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <QrCode className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Warehouse Pick & Scan: {order.order_number}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Customer: <strong>{order.lead?.customer_name}</strong> • City: {order.lead?.city}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/inventory/labels"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs transition"
          >
            <QrCode className="w-3.5 h-3.5 text-indigo-600" />
            <span>Print QR Labels Sheet ↗</span>
          </Link>
          <Link
            to={`/orders/${id}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition"
          >
            <span>Finish & View Order</span>
          </Link>
        </div>
      </div>

      {/* Completion Banner */}
      {isPickListComplete && (
        <div className="bg-gradient-to-r from-emerald-500 to-green-600 text-white p-5 rounded-2xl shadow-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-7 h-7 text-emerald-100 shrink-0" />
            <div>
              <div className="font-extrabold text-sm sm:text-base">
                All Serialized Items Scanned & Verified!
              </div>
              <div className="text-xs text-emerald-100 mt-0.5">
                Pick list is 100% complete. Order is ready to dispatch via delivery vehicle.
              </div>
            </div>
          </div>
          <Link
            to={`/orders/${id}`}
            className="px-4 py-2 bg-white text-emerald-800 text-xs font-extrabold rounded-xl shadow-xs hover:bg-emerald-50 transition whitespace-nowrap"
          >
            Ready for Dispatch →
          </Link>
        </div>
      )}

      {/* Scanner & Quick Test Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Scan Input & Camera Box */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h2 className="text-sm font-bold text-slate-900">
                  Barcode / QR Scanner Ready
                </h2>
              </div>
              <button
                onClick={toggleCamera}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                  cameraActive
                    ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                    : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                }`}
              >
                {cameraActive ? (
                  <>
                    <CameraOff className="w-3.5 h-3.5" />
                    <span>Stop Camera</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-3.5 h-3.5" />
                    <span>Start Phone/Webcam</span>
                  </>
                )}
              </button>
            </div>

            {/* Camera Viewport */}
            {cameraActive && (
              <div className="p-3 bg-slate-900 rounded-2xl overflow-hidden text-center">
                <div
                  id="qr-reader"
                  className="w-full max-w-sm mx-auto overflow-hidden rounded-xl"
                />
                <div className="text-[11px] text-slate-300 mt-2 font-medium">
                  Point camera at equipment barcode or QR sticker
                </div>
              </div>
            )}

            {/* Manual / USB Scanner Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleScanSerial();
              }}
              className="space-y-2"
            >
              <label className="block text-xs font-bold text-slate-700">
                Scan Serial Number (USB Barcode Scanner or Keyboard)
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={serialInput}
                    onChange={(e) => setSerialInput(e.target.value.toUpperCase())}
                    placeholder={`Scan barcode or type serial${demoScans[1] ? ` (e.g. ${demoScans[1].serial})` : ""}...`}
                    className="w-full pl-3 pr-3 py-2.5 text-sm font-mono font-bold tracking-wider rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 uppercase placeholder:normal-case placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting || !serialInput.trim()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:bg-slate-200 disabled:text-slate-400"
                >
                  {submitting ? 'Verifying...' : 'Verify & Scan'}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                A physical USB scanner automatically enters the serial number and presses Enter.
              </p>
            </form>

            {/* Scan Feedback Banner */}
            {scanFeedback && (
              <div
                className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
                  scanFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-rose-50 border-rose-300 text-rose-900'
                }`}
              >
                {scanFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="text-xs">
                  <div className="font-bold text-sm">
                    {scanFeedback.type === 'success'
                      ? '✓ Verification Succeeded'
                      : '✕ 409 Scan Blocked'}
                  </div>
                  <div className="mt-0.5 font-medium">{scanFeedback.message}</div>
                  {scanFeedback.serial && (
                    <div className="font-mono text-[11px] opacity-75 mt-1">
                      Scanned: {scanFeedback.serial}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Rehearsal Demo Cheat Sheet */}
            <div className="pt-3 border-t border-slate-100">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Demo Shortcuts (1-Click Sample Scans)</span>
              </div>
              {demoScans.length === 0 ? (
                <p className="text-[11px] text-slate-400">No sample serials needed: every serialized line is scanned.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {demoScans.map((d) => {
                    const tone = DEMO_TONES[d.tone] || DEMO_TONES.indigo;
                    return (
                      <button
                        key={d.serial}
                        type="button"
                        onClick={() => handleScanSerial(d.serial)}
                        className={`p-2 text-left rounded-xl border transition ${tone.box}`}
                      >
                        <div className="font-bold flex items-center justify-between">
                          <span>{d.label}</span>
                          <span className={`text-[10px] font-mono ${tone.accent}`}>{d.tag}</span>
                        </div>
                        <div className={`text-[11px] font-mono mt-0.5 ${tone.mono}`}>{d.serial}</div>
                        <div className={`text-[10px] mt-0.5 ${tone.accent}`}>{d.note}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Scanned Serials List with Undo */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Scanned Items for This Order ({scannedSerials.length})
              </h3>
              <span className="text-xs text-slate-400">Click trash to undo scan</span>
            </div>

            {scannedSerials.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                No serial numbers scanned for this order yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {scannedSerials.map((s) => (
                  <div
                    key={s.id || s.serial_number}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs hover:bg-slate-100/80 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="p-1 bg-emerald-100 text-emerald-700 rounded-lg">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                      <div>
                        <div className="font-mono font-bold text-slate-900">
                          {s.serial_number}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Product #{s.product_id} • Status: {s.status}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleUndoScan(s.serial_number)}
                      title="Undo scan / release unit back to stock"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Pick List Lines & Progress */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Layers className="w-4 h-4" />
                </span>
                <h2 className="text-sm font-bold text-slate-900">
                  Pick List Requirements
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Each serialized product line tracks physical units scanned.
              </p>
            </div>

            <div className="space-y-3">
              {pickList.map((item) => {
                const req = item.qty_required || 0;
                const scan = item.qty_scanned || 0;
                const isDone = scan >= req;
                const pct = req > 0 ? Math.min(100, Math.round((scan / req) * 100)) : 100;

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-xl border transition ${
                      isDone
                        ? 'bg-emerald-50/50 border-emerald-200'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900 text-xs">
                          {item.product?.name || `Product #${item.product_id}`}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {item.product?.sku}
                        </div>
                      </div>

                      {isDone ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" /> Done
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          {scan} of {req} scanned
                        </span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isDone ? 'bg-emerald-500' : 'bg-indigo-600'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Helper Note */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 space-y-1">
              <div className="font-bold text-slate-700 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                Warehouse Protocol:
              </div>
              <div>• Units must be free in stock (IN_STOCK) to be reserved.</div>
              <div>• If an item was reserved for another customer, scan is rejected (409).</div>
              <div>• Non-serialized items (wires, fasteners) are deducted on dispatch.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
