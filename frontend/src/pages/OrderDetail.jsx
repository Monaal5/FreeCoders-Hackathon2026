import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import Modal from '../components/Modal';
import {
  ORDER_STATUS,
  ORDER_STATUS_CONFIG,
  PAYMENT_MODES,
  PAYMENT_TYPES,
} from '../utils/orderStatus';
import {
  Package,
  ArrowLeft,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Truck,
  ShieldCheck,
  QrCode,
  Calendar,
  User,
  MapPin,
  Clock,
  Layers,
  FileText,
  RotateCcw,
  Sparkles,
  Award,
} from 'lucide-react';

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Payment modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentType, setPaymentType] = useState('ADVANCE');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState(null);
  const [paymentError, setPaymentError] = useState(null);

  // Dispatch modal / state
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [dispatchError, setDispatchError] = useState(null);

  // Delivery confirmation state
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [deliveryError, setDeliveryError] = useState(null);
  const [deliverySuccessMsg, setDeliverySuccessMsg] = useState(null);
  const [completeInstallLoading, setCompleteInstallLoading] = useState(false);

  const handleCompleteInstallation = async () => {
    if (!window.confirm('Mark this solar plant installation as completed and commissioned on site?')) return;
    try {
      setCompleteInstallLoading(true);
      if (order.job?.id) {
        await api.post(`/jobs/${order.job.id}/complete`, { remarks: 'Site installation completed and commissioned.' });
      } else {
        await api.post(`/orders/${id}/install`, {});
      }
      setDeliverySuccessMsg('Installation marked as COMPLETED! Plant commissioning verified.');
      await fetchOrder();
    } catch (err) {
      console.error('Installation complete error:', err);
      alert(err.response?.data?.message || 'Failed to complete installation.');
    } finally {
      setCompleteInstallLoading(false);
    }
  };

  const fetchOrder = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/orders/${id}`);
      setOrder(res.data);
    } catch (err) {
      console.error('Error fetching order:', err);
      setError(err.response?.data?.message || 'Failed to load order details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

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

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Payment Submit
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    const amountNum = Number(paymentAmount);
    if (!amountNum || amountNum <= 0) {
      setPaymentError('Please enter a valid payment amount greater than zero.');
      return;
    }

    try {
      setPaymentLoading(true);
      setPaymentError(null);
      const res = await api.post(`/orders/${id}/payments`, {
        amount: amountNum,
        type: paymentType,
        mode: paymentMode,
        reference: paymentRef.trim() || `TXN-${Date.now().toString().slice(-6)}`,
      });

      // Check if threshold crossed
      const updatedOrder = res.data?.order || res.data;
      const advanceCrossed =
        order?.status === ORDER_STATUS.PENDING_PAYMENT &&
        (updatedOrder?.status === ORDER_STATUS.CONFIRMED ||
          updatedOrder?.amount_paid >= updatedOrder?.advance_required);

      setPaymentSuccessMsg(
        advanceCrossed
          ? '🎉 Advance threshold met! Order Confirmed: Pick list & Installation Job created automatically.'
          : 'Payment recorded successfully.'
      );

      // Refresh order
      await fetchOrder();
      setTimeout(() => {
        setIsPaymentModalOpen(false);
        setPaymentSuccessMsg(null);
        setPaymentAmount('');
        setPaymentRef('');
      }, 1500);
    } catch (err) {
      console.error('Payment error:', err);
      setPaymentError(
        err.response?.data?.message || 'Failed to record payment. Please try again.'
      );
    } finally {
      setPaymentLoading(false);
    }
  };

  // Dispatch Submit
  const handleDispatch = async (e) => {
    e.preventDefault();
    if (!vehicleNo.trim() || !driverName.trim()) {
      setDispatchError('Vehicle number and driver name are required.');
      return;
    }

    try {
      setDispatchLoading(true);
      setDispatchError(null);
      await api.post(`/orders/${id}/dispatch`, {
        vehicleNo: vehicleNo.trim(),
        driverName: driverName.trim(),
      });
      await fetchOrder();
      setIsDispatchModalOpen(false);
    } catch (err) {
      console.error('Dispatch error:', err);
      setDispatchError(
        err.response?.data?.message ||
          'Dispatch blocked: Ensure all pick list items are scanned and bulk stock is available.'
      );
    } finally {
      setDispatchLoading(false);
    }
  };

  // Delivery Confirm Submit
  const handleConfirmDelivery = async () => {
    try {
      setDeliveryLoading(true);
      setDeliveryError(null);
      await api.post(`/orders/${id}/deliver`, {});
      setDeliverySuccessMsg(
        'Delivery confirmed! All serial item warranties are now officially active.'
      );
      await fetchOrder();
    } catch (err) {
      console.error('Delivery confirmation error:', err);
      setDeliveryError(
        err.response?.data?.message || 'Failed to confirm delivery.'
      );
    } finally {
      setDeliveryLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center text-slate-400">
        <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm">Loading order details...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800">Order Not Found</h2>
        <p className="text-xs text-slate-500 mt-1">{error || 'Order does not exist.'}</p>
        <Link
          to="/orders"
          className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Orders
        </Link>
      </div>
    );
  }

  const paid = Number(order.amount_paid || 0);
  const total = Number(order.total_amount || 0);
  const advanceReq = Number(order.advance_required || total * 0.3);
  const balance = Math.max(0, total - paid);
  const paidPercent = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const advancePercent = total > 0 ? Math.round((advanceReq / total) * 100) : 30;
  const isAdvanceSatisfied = paid >= advanceReq;

  // Pick list completion check
  const pickListItems = order.pick_list || [];
  const pickListTotalRequired = pickListItems.reduce((acc, it) => acc + (it.qty_required || 0), 0);
  const pickListTotalScanned = pickListItems.reduce((acc, it) => acc + (it.qty_scanned || 0), 0);
  const isPickListComplete =
    pickListItems.length > 0 &&
    pickListItems.every((it) => it.qty_scanned >= it.qty_required);

  const statusConfig = ORDER_STATUS_CONFIG[order.status] || {
    label: order.status,
    color: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  // Steps definition for stepper
  const steps = [
    {
      key: ORDER_STATUS.PENDING_PAYMENT,
      label: 'Advance Payment',
      desc: 'Min. 30% required',
      done: isAdvanceSatisfied || order.status !== ORDER_STATUS.PENDING_PAYMENT,
      current: order.status === ORDER_STATUS.PENDING_PAYMENT,
    },
    {
      key: ORDER_STATUS.CONFIRMED,
      label: 'Warehouse Pick & Scan',
      desc: 'Scan serialized units',
      done: [
        ORDER_STATUS.DISPATCHED,
        ORDER_STATUS.DELIVERED,
        ORDER_STATUS.INSTALLED,
      ].includes(order.status),
      current: order.status === ORDER_STATUS.CONFIRMED,
    },
    {
      key: ORDER_STATUS.DISPATCHED,
      label: 'Truck Dispatched',
      desc: 'Materials in transit',
      done: [ORDER_STATUS.DELIVERED, ORDER_STATUS.INSTALLED].includes(
        order.status
      ),
      current: order.status === ORDER_STATUS.DISPATCHED,
    },
    {
      key: ORDER_STATUS.DELIVERED,
      label: 'Site Delivery & Warranty',
      desc: 'Warranties active',
      done: [ORDER_STATUS.DELIVERED, ORDER_STATUS.INSTALLED].includes(
        order.status
      ),
      current: order.status === ORDER_STATUS.DELIVERED,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Bar / Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/orders"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Orders
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Order {order.order_number}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusConfig.color}`}
            >
              <span className={`w-2 h-2 rounded-full ${statusConfig.dot || 'bg-slate-400'}`} />
              {statusConfig.label}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Created on {formatDate(order.created_at)} • Linked to Quote #{order.quote_id}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {order.status === ORDER_STATUS.PENDING_PAYMENT && (
            <button
              onClick={() => {
                setPaymentAmount(balance >= advanceReq ? advanceReq : balance);
                setPaymentType('ADVANCE');
                setIsPaymentModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition"
            >
              <CreditCard className="w-4 h-4" />
              <span>Record Advance Payment</span>
            </button>
          )}

          {order.status === ORDER_STATUS.CONFIRMED && (
            <>
              <Link
                to={`/orders/${order.id}/scan`}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition"
              >
                <QrCode className="w-4 h-4" />
                <span>Warehouse Barcode Scanner</span>
              </Link>
              <button
                onClick={() => setIsDispatchModalOpen(true)}
                disabled={!isPickListComplete}
                title={
                  !isPickListComplete
                    ? 'Scan all required serialized items on the pick list first'
                    : 'Dispatch vehicle'
                }
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-xs ${
                  isPickListComplete
                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Truck className="w-4 h-4" />
                <span>Dispatch Truck</span>
              </button>
            </>
          )}

          {order.status === ORDER_STATUS.DISPATCHED && (
            <button
              onClick={handleConfirmDelivery}
              disabled={deliveryLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{deliveryLoading ? 'Confirming...' : 'Confirm Delivery & Start Warranties'}</span>
            </button>
          )}

          {order.status === ORDER_STATUS.DELIVERED && (
            <button
              onClick={handleCompleteInstallation}
              disabled={completeInstallLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{completeInstallLoading ? 'Completing...' : 'Mark Installation Complete ✓'}</span>
            </button>
          )}

          {paid < total && order.status !== ORDER_STATUS.PENDING_PAYMENT && (
            <button
              onClick={() => {
                setPaymentAmount(balance);
                setPaymentType(balance <= 0 ? 'FULL' : 'BALANCE');
                setIsPaymentModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition"
            >
              <CreditCard className="w-4 h-4 text-slate-400" />
              <span>Record Balance</span>
            </button>
          )}
        </div>
      </div>

      {/* Delivery Success Banner */}
      {deliverySuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-600" />
            <span>{deliverySuccessMsg}</span>
          </div>
          <button
            onClick={() => setDeliverySuccessMsg(null)}
            className="text-emerald-600 hover:text-emerald-900"
          >
            ✕
          </button>
        </div>
      )}

      {/* Stepper Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
          Order Fulfillment Lifecycle
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((step, idx) => (
            <div
              key={step.key}
              className={`relative p-3.5 rounded-xl border transition ${
                step.current
                  ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-400/20'
                  : step.done
                  ? 'bg-slate-50/70 border-slate-200'
                  : 'bg-white border-dashed border-slate-200 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Step 0{idx + 1}
                </span>
                {step.done ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : step.current ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-slate-300" />
                )}
              </div>
              <div className="text-xs font-bold text-slate-900">{step.label}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{step.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Grid: Financial & Customer Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Financial Summary Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs lg:col-span-2 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                <CreditCard className="w-4 h-4" />
              </span>
              <h2 className="text-sm font-bold text-slate-900">
                Payment & Financial Progress
              </h2>
            </div>
            <span
              className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${
                paid >= total
                  ? 'bg-emerald-100 text-emerald-800'
                  : isAdvanceSatisfied
                  ? 'bg-indigo-100 text-indigo-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {paid >= total
                ? 'Paid in Full'
                : isAdvanceSatisfied
                ? 'Advance Cleared'
                : 'Awaiting Advance (≥30%)'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-2 border-y border-slate-100">
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Total Value</div>
              <div className="text-lg font-black text-slate-900 mt-0.5">
                {formatCurrency(total)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">30% Advance Req.</div>
              <div className="text-lg font-black text-amber-600 mt-0.5">
                {formatCurrency(advanceReq)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Total Paid</div>
              <div className="text-lg font-black text-emerald-600 mt-0.5">
                {formatCurrency(paid)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Remaining Due</div>
              <div className="text-lg font-black text-slate-700 mt-0.5">
                {formatCurrency(balance)}
              </div>
            </div>
          </div>

          {/* Progress Bar with markers */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
              <span className="text-slate-600">Payment Clearance</span>
              <span className="text-slate-900 font-bold">{paidPercent}% Collected</span>
            </div>
            <div className="relative w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
              <div
                className={`h-full transition-all duration-500 ${
                  paid >= total
                    ? 'bg-emerald-500'
                    : isAdvanceSatisfied
                    ? 'bg-indigo-500'
                    : 'bg-amber-500'
                }`}
                style={{ width: `${paidPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 mt-1.5 font-medium">
              <span>₹0</span>
              <span className="text-amber-700 font-bold">
                ▲ 30% Advance ({formatCurrency(advanceReq)})
              </span>
              <span>Total ({formatCurrency(total)})</span>
            </div>
          </div>

          {/* Payment History */}
          <div className="pt-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
              <span>Payment Receipts ({order.payments?.length || 0})</span>
              <button
                onClick={() => {
                  setPaymentAmount(balance > 0 ? balance : 10000);
                  setPaymentType(balance <= 0 ? 'FULL' : 'BALANCE');
                  setIsPaymentModalOpen(true);
                }}
                className="text-amber-600 hover:text-amber-700 font-semibold text-xs"
              >
                + Record Payment
              </button>
            </div>

            {(!order.payments || order.payments.length === 0) ? (
              <div className="p-4 rounded-xl bg-slate-50 text-center text-xs text-slate-400">
                No payments recorded yet. Click &quot;Record Advance Payment&quot; above.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] uppercase font-bold text-slate-400 bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 rounded-l-lg">Date</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Mode</th>
                      <th className="px-3 py-2">Reference</th>
                      <th className="px-3 py-2 text-right rounded-r-lg">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {order.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="px-3 py-2 text-slate-600">{formatDate(p.paid_at)}</td>
                        <td className="px-3 py-2 font-bold text-slate-800">{p.type}</td>
                        <td className="px-3 py-2 text-slate-600">{p.mode}</td>
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-500">
                          {p.reference || '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-extrabold text-emerald-700">
                          {formatCurrency(p.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Customer & Lead Info */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-slate-100 text-slate-700 rounded-lg">
              <User className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-bold text-slate-900">Customer & Site</h2>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Customer Name</div>
              <div className="font-bold text-slate-800 text-sm">
                {order.lead?.customer_name || 'Walk-in'}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-400 font-medium">Contact Phone</div>
              <div className="font-semibold text-slate-700">
                {order.lead?.phone || '—'}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-400 font-medium">Installation Address</div>
              <div className="text-slate-700">
                {order.lead?.address || 'Site Address'}
                {order.lead?.city && `, ${order.lead.city}`}
                {order.lead?.pincode && ` - ${order.lead.pincode}`}
              </div>
            </div>

            {order.lead_id && (
              <div className="pt-2 border-t border-slate-100">
                <Link
                  to={`/leads/${order.lead_id}`}
                  className="text-amber-600 hover:text-amber-700 font-bold inline-flex items-center gap-1"
                >
                  View Lead Dossier →
                </Link>
              </div>
            )}
          </div>

          {/* Installation Job Assignment Box */}
          <div className="pt-4 border-t border-slate-100">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
              <span>Installation Job</span>
              <Link to="/jobs" className="text-indigo-600 hover:underline text-[11px]">
                Crew Schedule
              </Link>
            </div>
            {order.job ? (
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-900">Job #{order.job.id}</span>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${order.job.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-200 text-indigo-800'}`}>
                    {order.job.status}
                  </span>
                </div>
                <div className="text-slate-600">
                  <strong>Scheduled:</strong> {formatDate(order.job.scheduled_date)}
                </div>
                <div className="text-slate-600">
                  <strong>Lead Tech:</strong> {order.job.crew_lead_name || 'Unassigned'}
                </div>
                {order.job.status !== 'COMPLETED' && (
                  <button
                    onClick={handleCompleteInstallation}
                    disabled={completeInstallLoading}
                    className="w-full mt-2 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-xs transition"
                  >
                    {completeInstallLoading ? 'Completing...' : 'Mark Installation Done ✓'}
                  </button>
                )}
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
                Job will be automatically created once 30% advance is recorded.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pick List & Warehouse Scanning Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <Layers className="w-4 h-4" />
              </span>
              <h2 className="text-sm font-bold text-slate-900">
                Warehouse Pick List & Serial Scan
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Every inverter, battery and charge controller must be physically scanned before dispatch.
            </p>
          </div>

          {order.status === ORDER_STATUS.CONFIRMED && (
            <Link
              to={`/orders/${order.id}/scan`}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
            >
              <QrCode className="w-4 h-4" />
              <span>Launch Barcode Scanner →</span>
            </Link>
          )}
        </div>

        {/* Pick list items table */}
        {pickListItems.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
            Pick list is generated automatically when the order moves to CONFIRMED.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Tracking</th>
                  <th className="px-4 py-3 text-center">Required</th>
                  <th className="px-4 py-3 text-center">Scanned</th>
                  <th className="px-4 py-3">Progress</th>
                  <th className="px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pickListItems.map((item) => {
                  const req = item.qty_required || 0;
                  const scan = item.qty_scanned || 0;
                  const isDone = scan >= req;
                  const pct = req > 0 ? Math.min(100, Math.round((scan / req) * 100)) : 100;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3.5 font-bold text-slate-900">
                        {item.product?.name || `Product #${item.product_id}`}
                        <div className="text-[11px] text-slate-400 font-mono font-normal">
                          {item.product?.sku}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {item.product?.category || '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.product?.is_serialized !== false
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {item.product?.is_serialized !== false
                            ? 'Serialized (1-by-1)'
                            : 'Bulk Quantity'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-slate-700">
                        {req}
                      </td>
                      <td className="px-4 py-3.5 text-center font-extrabold text-indigo-600">
                        {scan}
                      </td>
                      <td className="px-4 py-3.5 min-w-[140px]">
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                          <div
                            className={`h-full ${
                              isDone ? 'bg-emerald-500' : 'bg-indigo-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {isDone ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-bold bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 text-[11px]">
                            <Clock className="w-3.5 h-3.5" /> Needs {req - scan} more
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Scanned Serials List */}
        {order.scanned_serials && order.scanned_serials.length > 0 && (
          <div className="pt-3 border-t border-slate-100">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Reserved Physical Serials ({order.scanned_serials.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {order.scanned_serials.map((s) => (
                <span
                  key={s.id || s.serial_number}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 font-mono text-xs text-slate-800"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <strong>{s.serial_number}</strong>
                  <span className="text-[10px] text-slate-400">({s.status})</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dispatch Details Section (when dispatched or delivered) */}
      {order.dispatch && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
              <Truck className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-bold text-slate-900">
              Logistics & Dispatch Information
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-purple-50/50 border border-purple-100 text-xs">
            <div>
              <div className="text-slate-400 font-medium">Vehicle Number</div>
              <div className="font-black text-slate-900 text-sm mt-0.5">
                {order.dispatch.vehicle_no}
              </div>
            </div>
            <div>
              <div className="text-slate-400 font-medium">Driver Name</div>
              <div className="font-black text-slate-900 text-sm mt-0.5">
                {order.dispatch.driver_name}
              </div>
            </div>
            <div>
              <div className="text-slate-400 font-medium">Dispatched At</div>
              <div className="font-semibold text-slate-700 mt-0.5">
                {formatDateTime(order.dispatch.dispatched_at)}
              </div>
            </div>
            <div>
              <div className="text-slate-400 font-medium">Delivery Status</div>
              <div className="font-semibold text-slate-700 mt-0.5">
                {order.dispatch.delivered_at
                  ? `Delivered on ${formatDate(order.dispatch.delivered_at)}`
                  : 'In Transit to Site'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Warranty Table (B7) - Active upon Delivery */}
      {order.warranties && order.warranties.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                  <ShieldCheck className="w-4 h-4" />
                </span>
                <h2 className="text-sm font-bold text-slate-900">
                  Active Warranties by Serial Number
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Activated automatically upon delivery confirmation. 24 months for inverters/batteries, 240 months for panels.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              {order.warranties.length} Warranties Active
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-4 py-3">Serial Number</th>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Coverage</th>
                  <th className="px-4 py-3">Start Date</th>
                  <th className="px-4 py-3">End Date</th>
                  <th className="px-4 py-3 text-right">Days Left</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.warranties.map((w) => {
                  const end = new Date(w.end_date);
                  const now = new Date();
                  const diffTime = end - now;
                  const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

                  return (
                    <tr key={w.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                        {w.serial_number}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-800">
                        {w.product_name || 'Solar Equipment'}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {w.category || '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-bold text-slate-900">
                          {w.months} Months
                        </span>{' '}
                        <span className="text-[11px] text-slate-400">
                          ({(w.months / 12).toFixed(0)} yrs)
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {formatDate(w.start_date)}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-800">
                        {formatDate(w.end_date)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          {diffDays.toLocaleString()} days
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment Modal (B3) */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Record Customer Payment"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          {paymentSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold">
              {paymentSuccessMsg}
            </div>
          )}

          {paymentError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
              {paymentError}
            </div>
          )}

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
            <strong>Order #{order.order_number}</strong> • Total:{' '}
            {formatCurrency(total)} • Due: {formatCurrency(balance)}
            <div className="text-[11px] text-amber-700 mt-0.5">
              Advance required for confirmation: {formatCurrency(advanceReq)} (30%)
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Payment Amount (₹) *
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="e.g. 100000"
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Payment Type
              </label>
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {PAYMENT_TYPES.map((pt) => (
                  <option key={pt.value} value={pt.value}>
                    {pt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Payment Mode
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {PAYMENT_MODES.map((pm) => (
                  <option key={pm.value} value={pm.value}>
                    {pm.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Transaction Reference / UTR Number
            </label>
            <input
              type="text"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              placeholder="e.g. UPI-9283749823 or HDFC-UTR-891"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={paymentLoading}
              className="px-4 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl shadow-xs transition"
            >
              {paymentLoading ? 'Recording...' : 'Confirm Payment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Dispatch Truck Modal (B6) */}
      <Modal
        isOpen={isDispatchModalOpen}
        onClose={() => setIsDispatchModalOpen(false)}
        title="Dispatch Delivery Vehicle"
      >
        <form onSubmit={handleDispatch} className="space-y-4">
          {dispatchError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
              {dispatchError}
            </div>
          )}

          <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs text-purple-900">
            Dispatching order <strong>{order.order_number}</strong> to{' '}
            {order.lead?.customer_name} ({order.lead?.city}).
            <div className="text-[11px] text-purple-700 mt-1">
              Bulk items will be decremented from inventory ledger and all scanned serials will move to DISPATCHED status.
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Vehicle Number *
            </label>
            <input
              type="text"
              required
              value={vehicleNo}
              onChange={(e) => setVehicleNo(e.target.value)}
              placeholder="e.g. MH 12 AB 4589"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Driver Name *
            </label>
            <input
              type="text"
              required
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              placeholder="e.g. Suresh Shinde"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsDispatchModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={dispatchLoading}
              className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs transition"
            >
              {dispatchLoading ? 'Dispatching...' : 'Confirm Dispatch'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
