const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { corsOrigins, nodeEnv } = require('./config/env');
const { UPLOAD_ROOT } = require('./middleware/upload');
const { notFound, errorHandler } = require('./middleware/error');
const { query } = require('./config/db');
const routes = require('./routes');

const app = express();

app.use(cors({ origin: corsOrigins }));
app.use(express.json({ limit: '1mb' }));
if (nodeEnv !== 'test') app.use(morgan('dev'));

// Survey photos: http://localhost:5000/uploads/surveys/<file>
app.use('/uploads', express.static(UPLOAD_ROOT, { maxAge: '7d', fallthrough: false }));

app.get('/api/health', async (_req, res) => {
  const { rows } = await query('SELECT now() AS db_time');
  res.json({ success: true, data: { status: 'ok', dbTime: rows[0].db_time } });
});

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
