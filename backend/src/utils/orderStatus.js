// Order and serial state machines (Phase 2). Like leadStatus.js, the ONLY place deciding legal moves.
//
// order:  PENDING_PAYMENT -> CONFIRMED -> DISPATCHED -> DELIVERED (-> INSTALLED, Phase 3)
//          (advance paid)   (all serials scanned)    (warranty starts)
// serial: IN_STOCK -> RESERVED (scanned) -> DISPATCHED -> DELIVERED (-> INSTALLED)
//                   <- (undo scan)
const AppError = require('./AppError');

const ORDER_STATUS = Object.freeze({
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  CONFIRMED: 'CONFIRMED',
  DISPATCHED: 'DISPATCHED',
  DELIVERED: 'DELIVERED',
  INSTALLED: 'INSTALLED',
});
const O = ORDER_STATUS;

const ORDER_TRANSITIONS = Object.freeze({
  [O.PENDING_PAYMENT]: [O.CONFIRMED],
  [O.CONFIRMED]: [O.DISPATCHED],
  [O.DISPATCHED]: [O.DELIVERED],
  [O.DELIVERED]: [O.INSTALLED],
  [O.INSTALLED]: [],
});

const SERIAL_STATUS = Object.freeze({
  IN_STOCK: 'IN_STOCK',
  RESERVED: 'RESERVED',
  DISPATCHED: 'DISPATCHED',
  DELIVERED: 'DELIVERED',
  INSTALLED: 'INSTALLED',
});

/** Throws 409 unless the order is in one of `allowed` (used before work that depends on status). */
function assertOrderStatus(order, allowed, action) {
  if (!allowed.includes(order.status)) {
    throw AppError.conflict(
      `Cannot ${action}: order ${order.order_number} is ${order.status} (needs ${allowed.join(' or ')})`,
      'INVALID_ORDER_STATUS',
      { current: order.status, required: allowed },
    );
  }
}

/** Moves an order (row must already be locked FOR UPDATE by the caller's transaction). */
async function transitionOrder(client, order, toStatus) {
  if (!(ORDER_TRANSITIONS[order.status] || []).includes(toStatus)) {
    throw AppError.conflict(`Cannot move order from ${order.status} to ${toStatus}`, 'INVALID_ORDER_STATUS', {
      from: order.status,
      to: toStatus,
      allowed: ORDER_TRANSITIONS[order.status],
    });
  }
  const { rows } = await client.query(
    `UPDATE orders SET status = $2::order_status,
            confirmed_at = CASE WHEN $2::order_status = 'CONFIRMED' THEN now() ELSE confirmed_at END
      WHERE id = $1 RETURNING *`,
    [order.id, toStatus],
  );
  return rows[0];
}

module.exports = { ORDER_STATUS, ORDER_TRANSITIONS, SERIAL_STATUS, assertOrderStatus, transitionOrder };
