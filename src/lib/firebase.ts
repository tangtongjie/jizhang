import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

function validateConfig(config: any) {
  const required = ['apiKey', 'authDomain', 'projectId', 'appId', 'firestoreDatabaseId'];
  const missing = required.filter(key => !config[key]);
  if (missing.length > 0) {
    throw new Error(`Firebase configuration is missing required fields: ${missing.join(', ')}`);
  }
}

let app;
try {
  validateConfig(firebaseConfig);
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
} catch (error) {
  console.error("Firebase initialization failed:", error);
  throw error;
}

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Set persistence to local to ensure session stays across refreshes
setPersistence(auth, browserLocalPersistence).catch(err => {
  console.error("Persistence error:", err);
});
