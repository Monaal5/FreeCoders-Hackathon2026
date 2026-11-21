const { query, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const { LEAD_STATUS, OPEN_STATUSES, transitionLead } = require('../utils/leadStatus');
const { suggestKw } = require('../utils/sizing');
const { assertLeadAccess, canAccessLead } = require('../utils/access');

// Arbitrary constant for pg_advisory_xact_lock: serialises auto-assignment so two
// simultaneous enquiries cannot both pick the same "least busy" staff member.
const ASSIGN_LOCK_KEY = 424201;

/** Active STAFF member with the fewest open leads (ties -> lowest id). Must run inside a transaction. */
async function pickLeastBusyStaff(client) {
  await client.query('SELECT pg_advisory_xact_lock($1)', [ASSIGN_LOCK_KEY]);
  const { rows } = await client.query(
    `SELECT u.id, u.name, count(l.id)::int AS open_leads
       FROM users u
       LEFT JOIN leads l ON l.assigned_to = u.id AND l.status = ANY($1::lead_status[])
      WHERE u.role = 'STAFF' AND u.is_active
      GROUP BY u.id
      ORDER BY open_leads ASC, u.id ASC
      LIMIT 1`,
    [OPEN_STATUSES],
  );
  return rows[0] || null; // null if no staff exist – lead stays unassigned
}

async function findOpenLeadByPhone(client, phone) {
  const { rows } = await client.query(
    `SELECT id, lead_code, status, assigned_to FROM leads
      WHERE phone = $1 AND status = ANY($2::lead_status[])
      ORDER BY created_at DESC LIMIT 1`,
    [phone, OPEN_STATUSES],
  );
  return rows[0] || null;
}

async function insertLead(client, input, { source, assignedTo, createdBy }) {
  const { rows } = await client.query(
    `INSERT INTO leads (customer_name, phone, email, address, city, state, pincode, property_type,
                        monthly_bill, roof_type, roof_area_sqft, message, source, assigned_to, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING *`,
    [
      input.customerName, input.phone, input.email, input.address, input.city, input.state, input.pincode,
      input.propertyType, input.monthlyBill, input.roofType, input.roofAreaSqft, input.message,
      source, assignedTo, createdBy,
    ],
  );
  return rows[0];
}

async function logActivity(client, leadId, actorId, type, note, toStatus = null) {
  await client.query(
    `INSERT INTO lead_activities (lead_id, actor_id, type, to_status, note) VALUES ($1, $2, $3, $4, $5)`,
    [leadId, actorId, type, toStatus, note],
  );
}

/**
 * Public website enquiry. Auto-assigns to the least-busy staff member.
 * If the same phone already has an OPEN lead we don't create a duplicate – we add a note to it.
 */
async function createEnquiry(input) {
  return withTransaction(async (client) => {
    const existing = await findOpenLeadByPhone(client, input.phone);
    if (existing) {
      await logActivity(client, existing.id, null, 'NOTE', `Repeat website enquiry: ${input.message || '(no message)'}`);
      const owner = await client.query(
        'SELECT u.name FROM leads l LEFT JOIN users u ON u.id = l.assigned_to WHERE l.id = $1',
        [existing.id],
      );
      return { leadCode: existing.lead_code, assignedToName: owner.rows[0]?.name ?? null, duplicate: true };
    }

    const staff = await pickLeastBusyStaff(client);
    const lead = await insertLead(client, input, { source: 'WEBSITE', assignedTo: staff?.id ?? null, createdBy: null });
    await logActivity(client, lead.id, null, 'CREATED', 'Website enquiry received', LEAD_STATUS.NEW);
    if (staff) await logActivity(client, lead.id, null, 'ASSIGNED', `Auto-assigned to ${staff.name}`);
    return { leadCode: lead.lead_code, assignedToName: staff?.name ?? null, duplicate: false };
  });
}

/** Manual entry by staff/admin (phone call, WhatsApp, walk-in...). */
async function createManualLead(input, { source, assignedTo, force }, actor) {
  return withTransaction(async (client) => {
    if (!force) {
      const existing = await findOpenLeadByPhone(client, input.phone);
      if (existing) {
        // Only reveal which lead it is if the caller is allowed to open it
        if (canAccessLead(actor, existing)) {
          throw AppError.conflict(`An open lead (${existing.lead_code}) already exists for this phone`, 'DUPLICATE_LEAD', {
            existingLeadId: existing.id,
            leadCode: existing.lead_code,
            hint: 'Send "force": true to create anyway',
          });
        }
        throw AppError.conflict(
          'This customer is already being handled by another team member. Ask an admin to reassign the lead.',
          'DUPLICATE_LEAD',
        );
      }
    }

    let assignee = null;
    if (assignedTo) {
      const { rows } = await client.query(
        `SELECT id, name FROM users WHERE id = $1 AND is_active AND role IN ('STAFF', 'ADMIN')`,
        [assignedTo],
      );
      if (!rows.length) throw AppError.badRequest('assignedTo must be an active staff/admin user', { field: 'assignedTo' });
      assignee = rows[0];
    } else if (actor.role === 'STAFF') {
      assignee = { id: actor.id, name: actor.name };
    } else {
      assignee = await pickLeastBusyStaff(client);
    }

    const lead = await insertLead(client, input, { source, assignedTo: assignee?.id ?? null, createdBy: actor.id });
    await logActivity(client, lead.id, actor.id, 'CREATED', `Lead created manually (${source})`, LEAD_STATUS.NEW);
    if (assignee) await logActivity(client, lead.id, actor.id, 'ASSIGNED', `Assigned to ${assignee.name}`);
    return lead;
  });
}

/** Inbox list with filters, search and pagination + per-status counts for the tabs. */
async function listLeads({ statuses, q, assignedTo, source, page, limit, scopeAssignee = null }) {
  const search = q ? `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null; // escape LIKE wildcards
  const offset = (page - 1) * limit;

  const [list, counts] = await Promise.all([
    query(
      `SELECT l.id, l.lead_code, l.customer_name, l.phone, l.email, l.city, l.property_type, l.monthly_bill,
              l.source, l.status, l.suggested_kw, l.assigned_to, u.name AS assigned_to_name,
              l.created_at, l.updated_at,
              count(*) OVER () AS total_count
         FROM leads l
         LEFT JOIN users u ON u.id = l.assigned_to
        WHERE ($1::lead_status[] IS NULL OR l.status = ANY($1))
          AND ($2::text IS NULL OR l.customer_name ILIKE $2 OR l.phone LIKE $2 OR l.email ILIKE $2
               OR l.city ILIKE $2 OR l.lead_code ILIKE $2)
          AND ($3::bigint IS NULL OR l.assigned_to = $3)
          AND ($4::lead_source IS NULL OR l.source = $4)
        ORDER BY l.created_at DESC
        LIMIT $5 OFFSET $6`,
      [statuses, search, assignedTo, source, limit, offset],
    ),
    query(
      `SELECT status, count(*)::int AS count FROM leads
        WHERE ($1::bigint IS NULL OR assigned_to = $1)
        GROUP BY status`,
      [scopeAssignee],
    ),
  ]);

  const total = list.rows[0]?.total_count ?? 0;
  return {
    items: list.rows.map(({ total_count, ...row }) => row),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    counts: Object.fromEntries(counts.rows.map((r) => [r.status, r.count])),
  };
}

async function getLeadDetail(id, user) {
  await assertLeadAccess({ query }, id, user); // 404 if missing or not this staff member's lead
  const [lead, surveys, quotes, activities] = await Promise.all([
    query(
      `SELECT l.*, u.name AS assigned_to_name, c.name AS created_by_name
         FROM leads l
         LEFT JOIN users u ON u.id = l.assigned_to
         LEFT JOIN users c ON c.id = l.created_by
        WHERE l.id = $1`,
      [id],
    ),
    query(
      `SELECT s.*, t.name AS technician_name, r.name AS reviewed_by_name
         FROM surveys s
         JOIN users t ON t.id = s.technician_id
         LEFT JOIN users r ON r.id = s.reviewed_by
        WHERE s.lead_id = $1
        ORDER BY s.created_at DESC, s.id DESC`,
      [id],
    ),
    query(
      `SELECT q.id, q.quote_number, q.status, q.package_kind, q.system_type, q.includes_installation, q.capacity_kw, q.subtotal, q.discount_pct,
              q.gst_amount, q.total, q.valid_until, q.template_id,
              t.name || CASE WHEN q.includes_installation THEN ' + Installation' ELSE '' END AS template_name, q.created_at
         FROM quotes q LEFT JOIN package_templates t ON t.id = q.template_id
        WHERE q.lead_id = $1 ORDER BY q.created_at DESC, q.id DESC`,
      [id],
    ),
    query(
      `SELECT a.id, a.type, a.from_status, a.to_status, a.note, a.created_at, a.actor_id,
              u.name AS actor_name, COALESCE(u.role::text, 'SYSTEM') AS actor_role
         FROM lead_activities a LEFT JOIN users u ON u.id = a.actor_id
        WHERE a.lead_id = $1
        ORDER BY a.created_at DESC, a.id DESC`,
      [id],
    ),
  ]);
  if (!lead.rows.length) throw AppError.notFound('Lead');
  return { ...lead.rows[0], surveys: surveys.rows, quotes: quotes.rows, activities: activities.rows };
}

/** NEW -> QUALIFIED. Stores qualification answers (JSONB) and the suggested system size. */
async function qualifyLead(id, input, actor) {
  return withTransaction(async (client) => {
    await assertLeadAccess(client, id, actor, { lock: true });
    const sizing = suggestKw(input);
    const suggested = input.suggestedKw ?? sizing.suggestedKw;
    const qualification = { ...stripNulls(input), sizingBasis: sizing.basis, qualifiedAt: new Date().toISOString() };

    const note = suggested
      ? `Qualified – suggested ${suggested} kW${input.systemType ? ` ${input.systemType.replace('_', '-')}` : ''}`
      : 'Qualified';
    await transitionLead(client, id, LEAD_STATUS.QUALIFIED, actor.id, input.notes ? `${note}. ${input.notes}` : note);

    const { rows } = await client.query(
      `UPDATE leads
          SET qualification = qualification || $2::jsonb,
              suggested_kw  = $3,
              monthly_bill  = COALESCE($4, monthly_bill)
        WHERE id = $1
        RETURNING *`,
      [id, JSON.stringify(qualification), suggested, input.monthlyBill],
    );
    return { lead: rows[0], suggestedKw: suggested, sizingBasis: sizing.basis };
  });
}

/** any open status -> LOST. Also closes any open survey and pending quotes for the lead. */
async function markLost(id, reason, actor) {
  return withTransaction(async (client) => {
    await assertLeadAccess(client, id, actor, { lock: true });
    await transitionLead(client, id, LEAD_STATUS.LOST, actor.id, `Marked lost: ${reason}`);
    await client.query(
      `UPDATE surveys SET status = 'REJECTED', review_note = 'Lead marked lost', reviewed_by = $2, reviewed_at = now()
        WHERE lead_id = $1 AND status IN ('SCHEDULED', 'SUBMITTED')`,
      [id, actor.id],
    );
    await client.query(
      `UPDATE quotes SET status = 'REJECTED', decided_at = now() WHERE lead_id = $1 AND status IN ('DRAFT', 'SENT')`,
      [id],
    );
    const { rows } = await client.query('UPDATE leads SET lost_reason = $2 WHERE id = $1 RETURNING *', [id, reason]);
    return rows[0];
  });
}

/** Admin only: move a lead to another active staff/admin user, with a timeline entry. */
async function reassignLead(id, assigneeId, admin) {
  return withTransaction(async (client) => {
    const lead = await assertLeadAccess(client, id, admin, { lock: true });
    const target = await client.query(
      `SELECT id, name FROM users WHERE id = $1 AND is_active AND role IN ('STAFF', 'ADMIN')`,
      [assigneeId],
    );
    if (!target.rows.length) throw AppError.badRequest('assignedTo must be an active staff/admin user', { field: 'assignedTo' });
    if (Number(lead.assigned_to) === Number(assigneeId)) {
      throw AppError.conflict(`Lead is already assigned to ${target.rows[0].name}`, 'ALREADY_ASSIGNED');
    }

    const prev = lead.assigned_to
      ? (await client.query('SELECT name FROM users WHERE id = $1', [lead.assigned_to])).rows[0]?.name
      : null;
    const { rows } = await client.query('UPDATE leads SET assigned_to = $2 WHERE id = $1 RETURNING *', [id, assigneeId]);
    await logActivity(
      client, id, admin.id, 'ASSIGNED',
      `Reassigned ${prev ? `from ${prev} ` : ''}to ${target.rows[0].name}`,
    );
    return { ...rows[0], assigned_to_name: target.rows[0].name };
  });
}

const stripNulls = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined));

module.exports = { createEnquiry, createManualLead, listLeads, getLeadDetail, qualifyLead, markLost, reassignLead };
