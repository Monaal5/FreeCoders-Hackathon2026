// Lead state machine – the ONLY place that decides which status moves are legal.
//
// NEW -> QUALIFIED -> SURVEY_SCHEDULED -> SURVEY_SUBMITTED -> SURVEY_APPROVED -> QUOTED -> WON
//                                               └─ survey rejected -> back to QUALIFIED
// any open status -> LOST
const AppError = require('./AppError');

const LEAD_STATUS = Object.freeze({
  NEW: 'NEW',
  QUALIFIED: 'QUALIFIED',
  SURVEY_SCHEDULED: 'SURVEY_SCHEDULED',
  SURVEY_SUBMITTED: 'SURVEY_SUBMITTED',
  SURVEY_APPROVED: 'SURVEY_APPROVED',
  QUOTED: 'QUOTED',
  WON: 'WON',
  LOST: 'LOST',
});
const S = LEAD_STATUS;

const TRANSITIONS = Object.freeze({
  [S.NEW]: [S.QUALIFIED, S.LOST],
  [S.QUALIFIED]: [S.SURVEY_SCHEDULED, S.LOST],
  [S.SURVEY_SCHEDULED]: [S.SURVEY_SUBMITTED, S.LOST],
  [S.SURVEY_SUBMITTED]: [S.SURVEY_APPROVED, S.QUALIFIED, S.LOST], // -> QUALIFIED = survey rejected
  [S.SURVEY_APPROVED]: [S.QUOTED, S.LOST],
  [S.QUOTED]: [S.WON, S.LOST],
  [S.WON]: [],
  [S.LOST]: [],
});

const ALL_STATUSES = Object.freeze(Object.keys(TRANSITIONS));
const OPEN_STATUSES = Object.freeze(ALL_STATUSES.filter((s) => s !== S.WON && s !== S.LOST));

const canTransition = (from, to) => (TRANSITIONS[from] || []).includes(to);

/**
 * Moves a lead to `toStatus` and writes the timeline entry – atomically.
 * MUST be called with the client from withTransaction(): the row is locked (FOR UPDATE)
 * so two people clicking at the same moment cannot both move the lead.
 * Throws 404 if the lead is missing, 409 INVALID_STATUS_TRANSITION if the move is illegal.
 */
async function transitionLead(client, leadId, toStatus, actorId, note = null) {
  const { rows } = await client.query('SELECT id, status FROM leads WHERE id = $1 FOR UPDATE', [leadId]);
  if (!rows.length) throw AppError.notFound('Lead');

  const from = rows[0].status;
  if (!canTransition(from, toStatus)) {
    throw AppError.conflict(`Cannot move lead from ${from} to ${toStatus}`, 'INVALID_STATUS_TRANSITION', {
      from,
      to: toStatus,
      allowed: TRANSITIONS[from],
    });
  }

  const updated = await client.query('UPDATE leads SET status = $2 WHERE id = $1 RETURNING *', [leadId, toStatus]);
  await client.query(
    `INSERT INTO lead_activities (lead_id, actor_id, type, from_status, to_status, note)
     VALUES ($1, $2, 'STATUS_CHANGE', $3, $4, $5)`,
    [leadId, actorId ?? null, from, toStatus, note],
  );
  return updated.rows[0];
}

/** Guard for work that depends on status without moving it (e.g. revising a quote). */
function assertStatus(lead, allowed, action) {
  if (!allowed.includes(lead.status)) {
    throw AppError.conflict(
      `Cannot ${action}: lead is ${lead.status} (needs ${allowed.join(' or ')})`,
      'INVALID_STATUS_TRANSITION',
      { current: lead.status, required: allowed },
    );
  }
}

module.exports = { LEAD_STATUS, TRANSITIONS, ALL_STATUSES, OPEN_STATUSES, canTransition, transitionLead, assertStatus };
