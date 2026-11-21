import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import api from '../api/client';
import {
  QrCode,
  Printer,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  Layers,
  Sparkles,
} from 'lucide-react';

export default function QrLabels() {
  const [serials, setSerials] = useState([]);
  const [qrMap, setQrMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const fetchSerials = async () => {
    try {
      setLoading(true);
      const res = await api.get('/inventory/serials');
      const list = res.data || [];
      setSerials(list);

      // Generate QR codes for all serials
      const map = {};
      await Promise.all(
        list.map(async (s) => {
          try {
            const dataUrl = await QRCode.toDataURL(s.serial_number, {
              margin: 1,
              width: 140,
              color: {
                dark: '#0f172a',
                light: '#ffffff',
              },
            });
            map[s.serial_number] = dataUrl;
          } catch (e) {
            console.error('QR generation error for', s.serial_number, e);
          }
        })
      );
      setQrMap(map);
    } catch (err) {
      console.error('Error fetching serials for labels:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSerials();
  }, []);

  const categories = [
    'ALL',
    ...new Set(serials.map((s) => s.category).filter(Boolean)),
  ];

  const filteredSerials = serials.filter((s) => {
    const matchesCat =
      categoryFilter === 'ALL' || s.category === categoryFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      s.serial_number?.toLowerCase().includes(q) ||
      s.product_name?.toLowerCase().includes(q) ||
      s.sku?.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header - hidden in print */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <QrCode className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Warehouse QR Code Equipment Stickers
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Print high-contrast QR labels to stick onto physical inverters, batteries, charge controllers, and panels for mobile/USB scanning.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>Print Sticker Sheet</span>
          </button>
        </div>
      </div>

      {/* Demo helper alert banner */}
      <div className="no-print bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-2xl flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <span className="font-bold">Hackathon Demo Tip:</span> You can point your phone or webcam at these QR codes directly from the screen during the demo, or test scanning with a USB barcode gun.
            Try scanning <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold text-rose-700">BAT-LIFE-5K-0003</code> on the warehouse scan screen to demonstrate the 409 conflict guard!
          </div>
        </div>
      </div>

      {/* Controls & Filters - hidden in print */}
      <div className="no-print bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search serial or product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Category:
          </span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === 'ALL' ? 'All Categories' : c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Printable Grid of Labels */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
          <p className="text-xs">Generating QR sticker codes...</p>
        </div>
      ) : filteredSerials.length === 0 ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <QrCode className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-600">No serial items match filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-3 print:gap-3">
          {filteredSerials.map((s) => {
            const qrSrc = qrMap[s.serial_number];
            const isReserved = s.status === 'RESERVED';

            return (
              <div
                key={s.id || s.serial_number}
                className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-4 shadow-xs flex flex-col justify-between print:border print:border-black print:rounded-none print:shadow-none print:break-inside-avoid relative"
              >
                {/* Special marker for demo conflict item */}
                {s.serial_number === 'BAT-LIFE-5K-0003' && (
                  <div className="no-print absolute top-2 right-2 bg-rose-500 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-xs">
                    Demo 409 Conflict
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 print:border-black">
                    <span className="text-[10px] uppercase font-black tracking-widest text-amber-600 print:text-black">
                      SunPower Warehouse
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 print:text-black">
                      {s.category || 'Solar Eq.'}
                    </span>
                  </div>

                  <div className="mt-2">
                    <div className="text-xs font-black text-slate-900 leading-tight">
                      {s.product_name || `Product #${s.product_id}`}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                      SKU: {s.sku || 'SKU-GENERIC'}
                    </div>
                  </div>
                </div>

                {/* QR Code Graphic */}
                <div className="my-3 flex flex-col items-center justify-center">
                  {qrSrc ? (
                    <img
                      src={qrSrc}
                      alt={s.serial_number}
                      className="w-28 h-28 object-contain print:w-24 print:h-24"
                    />
                  ) : (
                    <div className="w-28 h-28 bg-slate-100 flex items-center justify-center text-slate-400 text-xs">
                      QR Code
                    </div>
                  )}

                  <div className="mt-1 font-mono font-black text-xs sm:text-sm text-slate-900 tracking-wider bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 print:bg-white print:border-black print:text-black">
                    {s.serial_number}
                  </div>
                </div>

                {/* Footer info */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 print:text-black">
                  <span>
                    Status:{' '}
                    <strong
                      className={
                        isReserved
                          ? 'text-rose-600 print:text-black'
                          : 'text-emerald-700 print:text-black'
                      }
                    >
                      {s.status}
                    </strong>
                  </span>
                  <span className="no-print text-slate-300">•</span>
                  <span className="no-print">Scan to verify</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
