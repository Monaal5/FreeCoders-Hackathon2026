// Installation jobs – the office side: the crew schedule (list) and assigning the crew lead + date.
// A job is created automatically when an order (with installation) is confirmed (Phase 2).
// Everything that happens ON the roof (start, checklist, photos, serials, completion) lives in
// installation.service.js (Phase 3).
const { query, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const { canAccessLead, isScopedStaff } = require('../utils/access');

/** Admin: every job. Staff: jobs of their own leads. Technician: jobs where they are crew lead or crew. */
async function listJobs({ from, to }, user) {
  const { rows } = await query(
    `SELECT j.id, j.order_id, j.status, j.scheduled_date, j.crew_lead_id, u.name AS crew_lead_name, j.notes,
            j.started_at, j.completed_at,
            o.order_number, o.status AS order_status,
            l.id AS lead_id, l.lead_code, l.customer_name, l.phone, l.address, l.city, l.pincode,
            q.capacity_kw, q.package_kind,
            (SELECT count(*) FROM job_crew c WHERE c.job_id = j.id) AS crew_size
       FROM installation_jobs j
       JOIN orders o ON o.id = j.order_id
       JOIN leads l  ON l.id = o.lead_id
       JOIN quotes q ON q.id = o.quote_id
       LEFT JOIN users u ON u.id = j.crew_lead_id
      WHERE ($1::date IS NULL OR j.scheduled_date >= $1)
        AND ($2::date IS NULL OR j.scheduled_date <= $2)
        AND ($3::bigint IS NULL OR l.assigned_to = $3)
        AND ($4::bigint IS NULL OR j.crew_lead_id = $4
             OR EXISTS (SELECT 1 FROM job_crew c WHERE c.job_id = j.id AND c.technician_id = $4))
      ORDER BY j.scheduled_date NULLS LAST, j.id`,
    [from, to, isScopedStaff(user) ? user.id : null, user.role === 'TECHNICIAN' ? user.id : null],
  );
  return rows;
}

/** Assign crew lead + date. Crew lead must be an active technician; the lead is always on the crew. */
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
    if (job.status === 'COMPLETED') throw AppError.conflict('This installation is already completed', 'JOB_ALREADY_COMPLETED');

    const tech = await client.query(`SELECT id, name FROM users WHERE id = $1 AND role = 'TECHNICIAN' AND is_active`, [crewLeadId]);
    if (!tech.rows.length) throw AppError.badRequest('crewLeadId must be an active technician', { field: 'crewLeadId' });

    const upd = await client.query(
      `UPDATE installation_jobs SET crew_lead_id = $2, scheduled_date = $3, notes = COALESCE($4, notes)
        WHERE id = $1 RETURNING *`,
      [job.id, crewLeadId, scheduledDate, notes],
    );
    await client.query(`INSERT INTO job_crew (job_id, technician_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [job.id, crewLeadId]);
    await client.query(
      `INSERT INTO lead_activities (lead_id, actor_id, type, note) VALUES ($1, $2, 'NOTE', $3)`,
      [job.lead_id, actor.id, `Installation for order ${job.order_number} assigned to ${tech.rows[0].name} on ${scheduledDate}`],
    );
    return { ...upd.rows[0], crew_lead_name: tech.rows[0].name };
  });
}

module.exports = { listJobs, assignJob };
