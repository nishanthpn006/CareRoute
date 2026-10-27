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

export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: false }));
app.use(express.json({ limit: '100kb' }));

export const createHealthHandler = (store = domainStore, cfg = config) => async (_req, res) => {
  const baseHealth = {
    service: 'careroute-api',
    dataMode: cfg.dataMode,
    timestamp: new Date().toISOString(),
  };

  if (cfg.dataMode === 'postgres') {
    try {
      await store.ping(3000);
      return res.status(200).json({
        status: 'ok',
        database: 'connected',
        ...baseHealth,
      });
    } catch (err) {
      console.error('[CareRoute Health] Database health check failed:', err.message);
      return res.status(503).json({
        status: 'degraded',
        database: 'disconnected',
        ...baseHealth,
        error: 'Database connection check failed.',
      });
    }
  }

  return res.status(200).json({
    status: 'ok',
    database: cfg.dataMode === 'demo' ? 'in-memory' : 'firebase',
    ...baseHealth,
  });
};

export const handleHealth = createHealthHandler();
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

let server = null;
let isShuttingDown = false;

export async function gracefulShutdown(signal = 'SIGTERM', timeoutMs = 10000) {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  console.log(`[CareRoute API] Received ${signal}. Starting graceful shutdown...`);

  const forceTimer = setTimeout(() => {
    console.error('[CareRoute API] Graceful shutdown timeout exceeded. Forcing exit.');
    process.exit(1);
  }, timeoutMs);
  if (forceTimer.unref) forceTimer.unref();

  if (server) {
    await new Promise((resolve) => {
      server.close((err) => {
        if (err) {
          console.error('[CareRoute API] Error closing HTTP server:', err.message);
        } else {
          console.log('[CareRoute API] HTTP server closed.');
        }
        resolve();
      });
    });
  }

  try {
    if (domainStore && typeof domainStore.close === 'function') {
      await domainStore.close();
      console.log('[CareRoute API] Domain store connections closed.');
    }
  } catch (err) {
    console.error('[CareRoute API] Error closing domain store:', err.message);
  }

  clearTimeout(forceTimer);
  console.log('[CareRoute API] Graceful shutdown complete.');
  if (process.env.NODE_ENV !== 'test') {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  server = app.listen(config.port, async () => {
    try {
      await domainStore.seedIfEmpty();
    } catch (err) {
      console.error('[CareRoute API] Failed to seed data store:', err.message);
    }
    console.log(`[CareRoute API] Listening on http://localhost:${config.port}`);
    console.log(`[CareRoute API] Data mode: ${config.dataMode}`);
    console.log(`[CareRoute API] Demo login: ${config.enableDemoLogin ? 'enabled' : 'disabled'}`);
  });
}
