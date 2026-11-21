const { Pool, types } = require('pg');
const { databaseUrl } = require('./env');

// NUMERIC (OID 1700) arrives as a string by default -> convert to Number for clean JSON.
// Columns are NUMERIC(12,2) so this is safe for display; money maths is rounded to paise.
types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
// INT8 / BIGINT (OID 20) – our ids and COUNT(*) – fit easily in a JS number.
types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
// DATE (OID 1082): keep 'YYYY-MM-DD' as-is, avoids timezone shifts from new Date().
types.setTypeParser(1082, (v) => v);

const pool = new Pool({ connectionString: databaseUrl, max: 10 });

pool.on('error', (err) => console.error('Unexpected idle PG client error:', err.message));

/** One-off query on the pool. Always pass values as params ($1, $2) – never concatenate. */
const query = (text, params) => pool.query(text, params);

/**
 * Runs fn(client) inside BEGIN ... COMMIT on ONE dedicated client.
 * Every query in the transaction must use that `client`, not `pool.query`.
 * Any thrown error -> ROLLBACK and rethrow.
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('ROLLBACK failed:', rollbackErr.message);
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
