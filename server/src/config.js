import 'dotenv/config';

const isTestRunner = Boolean(process.env.NODE_TEST_CONTEXT) || process.env.npm_lifecycle_event === 'test';
const rawDataMode = (isTestRunner ? (process.env.TEST_DATA_MODE || 'demo') : (process.env.DATA_MODE || 'demo')).trim().toLowerCase();
const dataMode = rawDataMode === 'postgresql' ? 'postgres' : rawDataMode;
if (!['demo', 'firebase', 'postgres'].includes(dataMode)) {
  throw new Error('DATA_MODE must be one of "demo", "firebase", or "postgres".');
}

const rawEnableDemoLogin = (process.env.ENABLE_DEMO_LOGIN || '').trim().toLowerCase();
const enableDemoLogin = dataMode === 'demo'
  ? rawEnableDemoLogin !== 'false' && rawEnableDemoLogin !== '0'
  : (dataMode === 'postgres' && (rawEnableDemoLogin === 'true' || rawEnableDemoLogin === '1'));

const databaseSsl = (() => {
  const rawSsl = (process.env.DATABASE_SSL || process.env.PGSSLMODE || '').trim().toLowerCase();
  const isSslEnabled = ['true', '1', 'require', 'verify-ca', 'verify-full'].includes(rawSsl);
  if (!isSslEnabled) return false;

  const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false';
  const ca = process.env.DATABASE_SSL_CA ? process.env.DATABASE_SSL_CA.replace(/\\n/g, '\n') : undefined;

  return {
    rejectUnauthorized,
    ...(ca ? { ca } : {}),
  };
})();

export const config = {
  port: Number(process.env.PORT || 4000),
  dataMode,
  databaseUrl: process.env.DATABASE_URL,
  databaseSsl,
  enableDemoLogin,
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  jwtSecret: (process.env.JWT_SECRET || '').trim(),
  demoAdminEmail: (process.env.DEMO_ADMIN_EMAIL || '').trim().toLowerCase(),
  demoAdminPassword: process.env.DEMO_ADMIN_PASSWORD || '',
  adminEmails: (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (config.dataMode === 'postgres') {
  if (!config.databaseUrl) {
    throw new Error('PostgreSQL mode (DATA_MODE=postgres) requires DATABASE_URL to be set in server/.env or your runtime environment.');
  }
  if (!config.jwtSecret) {
    throw new Error('PostgreSQL mode requires JWT_SECRET to be set in server/.env or your runtime environment.');
  }
  if (config.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long.');
  }
}

if (config.dataMode === 'demo') {
  console.warn('[CareRoute] DATA_MODE=demo: sample facilities and bed counts are fictional and reset when the server restarts.');
  const missing = [
    ['JWT_SECRET', config.jwtSecret],
    ['DEMO_ADMIN_EMAIL', config.demoAdminEmail],
    ['DEMO_ADMIN_PASSWORD', config.demoAdminPassword],
  ].filter(([, value]) => !value).map(([name]) => name);

  if (missing.length) {
    throw new Error(`Demo mode requires explicit environment variables: ${missing.join(', ')}. Set them in server/.env or your runtime environment.`);
  }

  if (config.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long.');
  }
}

if (config.dataMode === 'firebase') {
  const isEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  if (isEmulator) {
    config.firebaseProjectId = config.firebaseProjectId || 'demo-careroute';
  } else {
    const missing = [
      ['FIREBASE_PROJECT_ID', config.firebaseProjectId],
      ['FIREBASE_CLIENT_EMAIL', config.firebaseClientEmail],
      ['FIREBASE_PRIVATE_KEY', config.firebasePrivateKey],
    ].filter(([, value]) => !value).map(([name]) => name);
    if (missing.length) {
      throw new Error(`Firebase mode is missing required environment variables: ${missing.join(', ')}`);
    }
  }
  if (!config.adminEmails.length) {
    if (isEmulator) {
      config.adminEmails = ['admin@careroute.local'];
    } else {
      throw new Error('Firebase mode requires at least one email in ADMIN_EMAILS.');
    }
  }
}
