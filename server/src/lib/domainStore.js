import { config } from '../config.js';
import { InMemoryStorageAdapter } from './storage/InMemoryAdapter.js';
import { FirestoreStorageAdapter } from './storage/FirestoreAdapter.js';
import { PostgresStorageAdapter } from './storage/PostgresAdapter.js';
import { firestore } from './firebaseAdmin.js';
import pg from 'pg';

const { Pool } = pg;

export function createStorageAdapter(mode = config.dataMode, db = null) {
  if (mode === 'postgres') {
    if (db && typeof db.query === 'function') {
      return new PostgresStorageAdapter(db);
    }
    if (!config.databaseUrl) {
      throw new Error(
        'PostgreSQL mode is enabled (DATA_MODE=postgres), but DATABASE_URL is not configured. Check server/.env.'
      );
    }
    const poolConfig = {
      connectionString: config.databaseUrl,
    };
    if (config.databaseSsl) {
      poolConfig.ssl = config.databaseSsl;
    }
    const pool = new Pool(poolConfig);
    return new PostgresStorageAdapter(pool);
  }

  if (mode === 'firebase') {
    const firestoreDb = db || firestore;
    if (!firestoreDb) {
      throw new Error(
        'Firebase mode is enabled (DATA_MODE=firebase), but Firestore could not be initialized. Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY or FIRESTORE_EMULATOR_HOST.'
      );
    }
    return new FirestoreStorageAdapter(firestoreDb);
  }

  return new InMemoryStorageAdapter();
}

export const domainStore = createStorageAdapter();
export { InMemoryStorageAdapter, FirestoreStorageAdapter, PostgresStorageAdapter };
