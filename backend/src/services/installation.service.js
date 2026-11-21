// Phase 3 – field installation ("on the roof").
//   job:    SCHEDULED -> IN_PROGRESS (Start) -> COMPLETED (checklist + photos + serials + signature)
//   order:  DELIVERED -> INSTALLED          serial: DELIVERED -> INSTALLED (verified on site)
//
// Who may do what:
//   view          admin · staff (own leads) · crew (lead + members)
//   start/complete crew lead · admin
//   checklist/photos/serial verify   crew (lead + members) · admin
// A job you may not see behaves as if it does not exist (404); one you can see but may not act on
// gives 403. Every write runs in ONE transaction with the job and order rows locked.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { query, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const { round2 } = require('../utils/money');
const { canAccessLead } = require('../utils/access');
const { ORDER_STATUS: O, transitionOrder } = require('../utils/orderStatus');
const { SIGNATURE_DIR, diskPathFor, randomName } = require('../middleware/upload');

// The installation checklist, straight from the problem statement
const CHECKLIST = Object.freeze([
  { key: 'STANDS_MOUNTED', label: 'Stands mounted' },
  { key: 'PANELS_LAID', label: 'Panels laid' },
  { key: 'WIRING_BOXES_CONNECTED', label: 'Wiring boxes (ACDB/DCDB) connected' },
  { key: 'EARTHING_DONE', label: 'Earthing done' },
  { key: 'GENERATION_TESTED', label: 'Generation tested' },
]);
const CHECKLIST_KEYS = CHECKLIST.map((c) => c.key);
const MIN_AFTER_PHOTOS = 2;
const PHOTO_STAGES = ['BEFORE', 'DURING', 'AFTER'];

const checklistView = (saved = {}) => CHECKLIST.map((c) => ({ ...c, done: saved[c.key] === true }));
const mapsUrl = (j) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([j.address, j.city, j.pincode].filter(Boolean).join(', '))}`;

const note = (client, leadId, actorId, text) =>
  client.query(`INSERT INTO lead_activities (lead_id, actor_id, type, note) VALUES ($1, $2, 'NOTE', $3)`, [leadId, actorId, text]);

// ---------------------------------------------------------------------------------------------
// Loading + access
// ---------------------------------------------------------------------------------------------
async function loadJob(db, jobId, user, { lock = false } = {}) {
  const { rows } = await db.query(
    `SELECT j.*, o.order_number, o.status AS order_status, o.lead_id, o.quote_id,
            l.assigned_to, l.lead_code, l.customer_name, l.phone, l.email, l.address, l.city, l.state, l.pincode,
            q.quote_number, q.capacity_kw, q.package_kind, q.system_type,
            t.name AS package_name, u.name AS crew_lead_name
       FROM installation_jobs j
       JOIN orders o ON o.id = j.order_id
       JOIN leads l  ON l.id = o.lead_id
       JOIN quotes q ON q.id = o.quote_id
       LEFT JOIN package_templates t ON t.id = q.template_id
       LEFT JOIN users u ON u.id = j.crew_lead_id
      WHERE j.id = $1${lock ? ' FOR UPDATE OF j, o' : ''}`,
    [jobId],
  );
  const job = rows[0];
  if (!job) throw AppError.notFound('Job');

  // crew = crew lead + job_crew members (lead listed first)
  const crew = (
    await db.query(
      `SELECT u.id, u.name, u.phone, u.hourly_rate, (u.id = $2) AS is_lead
         FROM users u
        WHERE u.id = $2 OR u.id IN (SELECT technician_id FROM job_crew WHERE job_id = $1)
        ORDER BY (u.id = $2) DESC, u.name`,
      [job.id, job.crew_lead_id],
    )
  ).rows;
  job.crew = crew;

  const isLead = job.crew_lead_id != null && Number(job.crew_lead_id) === Number(user.id);
  const isCrew = crew.some((c) => Number(c.id) === Number(user.id));
  const visible =
    user.role === 'ADMIN' || (user.role === 'STAFF' && canAccessLead(user, job)) || (user.role === 'TECHNICIAN' && isCrew);
  if (!visible) throw AppError.notFound('Job');
  return { job, isLead, isCrew };
}

function requireLead(ctx, user, action) {
  if (user.role === 'ADMIN' || ctx.isLead) return;
  throw AppError.forbidden(`Only the crew lead (or an admin) can ${action}`);
}
function requireCrew(ctx, user, action) {
  if (user.role === 'ADMIN' || ctx.isCrew) return;
  throw AppError.forbidden(`Only the installation crew can ${action}`);
}
/** Job must be IN_PROGRESS for on-site work. */
function requireInProgress(job, action) {
  if (job.status === 'IN_PROGRESS') return;
  if (job.status === 'COMPLETED') {
    throw AppError.conflict(`Job for order ${job.order_number} is already completed`, 'JOB_ALREADY_COMPLETED');
  }
  throw AppError.conflict(`Tap Start before you ${action}`, 'JOB_NOT_STARTED', { status: job.status });
}
function requireOrderDelivered(job) {
  if (job.order_status !== O.DELIVERED) {
    throw AppError.conflict(
      `Order ${job.order_number} is ${job.order_status}: installation needs the goods DELIVERED first`,
      'ORDER_NOT_DELIVERED',
      { orderStatus: job.order_status },
    );
  }
}

// ---------------------------------------------------------------------------------------------
// Pieces of the job detail
// ---------------------------------------------------------------------------------------------
const expectedSerials = (db, orderId) =>
  db
    .query(
      `SELECT i.id, i.serial_number, i.status, i.installed_at, iu.name AS installed_by_name,
              p.sku, p.name, p.category, w.end_date AS warranty_end, w.months AS warranty_months
         FROM inventory_items i
         JOIN products p ON p.id = i.product_id
         LEFT JOIN users iu ON iu.id = i.installed_by
         LEFT JOIN warranties w ON w.inventory_item_id = i.id
        WHERE i.order_id = $1
        ORDER BY p.category, p.sku, i.serial_number`,
      [orderId],
    )
    .then((r) => r.rows.map((s) => ({ ...s, verified: s.status === 'INSTALLED' })));

const jobPhotos = (db, jobId) =>
  db
    .query(
      `SELECT ph.id, ph.path, ph.stage, ph.uploaded_at, u.name AS uploaded_by_name
         FROM job_photos ph LEFT JOIN users u ON u.id = ph.uploaded_by
        WHERE ph.job_id = $1 ORDER BY ph.uploaded_at, ph.id`,
      [jobId],
    )
    .then((r) => r.rows);

// ---------------------------------------------------------------------------------------------
// Tamper-evident signature: SHA-256(job id | installed serials | signed time | signature image)
// ---------------------------------------------------------------------------------------------
function computeSignatureHash(jobId, serials, signedAt, png) {
  return crypto
    .createHash('sha256')
    .update(`${jobId}|${[...serials].sort().join(',')}|${new Date(signedAt).toISOString()}|`)
    .update(png)
    .digest('hex');
}

/** Recomputes the hash from what is in the database NOW; any later edit makes it differ. */
async function checkIntegrity(db, job) {
  if (!job.signature_hash) return null;
  const serials = (
    await db.query(`SELECT serial_number FROM inventory_items WHERE installed_job_id = $1`, [job.id])
  ).rows.map((r) => r.serial_number);
  const file = diskPathFor(job.signature_path);
  let png = null;
  try {
    png = file ? await fs.promises.readFile(file) : null;
  } catch {
    png = null;
  }
  const recomputed = png ? computeSignatureHash(job.id, serials, job.signed_at, png) : null;
  return { valid: recomputed === job.signature_hash, stored_hash: job.signature_hash, recomputed_hash: recomputed };
}

// ---------------------------------------------------------------------------------------------
// A2 – my jobs, job detail, crew
// ---------------------------------------------------------------------------------------------
/** Technician: jobs where I am lead or crew. date=YYYY-MM-DD -> that day; else today + upcoming + in progress. */
async function myJobs(user, date) {
  const { rows } = await query(
    `SELECT j.id, j.status, j.scheduled_date, j.started_at, j.completed_at, j.crew_lead_id,
            (j.crew_lead_id = $1) AS is_lead, lu.name AS crew_lead_name,
            o.id AS order_id, o.order_number, o.status AS order_status,
            l.customer_name, l.phone, l.address, l.city, l.pincode,
            q.capacity_kw, q.package_kind, q.system_type, t.name AS package_name,
            (SELECT count(*) FROM inventory_items i WHERE i.order_id = o.id)                          AS serials_expected,
            (SELECT count(*) FROM inventory_items i WHERE i.order_id = o.id AND i.status = 'INSTALLED') AS serials_verified
       FROM installation_jobs j
       JOIN orders o ON o.id = j.order_id
       JOIN leads l  ON l.id = o.lead_id
       JOIN quotes q ON q.id = o.quote_id
       LEFT JOIN package_templates t ON t.id = q.template_id
       LEFT JOIN users lu ON lu.id = j.crew_lead_id
      WHERE (j.crew_lead_id = $1 OR EXISTS (SELECT 1 FROM job_crew c WHERE c.job_id = j.id AND c.technician_id = $1))
        AND (  ($2::date IS NOT NULL AND j.scheduled_date = $2)
            OR ($2::date IS NULL AND j.status <> 'COMPLETED'
                AND (j.status = 'IN_PROGRESS' OR j.scheduled_date IS NULL OR j.scheduled_date >= current_date)))
      ORDER BY (j.status = 'IN_PROGRESS') DESC, j.scheduled_date NULLS LAST, j.id`,
    [user.id, date],
  );
  return rows.map((j) => ({ ...j, maps_url: mapsUrl(j) }));
}

async function getJobDetail(jobId, user) {
  const { job, isLead, isCrew } = await loadJob({ query }, jobId, user);
  const [serials, photos, logs, integrity] = await Promise.all([
    expectedSerials({ query }, job.order_id),
    jobPhotos({ query }, job.id),
    query(
      `SELECT t.technician_id, u.name, t.hours, t.hourly_rate, t.cost FROM job_time_logs t JOIN users u ON u.id = t.technician_id
        WHERE t.job_id = $1 ORDER BY u.name`,
      [job.id],
    ).then((r) => r.rows),
    checkIntegrity({ query }, job),
  ]);
  const { assigned_to, ...rest } = job;
  const verified = serials.filter((s) => s.verified).length;
  const office = user.role !== 'TECHNICIAN'; // pay rates and labour cost are office information
  return {
    ...rest,
    crew: job.crew.map(({ hourly_rate, ...c }) => (office ? { ...c, hourly_rate } : c)),
    labour_cost: office ? job.labour_cost : undefined,
    maps_url: mapsUrl(job),
    you: { is_lead: isLead, is_crew: isCrew, can_start: user.role === 'ADMIN' || isLead },
    checklist_items: checklistView(job.checklist),
    serials,
    serials_progress: { expected: serials.length, verified, missing: serials.filter((s) => !s.verified).map((s) => s.serial_number) },
    photos,
    after_photos: photos.filter((p) => p.stage === 'AFTER').length,
    min_after_photos: MIN_AFTER_PHOTOS,
    time_logs: office ? logs : logs.map(({ hourly_rate, cost, ...l }) => l),
    signature_integrity: integrity,
    certificate_url: job.status === 'COMPLETED' ? `/api/jobs/${job.id}/certificate` : null,
  };
}

/** PUT crew: replace the crew list (the crew lead always stays on it). */
async function setCrew(jobId, technicianIds, actor) {
  return withTransaction(async (client) => {
    const { job } = await loadJob(client, jobId, actor, { lock: true });
    if (job.status === 'COMPLETED') throw AppError.conflict('A completed job\'s crew cannot be changed', 'JOB_ALREADY_COMPLETED');

    const ids = [...new Set([...technicianIds, ...(job.crew_lead_id ? [Number(job.crew_lead_id)] : [])])];
    const ok = await client.query(`SELECT id FROM users WHERE id = ANY($1::bigint[]) AND role = 'TECHNICIAN' AND is_active`, [ids]);
    if (ok.rows.length !== ids.length) {
      const good = new Set(ok.rows.map((r) => Number(r.id)));
      throw AppError.badRequest('Every crew member must be an active technician', { invalid: ids.filter((i) => !good.has(i)) });
    }
    await client.query('DELETE FROM job_crew WHERE job_id = $1', [job.id]);
    await client.query(`INSERT INTO job_crew (job_id, technician_id) SELECT $1, unnest($2::bigint[])`, [job.id, ids]);
    const crew = (
      await client.query(
        `SELECT u.id, u.name, u.hourly_rate, (u.id = $2) AS is_lead FROM users u WHERE u.id = ANY($1::bigint[]) ORDER BY (u.id = $2) DESC, u.name`,
        [ids, job.crew_lead_id],
      )
    ).rows;
    await note(client, job.lead_id, actor.id, `Installation crew for ${job.order_number}: ${crew.map((c) => c.name).join(', ')}`);
    return { job_id: job.id, crew };
  });
}

// ---------------------------------------------------------------------------------------------
// A3 – start + checklist
// ---------------------------------------------------------------------------------------------
async function startJob(jobId, actor) {
  return withTransaction(async (client) => {
    const ctx = await loadJob(client, jobId, actor, { lock: true });
    const { job } = ctx;
    requireLead(ctx, actor, 'start the job');
    if (job.status === 'COMPLETED') throw AppError.conflict(`Job for ${job.order_number} is already completed`, 'JOB_ALREADY_COMPLETED');
    if (job.status === 'IN_PROGRESS') throw AppError.conflict(`Job for ${job.order_number} was already started`, 'JOB_ALREADY_STARTED');
    requireOrderDelivered(job);

    const { rows } = await client.query(
      `UPDATE installation_jobs SET status = 'IN_PROGRESS', started_at = now(), started_by = $2
        WHERE id = $1 RETURNING id, status, started_at`,
      [job.id, actor.id],
    );
    if (job.crew_lead_id) {
      await client.query(`INSERT INTO job_crew (job_id, technician_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [job.id, job.crew_lead_id]);
    }
    await note(client, job.lead_id, actor.id, `Installation STARTED on site for order ${job.order_number} by ${actor.name}`);
    return rows[0];
  });
}

/** Saves checklist progress (merge), so nothing is lost if the phone app closes. */
async function saveChecklist(jobId, checklist, actor) {
  return withTransaction(async (client) => {
    const ctx = await loadJob(client, jobId, actor, { lock: true });
    requireCrew(ctx, actor, 'update the checklist');
    requireInProgress(ctx.job, 'tick the checklist');
    const merged = { ...(ctx.job.checklist || {}), ...checklist };
    await client.query(`UPDATE installation_jobs SET checklist = $2::jsonb WHERE id = $1`, [ctx.job.id, JSON.stringify(merged)]);
    const items = checklistView(merged);
    return { job_id: ctx.job.id, checklist: merged, items, complete: items.every((i) => i.done) };
  });
}

// ---------------------------------------------------------------------------------------------
// A4 – photos (files already saved by Multer; controller deletes them if this throws)
// ---------------------------------------------------------------------------------------------
async function addPhotos(jobId, stage, publicPaths, actor) {
  return withTransaction(async (client) => {
    const ctx = await loadJob(client, jobId, actor, { lock: true });
    requireCrew(ctx, actor, 'upload photos');
    requireInProgress(ctx.job, 'upload photos');
    const ins = await client.query(
      `INSERT INTO job_photos (job_id, path, stage, uploaded_by)
       SELECT $1, p, $2::photo_stage, $3 FROM unnest($4::text[]) AS p
       RETURNING id, path, stage, uploaded_at`,
      [ctx.job.id, stage, actor.id, publicPaths],
    );
    const counts = (
      await client.query(`SELECT stage, count(*)::int AS n FROM job_photos WHERE job_id = $1 GROUP BY stage`, [ctx.job.id])
    ).rows;
    return { added: ins.rows, counts: Object.fromEntries(counts.map((c) => [c.stage, c.n])), min_after_photos: MIN_AFTER_PHOTOS };
  });
}

// ---------------------------------------------------------------------------------------------
// A5 – on-site serial verification: DELIVERED -> INSTALLED, only for units of THIS order
// ---------------------------------------------------------------------------------------------
async function verifySerial(jobId, serial, actor) {
  return withTransaction(async (client) => {
    const ctx = await loadJob(client, jobId, actor, { lock: true });
    const { job } = ctx;
    requireCrew(ctx, actor, 'verify serials');
    requireInProgress(job, 'scan serials');

    // the safety query: only a DELIVERED unit of THIS order can become INSTALLED
    const upd = await client.query(
      `UPDATE inventory_items
          SET status = 'INSTALLED', installed_at = now(), installed_job_id = $3, installed_by = $4
        WHERE serial_number = $2 AND order_id = $1 AND status = 'DELIVERED'
        RETURNING id, serial_number, status, product_id, installed_at`,
      [job.order_id, serial, job.id, actor.id],
    );
    if (!upd.rows.length) {
      const found = (
        await client.query(
          `SELECT i.status, i.order_id, o.order_number FROM inventory_items i LEFT JOIN orders o ON o.id = i.order_id WHERE i.serial_number = $1`,
          [serial],
        )
      ).rows[0];
      if (!found) throw AppError.conflict(`Serial ${serial} does not exist`, 'SERIAL_NOT_FOUND', { serial });
      if (Number(found.order_id) !== Number(job.order_id)) {
        throw AppError.conflict(`Serial ${serial} is not on order ${job.order_number}`, 'SERIAL_NOT_ON_ORDER', {
          serial,
          belongsTo: found.order_number || null,
        });
      }
      if (found.status === 'INSTALLED') {
        throw AppError.conflict(`Serial ${serial} is already verified on this job`, 'SERIAL_ALREADY_VERIFIED', { serial });
      }
      throw AppError.conflict(`Serial ${serial} is ${found.status}, not DELIVERED`, 'SERIAL_NOT_DELIVERED', { serial });
    }
    const serials = await expectedSerials(client, job.order_id);
    const p = (await client.query('SELECT sku, name FROM products WHERE id = $1', [upd.rows[0].product_id])).rows[0];
    return {
      verified: { ...upd.rows[0], ...p },
      progress: {
        expected: serials.length,
        verified: serials.filter((s) => s.verified).length,
        missing: serials.filter((s) => !s.verified).map((s) => s.serial_number),
      },
    };
  });
}

// ---------------------------------------------------------------------------------------------
// A6 – complete: every rule checked, then job COMPLETED + order INSTALLED + labour, atomically
// ---------------------------------------------------------------------------------------------
async function completeJob(jobId, { confirmedCapacityKw, generationReadingKw, checklist, notes, signedByName, signaturePng }, actor) {
  let signatureFile = null; // written inside the transaction; removed again if it rolls back
  try {
    return await withTransaction(async (client) => {
      const ctx = await loadJob(client, jobId, actor, { lock: true });
      const { job } = ctx;
      requireLead(ctx, actor, 'complete the job');
      requireInProgress(job, 'complete the job');
      requireOrderDelivered(job);

      // 1) checklist – everything ticked (saved progress + anything sent now)
      const merged = { ...(job.checklist || {}), ...(checklist || {}) };
      const missingItems = CHECKLIST.filter((c) => merged[c.key] !== true).map((c) => c.label);
      if (missingItems.length) {
        throw AppError.conflict(`Checklist incomplete: ${missingItems.join(', ')}`, 'CHECKLIST_INCOMPLETE', { missing: missingItems });
      }

      // 2) at least two AFTER photos
      const after = Number(
        (await client.query(`SELECT count(*) AS n FROM job_photos WHERE job_id = $1 AND stage = 'AFTER'`, [job.id])).rows[0].n,
      );
      if (after < MIN_AFTER_PHOTOS) {
        throw AppError.conflict(`Upload at least ${MIN_AFTER_PHOTOS} AFTER photos (${after} so far)`, 'NOT_ENOUGH_AFTER_PHOTOS', {
          required: MIN_AFTER_PHOTOS,
          uploaded: after,
        });
      }

      // 3) every serialized unit of the order verified on the roof
      const units = (await client.query(`SELECT serial_number, status FROM inventory_items WHERE order_id = $1`, [job.order_id])).rows;
      const missingSerials = units.filter((u) => u.status !== 'INSTALLED').map((u) => u.serial_number).sort();
      if (missingSerials.length) {
        throw AppError.conflict(`${missingSerials.length} serial(s) not verified on site: ${missingSerials.join(', ')}`, 'SERIALS_NOT_VERIFIED', {
          missing: missingSerials,
        });
      }

      // 4) system size must match the order
      if (Math.abs(Number(confirmedCapacityKw) - Number(job.capacity_kw)) > 0.001) {
        throw AppError.conflict(
          `Confirmed capacity ${confirmedCapacityKw} kW does not match the order (${Number(job.capacity_kw)} kW)`,
          'CAPACITY_MISMATCH',
          { expected: Number(job.capacity_kw), confirmed: confirmedCapacityKw },
        );
      }

      // 5) signature: save the PNG, hash job + serials + time + image
      const signedAt = new Date();
      const fileName = `job-${job.id}-${randomName('.png')}`;
      signatureFile = path.join(SIGNATURE_DIR, fileName);
      await fs.promises.writeFile(signatureFile, signaturePng);
      const signaturePath = `/uploads/signatures/${fileName}`;
      const signatureHash = computeSignatureHash(job.id, units.map((u) => u.serial_number), signedAt, signaturePng);

      // 6) labour: (finish - start) x each crew member's hourly rate
      const hours = round2(Math.max(0, signedAt - new Date(job.started_at)) / 3_600_000);
      const logs = [];
      for (const member of job.crew) {
        const rate = Number(member.hourly_rate);
        const cost = round2(hours * rate);
        logs.push({ technician_id: member.id, name: member.name, hours, hourly_rate: rate, cost });
        await client.query(
          `INSERT INTO job_time_logs (job_id, technician_id, hours, hourly_rate, cost) VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (job_id, technician_id) DO UPDATE SET hours = EXCLUDED.hours, hourly_rate = EXCLUDED.hourly_rate, cost = EXCLUDED.cost`,
          [job.id, member.id, hours, rate, cost],
        );
      }
      const labourCost = round2(logs.reduce((s, l) => s + l.cost, 0));
      const labourHours = round2(hours * job.crew.length); // person-hours

      const done = await client.query(
        `UPDATE installation_jobs
            SET status = 'COMPLETED', finished_at = $2, completed_at = $2, completed_by = $3,
                checklist = $4::jsonb, confirmed_capacity_kw = $5, generation_reading_kw = $6,
                notes = COALESCE($7, notes), signed_by_name = $8, signature_path = $9, signed_at = $2,
                signature_hash = $10, labour_hours = $11, labour_cost = $12
          WHERE id = $1
          RETURNING *`,
        [job.id, signedAt, actor.id, JSON.stringify(merged), confirmedCapacityKw, generationReadingKw, notes, signedByName,
          signaturePath, signatureHash, labourHours, labourCost],
      );
      await transitionOrder(client, { id: job.order_id, order_number: job.order_number, status: job.order_status }, O.INSTALLED);
      await note(
        client,
        job.lead_id,
        actor.id,
        `Installation COMPLETED for ${job.order_number}: ${units.length} units installed, ${Number(confirmedCapacityKw)} kW confirmed, ` +
          `generation ${Number(generationReadingKw)} kW, signed by ${signedByName}. Labour ${labourHours} person-hours = Rs ${labourCost}`,
      );

      return {
        ...done.rows[0],
        order_status: O.INSTALLED,
        units_installed: units.length,
        time_logs: logs,
        certificate_url: `/api/jobs/${job.id}/certificate`,
      };
    });
  } catch (err) {
    if (signatureFile) fs.promises.unlink(signatureFile).catch(() => {}); // rolled back -> no orphan file
    throw err;
  }
}

module.exports = {
  CHECKLIST,
  CHECKLIST_KEYS,
  PHOTO_STAGES,
  MIN_AFTER_PHOTOS,
  computeSignatureHash,
  checkIntegrity,
  loadJob,
  myJobs,
  getJobDetail,
  setCrew,
  startJob,
  saveChecklist,
  addPhotos,
  verifySerial,
  completeJob,
};
