// Runs a private PostgreSQL server from node_modules (no system install, no Windows service).
// Data lives OUTSIDE OneDrive (sync + Postgres files = corruption): %LOCALAPPDATA%\sunpower\pgdata
// Usage:  npm run db:start      (keep this terminal open; Ctrl+C to stop)
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const port = Number(process.env.PG_PORT || 5433);
const databaseDir =
  process.env.PG_DATA_DIR || path.join(process.env.LOCALAPPDATA || os.homedir(), 'sunpower', 'pgdata');

const pg = new EmbeddedPostgres({
  databaseDir,
  port,
  user: 'postgres',
  password: 'postgres',
  persistent: true,
  onLog: () => {}, // keep the terminal quiet; errors still print
});

const firstRun = !existsSync(path.join(databaseDir, 'PG_VERSION'));
if (firstRun) {
  console.log(`Initialising new cluster in ${databaseDir} ...`);
  await pg.initialise();
}
await pg.start();
if (firstRun) {
  await pg.createDatabase('sunpower');
  console.log('Created database "sunpower" – now run:  npm run db:reset');
}
console.log(`PostgreSQL running on localhost:${port} (user postgres / postgres). Ctrl+C to stop.`);

let stopping = false;
const shutdown = async () => {
  if (stopping) return;
  stopping = true;
  console.log('\nStopping PostgreSQL ...');
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
