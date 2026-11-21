// Lead ownership rules – the ONE place that decides who may see or touch a lead.
//
//   ADMIN       -> every lead
//   STAFF       -> only leads assigned to them. Anyone else's lead behaves as if it does not
//                  exist (404), so a staff member cannot even confirm another customer exists.
//   TECHNICIAN  -> never reaches lead routes (blocked by authorize); survey access is checked
//                  separately (only their own assigned surveys).
const AppError = require('./AppError');

const isScopedStaff = (user) => user?.role === 'STAFF';

/** True when `user` may access a lead row that has `assigned_to`. */
const canAccessLead = (user, lead) => !isScopedStaff(user) || Number(lead.assigned_to) === Number(user.id);

/**
 * Loads a lead (optionally locking it FOR UPDATE inside a transaction) and enforces ownership.
 * `db` is a pool-like object or the transaction client. Throws 404 for missing OR not-yours.
 */
async function assertLeadAccess(db, leadId, user, { lock = false } = {}) {
  const { rows } = await db.query(
    `SELECT id, status, assigned_to, customer_name FROM leads WHERE id = $1${lock ? ' FOR UPDATE' : ''}`,
    [leadId],
  );
  if (!rows.length || !canAccessLead(user, rows[0])) throw AppError.notFound('Lead');
  return rows[0];
}

/** Value to force into list filters: staff only ever query their own leads. */
const scopedAssignee = (user, requested) => (isScopedStaff(user) ? user.id : requested);

module.exports = { isScopedStaff, canAccessLead, assertLeadAccess, scopedAssignee };
