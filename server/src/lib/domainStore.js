import { config } from '../config.js';
import { InMemoryStorageAdapter } from './storage/InMemoryAdapter.js';
import { FirestoreStorageAdapter } from './storage/FirestoreAdapter.js';
import { firestore } from './firebaseAdmin.js';

export function createStorageAdapter(mode = config.dataMode, db = firestore) {
  if (mode === 'firebase') {
    if (!db) {
      throw new Error(
        'Firebase mode is enabled (DATA_MODE=firebase), but Firestore could not be initialized. Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY or FIRESTORE_EMULATOR_HOST.'
      );
    }
    return new FirestoreStorageAdapter(db);
  }
  return new InMemoryStorageAdapter();
}

export const domainStore = createStorageAdapter();
export { InMemoryStorageAdapter, FirestoreStorageAdapter };
