import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
  signInAnonymously,
} from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase } from 'firebase/database';
let initialization: ReturnType<typeof initialize> | undefined;
async function initialize() {
  const emulators =
    process.env.NODE_ENV === 'development' &&
    process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === 'true';
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  if (!config.apiKey || !config.databaseURL || !config.projectId || !config.appId)
    throw Error('친구와 치기 연결이 아직 준비되지 않았어요. 잠시 후 다시 이용해주세요.');
  const existing = getApps().length > 0;
  const app = existing ? getApp() : initializeApp(config);
  const auth = getAuth(app),
    db = getDatabase(app);
  if (emulators && !existing) {
    const host = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST ?? '127.0.0.1';
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectDatabaseEmulator(db, host, 9000);
  }
  await setPersistence(auth, browserLocalPersistence);
  await auth.authStateReady();
  const user = auth.currentUser ?? (await signInAnonymously(auth)).user;
  return { db, auth, uid: user.uid };
}
export function firebaseClient() {
  initialization ??= initialize().catch((error) => {
    initialization = undefined;
    throw error;
  });
  return initialization;
}
