import EmbeddedPostgres from 'embedded-postgres';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PG_PORT || 5433);
const databaseDir =
  process.env.PG_DATA_DIR || path.join(process.env.LOCALAPPDATA || os.homedir(), 'sunpower', 'pgdata');

const pg = new EmbeddedPostgres({
  databaseDir,
  port,
  user: 'postgres',
  password: 'postgres',
  persistent: true,
  onLog: () => {},
});

console.log('1. Starting Embedded PostgreSQL...');
await pg.start();
console.log('PostgreSQL is running.');

console.log('2. Starting backend server...');
const serverProc = spawn('node', ['--env-file-if-exists=.env', 'src/server.js'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
});

// Wait for backend to be ready
let ready = false;
for (let i = 0; i < 30; i++) {
  try {
    const res = await fetch('http://localhost:5000/api/health');
    if (res.ok) {
      ready = true;
      console.log('Backend server is healthy!');
      break;
    }
  } catch (e) {
    await new Promise((r) => setTimeout(r, 500));
  }
}

if (!ready) {
  console.error('Backend failed to start in time.');
  serverProc.kill();
  await pg.stop();
  process.exit(1);
}

console.log('3. Running smoke test...');
const smokeProc = spawn('node', ['scripts/smoke-test.js'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
});

await new Promise((resolve) => smokeProc.on('exit', resolve));

console.log('4. Resetting DB to clean demo state...');
const resetProc = spawn('node', ['--env-file-if-exists=.env', 'scripts/db-reset.js'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
});

await new Promise((resolve) => resetProc.on('exit', resolve));

console.log('5. Tearing down test processes...');
serverProc.kill();
await pg.stop();
console.log('Pipeline test complete!');
