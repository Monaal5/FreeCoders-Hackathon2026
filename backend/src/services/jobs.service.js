// Phase 2 – installation jobs: the crew schedule. A job is created automatically when an order
// (with installation) is confirmed; staff assign the crew lead (a technician) and the date.
const { query, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const { canAccessLead, isScopedStaff } = require('../utils/access');
const { ORDER_STATUS: O, assertOrderStatus, transitionOrder } = require('../utils/orderStatus');

/** Admin: every job. Staff: jobs of their own leads. Technician: jobs where they are crew lead. */
async function listJobs({ from, to }, user) {
  const { rows } = await query(
    `SELECT j.id, j.order_id, j.status, j.scheduled_date, j.crew_lead_id, u.name AS crew_lead_name, j.notes, j.completed_at,
            o.order_number, o.status AS order_status,
            l.id AS lead_id, l.lead_code, l.customer_name, l.phone, l.address, l.city, l.pincode,
            q.capacity_kw, q.package_kind
       FROM installation_jobs j
       JOIN orders o ON o.id = j.order_id
       JOIN leads l  ON l.id = o.lead_id
       JOIN quotes q ON q.id = o.quote_id
       LEFT JOIN users u ON u.id = j.crew_lead_id
      WHERE ($1::date IS NULL OR j.scheduled_date >= $1)
        AND ($2::date IS NULL OR j.scheduled_date <= $2)
        AND ($3::bigint IS NULL OR l.assigned_to = $3)
        AND ($4::bigint IS NULL OR j.crew_lead_id = $4)
      ORDER BY j.scheduled_date NULLS LAST, j.id`,
    [from, to, isScopedStaff(user) ? user.id : null, user.role === 'TECHNICIAN' ? user.id : null],
  );
  return rows;
}

/** Assign crew lead + date. Crew lead must be an active technician; date not in the past. */
async function assignJob(jobId, { crewLeadId, scheduledDate, notes }, actor) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT j.*, l.assigned_to, l.id AS lead_id, o.order_number
         FROM installation_jobs j JOIN orders o ON o.id = j.order_id JOIN leads l ON l.id = o.lead_id
        WHERE j.id = $1 FOR UPDATE OF j`,
      [jobId],
    );
    if (!rows.length || !canAccessLead(actor, rows[0])) throw AppError.notFound('Job');
    const job = rows[0];

    const tech = await client.query(`SELECT id, name FROM users WHERE id = $1 AND role = 'TECHNICIAN' AND is_active`, [crewLeadId]);
    if (!tech.rows.length) throw AppError.badRequest('crewLeadId must be an active technician', { field: 'crewLeadId' });

    const upd = await client.query(
      `UPDATE installation_jobs SET crew_lead_id = $2, scheduled_date = $3, notes = COALESCE($4, notes)
        WHERE id = $1 RETURNING *`,
      [job.id, crewLeadId, scheduledDate, notes],
    );
    await client.query(
      `INSERT INTO lead_activities (lead_id, actor_id, type, note) VALUES ($1, $2, 'NOTE', $3)`,
      [job.lead_id, actor.id, `Installation for order ${job.order_number} assigned to ${tech.rows[0].name} on ${scheduledDate}`],
    );
    return { ...upd.rows[0], crew_lead_name: tech.rows[0].name };
  });
}

/**
 * Complete an installation job (crew lead on site, or office staff/admin).
 * Rules, all in ONE transaction with the job and order rows locked:
 *   - technician: only the job's crew lead; staff: only jobs of their own leads (else 404)
 *   - the order must be DELIVERED (installation follows delivery) -> else 409
 *   - a job is completed once -> 409 JOB_ALREADY_COMPLETED
 *   - order DELIVERED -> INSTALLED through the order state machine;
 *     only DELIVERED serials of this order become INSTALLED
 * The job statuses themselves come from migrations/003_job_completion.sql (no schema changes here).
 */
async function completeJob(jobId, { remarks }, actor) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT j.*, l.assigned_to, l.id AS lead_id,
              o.order_number, o.status AS order_status
         FROM installation_jobs j
         JOIN orders o ON o.id = j.order_id
         JOIN leads l  ON l.id = o.lead_id
        WHERE j.id = $1
        FOR UPDATE OF j, o`,
      [jobId],
    );
    const job = rows[0];
    const visible =
      job &&
      (actor.role === 'TECHNICIAN' ? Number(job.crew_lead_id) === Number(actor.id) : canAccessLead(actor, job));
    if (!visible) throw AppError.notFound('Job');

    if (job.status === 'COMPLETED') {
      throw AppError.conflict(`Installation for order ${job.order_number} is already completed`, 'JOB_ALREADY_COMPLETED');
    }
    const order = { id: job.order_id, order_number: job.order_number, status: job.order_status };
    assertOrderStatus(order, [O.DELIVERED], 'complete the installation');

    const upd = await client.query(
      `UPDATE installation_jobs
          SET status = 'COMPLETED', completed_at = now(), completed_by = $3, notes = COALESCE($2, notes)
        WHERE id = $1
        RETURNING *`,
      [job.id, remarks, actor.id],
    );
    const installed = await client.query(
      `UPDATE inventory_items SET status = 'INSTALLED' WHERE order_id = $1 AND status = 'DELIVERED'`,
      [job.order_id],
    );
    await transitionOrder(client, order, O.INSTALLED);
    await client.query(
      `INSERT INTO lead_activities (lead_id, actor_id, type, note) VALUES ($1, $2, 'NOTE', $3)`,
      [
        job.lead_id,
        actor.id,
        `Installation for order ${job.order_number} COMPLETED by ${actor.name}: ${installed.rowCount} units installed${remarks ? `. ${remarks}` : ''}`,
      ],
    );
    return { ...upd.rows[0], order_number: job.order_number, order_status: O.INSTALLED, units_installed: installed.rowCount };
  });
}

module.exports = { listJobs, assignJob, completeJob };
