import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
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
  // We throw here to be caught by the ErrorBoundary
  throw error;
}

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
