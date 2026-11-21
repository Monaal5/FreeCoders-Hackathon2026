// Central config. Values come from backend/.env (loaded by `node --env-file-if-exists=.env`).
const required = ['DATABASE_URL', 'JWT_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing env var ${key}. Copy backend/.env.example to backend/.env`);
  }
}

module.exports = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()),
  // Phase 2: an order is CONFIRMED once at least this % of the total is paid (or the full amount)
  advancePercent: Math.min(100, Math.max(0, Number(process.env.ADVANCE_PERCENT ?? 30))),
  // Phase 2: default installation date = confirmation date + N days (crew lead assigned later)
  jobLeadDays: Number(process.env.JOB_LEAD_DAYS ?? 7),
};
