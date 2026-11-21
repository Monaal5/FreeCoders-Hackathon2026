const { query } = require('../config/db');

/** Active users, optionally by role. Technicians include their open survey count (for assigning). */
async function listUsers(role) {
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.phone, u.role,
            (SELECT count(*)::int FROM surveys s WHERE s.technician_id = u.id AND s.status = 'SCHEDULED') AS open_surveys,
            (SELECT count(*)::int FROM leads l WHERE l.assigned_to = u.id AND l.status NOT IN ('WON', 'LOST')) AS open_leads
       FROM users u
      WHERE u.is_active AND ($1::user_role IS NULL OR u.role = $1)
      ORDER BY u.role, u.name`,
    [role],
  );
  return rows;
}

module.exports = { listUsers };
