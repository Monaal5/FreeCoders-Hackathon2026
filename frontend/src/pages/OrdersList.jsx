import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { ORDER_STATUS, ORDER_STATUS_CONFIG } from '../utils/orderStatus';
import {
  Package,
  Search,
  Filter,
  ArrowRight,
  Clock,
  CheckCircle2,
  Truck,
  ShieldCheck,
  CreditCard,
  AlertCircle,
  RefreshCw,
  PlusCircle,
  Layers,
} from 'lucide-react';

export default function OrdersList() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/orders');
      setOrders(res.data || []);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(err.response?.data?.message || 'Failed to load orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
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

  // Filtered orders
  const filteredOrders = orders.filter((order) => {
    const matchesStatus =
      statusFilter === 'ALL' || order.status === statusFilter;
    const query = search.toLowerCase();
    const matchesSearch =
      !search ||
      order.order_number?.toLowerCase().includes(query) ||
      order.lead?.customer_name?.toLowerCase().includes(query) ||
      order.lead?.city?.toLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  });

  // Metrics
  const totalOrders = orders.length;
  const pendingPayment = orders.filter(
    (o) => o.status === ORDER_STATUS.PENDING_PAYMENT
  ).length;
  const confirmed = orders.filter(
    (o) => o.status === ORDER_STATUS.CONFIRMED
  ).length;
  const dispatched = orders.filter(
    (o) => o.status === ORDER_STATUS.DISPATCHED
  ).length;
  const delivered = orders.filter(
    (o) => o.status === ORDER_STATUS.DELIVERED
  ).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-100 text-amber-700 rounded-xl">
              <Package className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Orders & Dispatch
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Track customer orders from advance payment through warehouse pick & scan to site delivery and warranty activation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchOrders}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <Link
            to="/inventory"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs transition"
          >
            <Layers className="w-3.5 h-3.5 text-amber-500" />
            <span>Warehouse Stock</span>
          </Link>
          <Link
            to="/jobs"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition"
          >
            <Truck className="w-3.5 h-3.5 text-amber-400" />
            <span>Crew Schedule</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div
          onClick={() => setStatusFilter('ALL')}
          className={`cursor-pointer p-4 rounded-2xl border transition ${
            statusFilter === 'ALL'
              ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/30'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Total Orders
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">{totalOrders}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">All customer projects</div>
        </div>

        <div
          onClick={() => setStatusFilter(ORDER_STATUS.PENDING_PAYMENT)}
          className={`cursor-pointer p-4 rounded-2xl border transition ${
            statusFilter === ORDER_STATUS.PENDING_PAYMENT
              ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/30'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600">
              Pending Advance
            </span>
            <Clock className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-900 mt-1">{pendingPayment}</div>
          <div className="text-[11px] text-amber-700/80 mt-0.5">Needs ≥30% advance</div>
        </div>

        <div
          onClick={() => setStatusFilter(ORDER_STATUS.CONFIRMED)}
          className={`cursor-pointer p-4 rounded-2xl border transition ${
            statusFilter === ORDER_STATUS.CONFIRMED
              ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-400/30'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Confirmed / Pick
            </span>
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-indigo-900 mt-1">{confirmed}</div>
          <div className="text-[11px] text-indigo-700/80 mt-0.5">Ready for scanning</div>
        </div>

        <div
          onClick={() => setStatusFilter(ORDER_STATUS.DISPATCHED)}
          className={`cursor-pointer p-4 rounded-2xl border transition ${
            statusFilter === ORDER_STATUS.DISPATCHED
              ? 'bg-purple-50/70 border-purple-300 ring-2 ring-purple-400/30'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600">
              Dispatched
            </span>
            <Truck className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-purple-900 mt-1">{dispatched}</div>
          <div className="text-[11px] text-purple-700/80 mt-0.5">On vehicle to site</div>
        </div>

        <div
          onClick={() => setStatusFilter(ORDER_STATUS.DELIVERED)}
          className={`cursor-pointer p-4 rounded-2xl border transition ${
            statusFilter === ORDER_STATUS.DELIVERED
              ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-400/30'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
              Delivered
            </span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-900 mt-1">{delivered}</div>
          <div className="text-[11px] text-emerald-700/80 mt-0.5">Warranties active</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by order #, customer, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-semibold text-slate-400 flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>
          {['ALL', ...Object.values(ORDER_STATUS)].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                statusFilter === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'ALL' ? 'All' : ORDER_STATUS_CONFIG[st]?.label || st}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
            <p className="text-xs">Loading orders...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-500">
            <AlertCircle className="w-6 h-6 mx-auto mb-2" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700">No orders found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {search || statusFilter !== 'ALL'
                ? 'Try clearing filters or search terms.'
                : 'Orders are created automatically when quotes are marked as ACCEPTED.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-5 py-3.5">Order</th>
                  <th className="px-5 py-3.5">Customer & Location</th>
                  <th className="px-5 py-3.5">Order Value</th>
                  <th className="px-5 py-3.5">Payment Status (Advance / Total)</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((order) => {
                  const statusConf = ORDER_STATUS_CONFIG[order.status] || {
                    label: order.status,
                    color: 'bg-slate-100 text-slate-700 border-slate-200',
                  };
                  const paid = Number(order.amount_paid || 0);
                  const total = Number(order.total_amount || 0);
                  const advanceReq = Number(order.advance_required || 0);
                  const paidPercent = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
                  const isAdvanceSatisfied = paid >= advanceReq;

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-slate-50/70 transition group"
                    >
                      {/* Order info */}
                      <td className="px-5 py-4">
                        <Link
                          to={`/orders/${order.id}`}
                          className="font-black text-slate-900 hover:text-amber-600 transition flex items-center gap-1.5"
                        >
                          <span>{order.order_number}</span>
                          <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                        </Link>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {formatDate(order.created_at)}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-800">
                          {order.lead?.customer_name || 'Walk-in Customer'}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {order.lead?.city || 'Pune'} • {order.lead?.phone || '—'}
                        </div>
                      </td>

                      {/* Total Amount */}
                      <td className="px-5 py-4">
                        <div className="font-extrabold text-slate-900">
                          {formatCurrency(total)}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Min. 30% Adv: {formatCurrency(advanceReq)}
                        </div>
                      </td>

                      {/* Payment progress */}
                      <td className="px-5 py-4 min-w-[200px]">
                        <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
                          <span className={isAdvanceSatisfied ? 'text-emerald-700' : 'text-amber-700'}>
                            {formatCurrency(paid)} paid
                          </span>
                          <span className="text-slate-400">{paidPercent}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
                          <div
                            className={`h-full transition-all duration-300 ${
                              paid >= total
                                ? 'bg-emerald-500'
                                : isAdvanceSatisfied
                                ? 'bg-indigo-500'
                                : 'bg-amber-500'
                            }`}
                            style={{ width: `${paidPercent}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                          {isAdvanceSatisfied ? (
                            <span className="text-emerald-600 font-medium flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3 inline" /> Advance cleared
                            </span>
                          ) : (
                            <span className="text-amber-600 font-medium">
                              Need {formatCurrency(Math.max(0, advanceReq - paid))} more for confirmation
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusConf.color}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dot || 'bg-slate-400'}`} />
                          {statusConf.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <Link
                          to={`/orders/${order.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
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
