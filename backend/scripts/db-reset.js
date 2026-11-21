// Runs a SQL file from db/ with node-postgres – no psql needed.
//   npm run db:reset                                   -> db/reset.sql (DROPS everything, reloads demo data)
//   npm run db:migrate -- migrations/001_packages.sql  -> upgrade in place, keeps your data
// `\ir file.sql` lines are inlined (relative to the including file) so the files stay runnable from psql.
// The whole file is sent as one multi-statement query, which PostgreSQL runs as ONE implicit
// transaction: if any statement fails, nothing is applied.
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const dbDir = path.resolve(__dirname, '..', '..', 'db');
const target = process.argv[2] || 'reset.sql';

// Safety: `npm run db:migrate` must never fall back to the destructive reset.
if (process.env.npm_lifecycle_event === 'db:migrate' && (!process.argv[2] || /reset\.sql$/.test(target))) {
  console.error('Usage: npm run db:migrate -- migrations/<file>.sql   (use npm run db:reset to wipe + reseed)');
  process.exit(1);
}

function inline(file) {
  const sql = fs.readFileSync(file, 'utf8');
  return sql.replace(/^\\ir\s+(\S+)\s*$/gm, (_, inc) => inline(path.resolve(path.dirname(file), inc)));
}

(async () => {
  const file = path.resolve(dbDir, target);
  if (!fs.existsSync(file)) throw new Error(`No such file: ${file}`);
  const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5433/sunpower';
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    await client.query(inline(file));
    const { rows } = await client.query(`
      SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM products WHERE is_active) AS products,
             (SELECT count(*) FROM package_templates WHERE is_active) AS packages,
             (SELECT count(*) FROM template_items) AS bom_items, (SELECT count(*) FROM leads) AS leads`);
    console.log(`${path.basename(target)} applied OK:`, rows[0]);
  } finally {
    await client.end();
  }
})().catch((err) => {
  console.error(`${target} failed:`, err.message);
  process.exit(1);
});
