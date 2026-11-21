// Applies db/reset.sql (drop + 01_schema.sql + 02_seed.sql) using node-postgres – no psql needed.
// `\ir file.sql` lines are inlined so reset.sql stays runnable from psql too.
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const dbDir = path.resolve(__dirname, '..', '..', 'db');

function inline(file) {
  const sql = fs.readFileSync(path.join(dbDir, file), 'utf8');
  return sql.replace(/^\\ir\s+(\S+)\s*$/gm, (_, inc) => inline(inc));
}

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(inline('reset.sql'));
    const { rows } = await client.query(`
      SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM products) AS products,
             (SELECT count(*) FROM package_templates) AS templates, (SELECT count(*) FROM template_items) AS bom_items,
             (SELECT count(*) FROM leads) AS leads`);
    console.log('Database reset OK:', rows[0]);
  } finally {
    await client.end();
  }
})().catch((err) => {
  console.error('Reset failed:', err.message);
  process.exit(1);
});
