import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import {
  TrendingUp,
  IndianRupee,
  Layers,
  ArrowRight,
  Filter,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  PieChart,
  Package,
  Wrench,
  Percent,
  Download,
  Calendar,
} from 'lucide-react';

export default function RevenueDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/orders/revenue-analytics');
      setAnalytics(res.data || res);
    } catch (err) {
      console.error('Error fetching revenue analytics:', err);
      setError(err.response?.data?.message || 'Failed to load revenue analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const totals = analytics?.totals || {};
  const orders = analytics?.orders || [];
  const packageBreakdown = analytics?.packageBreakdown || {};

  // Financial calculations
  const totalRevenue = Number(totals.total_contracted_revenue || 0);
  const totalCollected = Number(totals.total_cash_collected || 0);
  const totalReceivables = Number(totals.total_receivables || 0);
  const totalHardwareCost = orders.reduce((sum, o) => sum + Number(o.hardware_cost || 0), 0);
  const totalLabourCost = orders.reduce((sum, o) => sum + Number(o.labour_cost || 0), 0);
  const totalCogs = totalHardwareCost + totalLabourCost;
  const overallGrossProfit = totalRevenue > 0 ? totalRevenue - totalCogs : 0;
  const overallMarginPct = totalRevenue > 0 ? Math.round((overallGrossProfit / totalRevenue) * 100) : 0;
  const collectionRatePct = totalRevenue > 0 ? Math.min(100, Math.round((totalCollected / totalRevenue) * 100)) : 0;

  // Filter orders
  const filteredOrders = orders.filter((o) => {
    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      o.order_number?.toLowerCase().includes(q) ||
      o.customer_name?.toLowerCase().includes(q) ||
      o.city?.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Executive Revenue & Profitability Dashboard
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time tracking of contracted revenue, cash collections, equipment COGS, and per-project gross margins.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAnalytics}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Export Statement</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Gross Contracted Revenue */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Contracted Revenue
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {formatCurrency(totalRevenue)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {totals.total_orders || orders.length} Customer Projects
          </div>
        </div>

        {/* Cash Collected Inflow */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
              Cash Collected
            </span>
            <IndianRupee className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1">
            {formatCurrency(totalCollected)}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">
            {collectionRatePct}% Collection Rate
          </div>
        </div>

        {/* Outstanding Receivables */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600">
              Outstanding Due
            </span>
            <Percent className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-700 mt-1">
            {formatCurrency(totalReceivables)}
          </div>
          <div className="text-[11px] text-amber-600 mt-0.5">
            Uncollected balance
          </div>
        </div>

        {/* Realized COGS (Hardware + Labor) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600">
              Project COGS
            </span>
            <Wrench className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-purple-900 mt-1">
            {formatCurrency(totalCogs)}
          </div>
          <div className="text-[11px] text-purple-600 mt-0.5">
            Equipment & Labor costs
          </div>
        </div>

        {/* Net Gross Margin */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-2xl border border-emerald-300 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-800">
              Net Gross Profit
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-600 text-white">
              {overallMarginPct}% Margin
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-950 mt-1">
            {formatCurrency(overallGrossProfit)}
          </div>
          <div className="text-[11px] text-emerald-700 mt-0.5 font-medium">
            Retained gross earnings
          </div>
        </div>
      </div>

      {/* Package Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(packageBreakdown).map(([key, data]) => {
          const share = totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 100) : 0;
          return (
            <div
              key={key}
              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between"
            >
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {key.replace('_', ' ')} Packages
                </div>
                <div className="text-lg font-black text-slate-900 mt-0.5">
                  {formatCurrency(data.revenue)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {data.count} installations • {data.capacity_kw?.toFixed(1)} kW installed
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-black px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {share}% of Sales
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search order #, customer, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          <span className="text-xs font-semibold text-slate-400 flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>
          {['ALL', 'CONFIRMED', 'DISPATCHED', 'DELIVERED', 'INSTALLED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                statusFilter === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'ALL' ? 'All Orders' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Profitability Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
            <p className="text-xs">Computing revenue analytics and margins...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-500">
            <AlertCircle className="w-6 h-6 mx-auto mb-2" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-600">No project orders found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-5 py-3.5">Order & Date</th>
                  <th className="px-5 py-3.5">Customer & City</th>
                  <th className="px-5 py-3.5">System Size</th>
                  <th className="px-5 py-3.5 text-right">Contract Price</th>
                  <th className="px-5 py-3.5 text-right">Cash Paid</th>
                  <th className="px-5 py-3.5 text-right">Hardware COGS</th>
                  <th className="px-5 py-3.5 text-right">Labor Cost</th>
                  <th className="px-5 py-3.5 text-right">Gross Profit</th>
                  <th className="px-5 py-3.5 text-center">Margin %</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((o) => {
                  const margin = o.margin_pct || 0;
                  const isHigh = margin >= 25;
                  const isLow = margin < 15;

                  return (
                    <tr key={o.id} className="hover:bg-slate-50/70 transition">
                      {/* Order info */}
                      <td className="px-5 py-3.5">
                        <Link
                          to={`/orders/${o.id}`}
                          className="font-bold text-slate-900 hover:text-emerald-600 transition"
                        >
                          {o.order_number}
                        </Link>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {formatDate(o.created_at)}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-800">
                          {o.customer_name || 'Walk-in'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {o.city || 'Pune'}
                        </div>
                      </td>

                      {/* System */}
                      <td className="px-5 py-3.5">
                        <span className="font-bold text-slate-900">
                          {o.capacity_kw || 3.0} kW
                        </span>
                        <div className="text-[10px] text-slate-400">
                          {o.package_kind || 'ON_GRID'}
                        </div>
                      </td>

                      {/* Contract Price */}
                      <td className="px-5 py-3.5 text-right font-black text-slate-900">
                        {formatCurrency(o.total_amount)}
                      </td>

                      {/* Cash Paid */}
                      <td className="px-5 py-3.5 text-right">
                        <span className="font-extrabold text-emerald-700">
                          {formatCurrency(o.amount_paid)}
                        </span>
                        <div className="text-[10px] text-slate-400">
                          Due: {formatCurrency(Math.max(0, o.total_amount - o.amount_paid))}
                        </div>
                      </td>

                      {/* Hardware cost */}
                      <td className="px-5 py-3.5 text-right text-slate-600 font-medium">
                        {formatCurrency(o.hardware_cost)}
                      </td>

                      {/* Labour cost */}
                      <td className="px-5 py-3.5 text-right text-slate-600 font-medium">
                        {formatCurrency(o.labour_cost)}
                      </td>

                      {/* Gross Profit */}
                      <td className="px-5 py-3.5 text-right font-black text-emerald-900">
                        {formatCurrency(o.gross_profit)}
                      </td>

                      {/* Margin % */}
                      <td className="px-5 py-3.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            isHigh
                              ? 'bg-emerald-100 text-emerald-800'
                              : isLow
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-teal-100 text-teal-800'
                          }`}
                        >
                          {margin}%
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          to={`/orders/${o.id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800"
                        >
                          <span>Manage</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
