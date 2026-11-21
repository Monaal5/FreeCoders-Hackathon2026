// Phase 2 Order & Serial State Machines
// Order: PENDING_PAYMENT -> CONFIRMED -> DISPATCHED -> DELIVERED -> INSTALLED
// Serial: IN_STOCK -> RESERVED -> DISPATCHED -> DELIVERED -> INSTALLED

export const ORDER_STATUS = {
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  CONFIRMED: 'CONFIRMED',
  DISPATCHED: 'DISPATCHED',
  DELIVERED: 'DELIVERED',
  INSTALLED: 'INSTALLED',
};

export const SERIAL_STATUS = {
  IN_STOCK: 'IN_STOCK',
  RESERVED: 'RESERVED',
  DISPATCHED: 'DISPATCHED',
  DELIVERED: 'DELIVERED',
  INSTALLED: 'INSTALLED',
};

export const ORDER_STATUS_CONFIG = {
  [ORDER_STATUS.PENDING_PAYMENT]: {
    label: 'Pending Advance',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    description: 'Awaiting minimum 30% advance payment',
  },
  [ORDER_STATUS.CONFIRMED]: {
    label: 'Order Confirmed',
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    dot: 'bg-indigo-500',
    description: 'Advance received. Pick list & installation job active.',
  },
  [ORDER_STATUS.DISPATCHED]: {
    label: 'Dispatched',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    dot: 'bg-purple-500',
    description: 'Materials scanned & loaded on delivery vehicle',
  },
  [ORDER_STATUS.DELIVERED]: {
    label: 'Delivered',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    description: 'Site delivery confirmed. Warranties activated.',
  },
  [ORDER_STATUS.INSTALLED]: {
    label: 'Installed',
    color: 'bg-green-100 text-green-800 border-green-300',
    dot: 'bg-green-600',
    description: 'Commissioning & net metering complete',
  },
};

export const PAYMENT_MODES = [
  { value: 'UPI', label: 'UPI / QR Transfer' },
  { value: 'BANK', label: 'NEFT / RTGS / Net Banking' },
  { value: 'CASH', label: 'Cash Payment' },
  { value: 'CHEQUE', label: 'Cheque / Demand Draft' },
];

export const PAYMENT_TYPES = [
  { value: 'ADVANCE', label: 'Advance Payment' },
  { value: 'BALANCE', label: 'Balance Payment' },
  { value: 'FULL', label: 'Full Settlement' },
];
