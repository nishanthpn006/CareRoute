import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { hospitalsRouter } from './routes/hospitals.js';
import { adminRouter } from './routes/admin.js';
import { publicRouter } from './routes/public.js';
import { staffRouter } from './routes/staff.js';
import { verifierRouter } from './routes/verifier.js';
import { domainStore } from './lib/domainStore.js';

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: false }));
app.use(express.json({ limit: '100kb' }));

const handleHealth = (_req, res) => {
  res.json({ status: 'ok', service: 'careroute-api', dataMode: config.dataMode, timestamp: new Date().toISOString() });
};
app.get('/health', handleHealth);
app.get('/api/health', handleHealth);
app.use('/api/auth', authRouter);
app.use('/api/hospitals', hospitalsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/public', publicRouter);
app.use('/api/staff', staffRouter);
app.use('/api/verifier', verifierRouter);

app.use((req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` }));
app.use((error, _req, res, _next) => {
  console.error('[CareRoute API]', error);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

app.listen(config.port, async () => {
  try {
    await domainStore.seedIfEmpty();
  } catch (err) {
    console.error('[CareRoute API] Failed to seed data store:', err);
  }
  console.log(`[CareRoute API] Listening on http://localhost:${config.port}`);
  console.log(`[CareRoute API] Data mode: ${config.dataMode}`);
});
