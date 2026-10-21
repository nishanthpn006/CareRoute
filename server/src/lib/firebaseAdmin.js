import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from '../config.js';

let authInstance = null;
let firestoreInstance = null;

if (config.dataMode === 'firebase') {
  const isEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  const app = getApps()[0] || (
    isEmulator && (!config.firebaseClientEmail || !config.firebasePrivateKey)
      ? initializeApp({ projectId: config.firebaseProjectId || 'demo-careroute' })
      : initializeApp({
          credential: cert({
            projectId: config.firebaseProjectId,
            clientEmail: config.firebaseClientEmail,
            privateKey: config.firebasePrivateKey,
          }),
        })
  );
  authInstance = getAuth(app);
  firestoreInstance = getFirestore(app);
  if (firestoreInstance && typeof firestoreInstance.settings === 'function') {
    firestoreInstance.settings({ ignoreUndefinedProperties: true });
  }
}

export const firebaseAuth = authInstance;
export const firestore = firestoreInstance;
