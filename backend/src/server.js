const app = require('./app');
const { port } = require('./config/env');
const { pool } = require('./config/db');
const { initDb } = require('./config/initDb');

const server = app.listen(port, async () => {
  console.log(`SunPower API listening on http://localhost:${port}/api`);
  await initDb();
});

const shutdown = () => {
  server.close(() => pool.end().then(() => process.exit(0)));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
