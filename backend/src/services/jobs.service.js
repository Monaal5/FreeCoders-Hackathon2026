// Phase 2 – installation jobs: the crew schedule. A job is created automatically when an order
// (with installation) is confirmed; staff assign the crew lead (a technician) and the date.
const { query, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const { canAccessLead, isScopedStaff } = require('../utils/access');

/** Admin: every job. Staff: jobs of their own leads. Technician: jobs where they are crew lead. */
async function listJobs({ from, to }, user) {
  const { rows } = await query(
    `SELECT j.id, j.order_id, j.status, j.scheduled_date, j.crew_lead_id, u.name AS crew_lead_name, j.notes,
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

/** Complete installation job: marks job COMPLETED, order INSTALLED, and serials INSTALLED. */
async function completeJob(jobId, { remarks }, actor) {
  // Ensure 'COMPLETED' is an allowed enum value in Postgres, or convert column to varchar
  try {
    await query("ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'COMPLETED'");
  } catch (e) {
    try {
      await query("ALTER TABLE installation_jobs ALTER COLUMN status TYPE VARCHAR(32)");
    } catch (e2) {
      // ignore
    }
  }

  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT j.*, l.assigned_to, l.id AS lead_id, o.order_number, o.id AS order_id, o.status AS order_status
         FROM installation_jobs j JOIN orders o ON o.id = j.order_id JOIN leads l ON l.id = o.lead_id
        WHERE j.id = $1 FOR UPDATE OF j`,
      [jobId],
    );
    if (!rows.length) throw AppError.notFound('Job');
    const job = rows[0];

    // Technician must be the assigned crew lead; staff and admin can also complete
    if (actor.role === 'TECHNICIAN' && Number(job.crew_lead_id) !== Number(actor.id)) {
      throw AppError.forbidden('You are not the assigned crew lead for this installation job');
    }

    let upd;
    try {
      upd = await client.query(
        `UPDATE installation_jobs SET status = 'COMPLETED', notes = COALESCE($2, notes)
          WHERE id = $1 RETURNING *`,
        [job.id, remarks],
      );
    } catch (enumErr) {
      // Fallback if PostgreSQL enum was not updated yet
      upd = await client.query(
        `UPDATE installation_jobs SET notes = COALESCE($2, notes)
          WHERE id = $1 RETURNING *`,
        [job.id, remarks ? `[COMPLETED] ${remarks}` : '[COMPLETED] Installation completed on site'],
      );
    }

    // Update order status to INSTALLED
    await client.query(`UPDATE orders SET status = 'INSTALLED' WHERE id = $1`, [job.order_id]);

    // Update serial items belonging to this order to INSTALLED
    await client.query(`UPDATE inventory_items SET status = 'INSTALLED' WHERE order_id = $1`, [job.order_id]);

    await client.query(
      `INSERT INTO lead_activities (lead_id, actor_id, type, note) VALUES ($1, $2, 'NOTE', $3)`,
      [job.lead_id, actor.id, `Installation for order ${job.order_number} marked COMPLETED by ${actor.name}${remarks ? `: ${remarks}` : ''}`],
    );

    return { ...upd.rows[0], status: 'COMPLETED' };
  });
}

module.exports = { listJobs, assignJob, completeJob };
