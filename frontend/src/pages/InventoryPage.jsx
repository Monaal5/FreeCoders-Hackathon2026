import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import Modal from '../components/Modal';
import {
  Layers,
  Search,
  Filter,
  PlusCircle,
  AlertTriangle,
  CheckCircle2,
  Package,
  QrCode,
  ArrowUpDown,
  RefreshCw,
  Box,
  Truck,
  Hash,
} from 'lucide-react';

export default function InventoryPage() {
  const [inventory, setInventory] = useState([]);
  const [serials, setSerials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tab & filters
  const [activeTab, setActiveTab] = useState('products'); // 'products' | 'serials'
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Receive stock modal
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [receiveProductId, setReceiveProductId] = useState('');
  const [receiveQuantity, setReceiveQuantity] = useState('');
  const [receiveSerialsText, setReceiveSerialsText] = useState('');
  const [receiveLoading, setReceiveLoading] = useState(false);
  const [receiveError, setReceiveError] = useState(null);
  const [receiveSuccess, setReceiveSuccess] = useState(null);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      setError(null);
      const [invRes, serialsRes] = await Promise.all([
        api.get('/inventory'),
        api.get('/inventory/serials'),
      ]);
      setInventory(invRes.data || []);
      setSerials(serialsRes.data || []);
      if (invRes.data?.length > 0 && !receiveProductId) {
        setReceiveProductId(invRes.data[0].id.toString());
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
      setError(err.response?.data?.message || 'Failed to load inventory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const selectedProduct = inventory.find(
    (p) => p.id.toString() === receiveProductId?.toString()
  );

  const handleReceiveStock = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;

    try {
      setReceiveLoading(true);
      setReceiveError(null);
      setReceiveSuccess(null);

      const isSerialized = selectedProduct.is_serialized !== false;
      const payload = {
        productId: Number(selectedProduct.id),
      };

      if (isSerialized) {
        const lines = receiveSerialsText
          .split(/[\n,]+/)
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean);

        if (lines.length === 0) {
          setReceiveError('Please enter at least one serial number.');
          setReceiveLoading(false);
          return;
        }
        payload.serials = lines;
      } else {
        const qty = parseInt(receiveQuantity, 10);
        if (isNaN(qty) || qty <= 0) {
          setReceiveError('Please enter a valid quantity greater than zero.');
          setReceiveLoading(false);
          return;
        }
        payload.quantity = qty;
      }

      const res = await api.post('/inventory/receive', payload);
      setReceiveSuccess(
        `Stock received successfully! ${
          res.data?.serialsCount
            ? `${res.data.serialsCount} serial units created.`
            : `Quantity updated to ${res.data?.product?.stock_qty}.`
        }`
      );

      await fetchInventory();
      setTimeout(() => {
        setIsReceiveModalOpen(false);
        setReceiveSuccess(null);
        setReceiveQuantity('');
        setReceiveSerialsText('');
      }, 1500);
    } catch (err) {
      console.error('Receive stock error:', err);
      setReceiveError(
        err.response?.data?.message || 'Failed to receive stock into warehouse.'
      );
    } finally {
      setReceiveLoading(false);
    }
  };

  // Categories
  const categories = ['ALL', ...new Set(inventory.map((p) => p.category).filter(Boolean))];

  // Filtered products
  const filteredProducts = inventory.filter((p) => {
    const matchesCategory =
      categoryFilter === 'ALL' || p.category === categoryFilter;
    const matchesLowStock = !lowStockOnly || p.is_low_stock;
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      p.name?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q);
    return matchesCategory && matchesLowStock && matchesSearch;
  });

  // Filtered serials
  const filteredSerials = serials.filter((s) => {
    const q = search.toLowerCase();
    return (
      !search ||
      s.serial_number?.toLowerCase().includes(q) ||
      s.product_name?.toLowerCase().includes(q) ||
      s.status?.toLowerCase().includes(q)
    );
  });

  // KPI calculations
  const totalProductsCount = inventory.length;
  const lowStockCount = inventory.filter((p) => p.is_low_stock).length;
  const totalInStockSerials = serials.filter((s) => s.status === 'IN_STOCK').length;
  const totalReservedSerials = serials.filter((s) => s.status === 'RESERVED').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-100 text-amber-700 rounded-xl">
              <Layers className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Warehouse Inventory & Serial Ledger
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time tracking of bulk solar stock, individual serialized equipment, and reorder levels.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/inventory/labels"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs transition"
          >
            <QrCode className="w-3.5 h-3.5 text-indigo-600" />
            <span>QR Sticker Sheet</span>
          </Link>
          <button
            onClick={() => setIsReceiveModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl shadow-xs transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Receive Stock In</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Catalog Items
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {totalProductsCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Active SKU listings</div>
        </div>

        <div
          onClick={() => setLowStockOnly(!lowStockOnly)}
          className={`cursor-pointer p-4 rounded-2xl border transition ${
            lowStockOnly
              ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-400/30'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
              Low Stock Alerts
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-900 mt-1">
            {lowStockCount}
          </div>
          <div className="text-[11px] text-rose-600 mt-0.5">
            {lowStockOnly ? 'Filtering low stock only' : 'Below reorder threshold'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
              In-Stock Serials
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-900 mt-1">
            {totalInStockSerials}
          </div>
          <div className="text-[11px] text-emerald-600 mt-0.5">Free for scanning</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Reserved Serials
            </span>
            <Box className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-indigo-900 mt-1">
            {totalReservedSerials}
          </div>
          <div className="text-[11px] text-indigo-600 mt-0.5">Allocated to active orders</div>
        </div>
      </div>

      {/* Tabs and Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'products'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Stock by Product SKU ({filteredProducts.length})
          </button>
          <button
            onClick={() => setActiveTab('serials')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'serials'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Physical Serial Ledger ({filteredSerials.length})
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={
                activeTab === 'products'
                  ? 'Search SKU, name, category...'
                  : 'Search serial number...'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {activeTab === 'products' && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === 'ALL' ? 'All Categories' : c}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
            <p className="text-xs">Loading warehouse inventory...</p>
          </div>
        ) : activeTab === 'products' ? (
          /* Products View */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-5 py-3.5">Product SKU & Name</th>
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5">Inventory Tracking</th>
                  <th className="px-5 py-3.5 text-center">Available Stock</th>
                  <th className="px-5 py-3.5 text-center">Reserved</th>
                  <th className="px-5 py-3.5 text-center">Reorder Level</th>
                  <th className="px-5 py-3.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  const isSerialized = p.is_serialized !== false;
                  const availableStock = isSerialized
                    ? p.in_stock_serials_count || 0
                    : p.stock_qty || 0;
                  const isLow = p.is_low_stock;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          {p.sku}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">{p.category}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isSerialized
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isSerialized ? 'Serialized (1-by-1)' : 'Bulk Qty'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span
                          className={`font-black text-sm ${
                            isLow ? 'text-rose-600' : 'text-slate-900'
                          }`}
                        >
                          {availableStock}
                        </span>
                        {isSerialized && (
                          <div className="text-[10px] text-slate-400">units</div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center font-bold text-indigo-600">
                        {p.reserved_serials_count || 0}
                      </td>
                      <td className="px-5 py-3.5 text-center text-slate-500 font-semibold">
                        {p.reorder_level || 5}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertTriangle className="w-3.5 h-3.5" /> Reorder Alert
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" /> In Stock
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Serials View */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-5 py-3.5">Serial Number</th>
                  <th className="px-5 py-3.5">Product SKU & Name</th>
                  <th className="px-5 py-3.5">Current Status</th>
                  <th className="px-5 py-3.5">Assigned Order</th>
                  <th className="px-5 py-3.5">Received Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSerials.map((s) => (
                  <tr key={s.id || s.serial_number} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-900">
                      {s.serial_number}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-800">
                        {s.product_name || `Product #${s.product_id}`}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {s.sku}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          s.status === 'IN_STOCK'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : s.status === 'RESERVED'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : s.status === 'DISPATCHED'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-700">
                      {s.order_id ? (
                        <Link
                          to={`/orders/${s.order_id}`}
                          className="text-amber-600 hover:underline"
                        >
                          Order #{s.order_id}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">
                      {new Date(s.received_at || Date.now()).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Receive Stock Modal */}
      <Modal
        isOpen={isReceiveModalOpen}
        onClose={() => setIsReceiveModalOpen(false)}
        title="Receive Inward Stock"
      >
        <form onSubmit={handleReceiveStock} className="space-y-4">
          {receiveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold">
              {receiveSuccess}
            </div>
          )}

          {receiveError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
              {receiveError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Select Product SKU *
            </label>
            <select
              value={receiveProductId}
              onChange={(e) => setReceiveProductId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
            >
              {inventory.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku}) — {p.category}
                </option>
              ))}
            </select>
          </div>

          {selectedProduct && selectedProduct.is_serialized === false ? (
            /* Bulk quantity input */
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Quantity Received (Units / Metres / Sets) *
              </label>
              <input
                type="number"
                min="1"
                required
                value={receiveQuantity}
                onChange={(e) => setReceiveQuantity(e.target.value)}
                placeholder="e.g. 50"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
              />
            </div>
          ) : (
            /* Serialized input: textarea for multiple serials */
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  Enter or Paste Serial Numbers *
                </label>
                <span className="text-[11px] text-slate-400 font-medium">
                  {
                    receiveSerialsText
                      .split(/[\n,]+/)
                      .filter((s) => s.trim().length > 0).length
                  }{' '}
                  serials detected
                </span>
              </div>
              <textarea
                rows={5}
                required
                value={receiveSerialsText}
                onChange={(e) => setReceiveSerialsText(e.target.value)}
                placeholder={`INV-HYB-5K-0091\nINV-HYB-5K-0092\nINV-HYB-5K-0093`}
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Separate serials by newline or commas. Physical barcodes can be scanned directly into this box.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsReceiveModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={receiveLoading}
              className="px-4 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl shadow-xs transition"
            >
              {receiveLoading ? 'Saving...' : 'Add to Warehouse Stock'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
