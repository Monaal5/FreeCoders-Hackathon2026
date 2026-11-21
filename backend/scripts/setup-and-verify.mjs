import EmbeddedPostgres from 'embedded-postgres';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pgPkg from 'pg';
const { Client } = pgPkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PG_PORT || 5433);
const databaseDir =
  process.env.PG_DATA_DIR || path.join(process.env.LOCALAPPDATA || os.homedir(), 'sunpower', 'pgdata');

console.log('Connecting/Starting embedded PostgreSQL...');
const pg = new EmbeddedPostgres({
  databaseDir,
  port,
  user: 'postgres',
  password: 'postgres',
  persistent: true,
  onLog: () => {},
});

const firstRun = !existsSync(path.join(databaseDir, 'PG_VERSION'));
if (firstRun) {
  console.log(`Initialising new cluster in ${databaseDir} ...`);
  await pg.initialise();
}
await pg.start();
if (firstRun) {
  await pg.createDatabase('sunpower');
}

console.log(`PostgreSQL running on port ${port}. Now applying db/reset.sql ...`);

function inline(file) {
  const sql = readFileSync(file, 'utf8');
  return sql.replace(/^\\ir\s+(\S+)\s*$/gm, (_, inc) => inline(path.resolve(path.dirname(file), inc)));
}

const dbDir = path.resolve(__dirname, '..', '..', 'db');
const resetSql = path.resolve(dbDir, 'reset.sql');
const dbUrl = process.env.DATABASE_URL || `postgres://postgres:postgres@localhost:${port}/sunpower`;

const client = new Client({ connectionString: dbUrl });
await client.connect();

try {
  console.log('Executing SQL schema and seed files...');
  await client.query(inline(resetSql));
  const { rows } = await client.query(`
    SELECT 
      (SELECT count(*) FROM users) AS users, 
      (SELECT count(*) FROM products WHERE is_active) AS products,
      (SELECT count(*) FROM package_templates WHERE is_active) AS packages,
      (SELECT count(*) FROM template_items) AS bom_items, 
      (SELECT count(*) FROM leads) AS leads
  `);
  console.log('Database successfully initialized and seeded!');
  console.log('Verification counts:', rows[0]);
} catch (err) {
  console.error('Error seeding database:', err);
} finally {
  await client.end();
  console.log('Stopping PostgreSQL...');
  await pg.stop();
  console.log('Done!');
}
