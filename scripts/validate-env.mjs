import { pathToFileURL } from 'node:url';
import nextEnv from '@next/env';
export function validateFirebaseEnv(env) {
  const fields = [
    'API_KEY',
    'AUTH_DOMAIN',
    'DATABASE_URL',
    'PROJECT_ID',
    'STORAGE_BUCKET',
    'MESSAGING_SENDER_ID',
    'APP_ID',
  ];
  for (const field of fields)
    if (!env[`NEXT_PUBLIC_FIREBASE_${field}`]?.trim())
      throw Error(`Missing NEXT_PUBLIC_FIREBASE_${field}`);
  const id = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === 'true')
    throw Error('Production must not enable NEXT_PUBLIC_FIREBASE_USE_EMULATORS');
  if (env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN !== `${id}.firebaseapp.com`)
    throw Error('FIREBASE_AUTH_DOMAIN does not match PROJECT_ID');
  let url;
  try {
    url = new URL(env.NEXT_PUBLIC_FIREBASE_DATABASE_URL);
  } catch {
    throw Error('Invalid FIREBASE_DATABASE_URL');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/' ||
    !(
      url.hostname === `${id}-default-rtdb.firebaseio.com` ||
      (url.hostname.startsWith(`${id}-default-rtdb.`) &&
        url.hostname.endsWith('.firebasedatabase.app'))
    )
  )
    throw Error('FIREBASE_DATABASE_URL does not match PROJECT_ID');
  if (
    ![`${id}.firebasestorage.app`, `${id}.appspot.com`].includes(
      env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    )
  )
    throw Error('FIREBASE_STORAGE_BUCKET does not match PROJECT_ID');
  if (
    !/^\d+$/.test(env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) ||
    !env.NEXT_PUBLIC_FIREBASE_APP_ID.startsWith(
      `1:${env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}:web:`,
    )
  )
    throw Error('FIREBASE_APP_ID does not match MESSAGING_SENDER_ID');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  nextEnv.loadEnvConfig(process.cwd(), false);
  validateFirebaseEnv(process.env);
  console.log('Firebase production configuration validated.');
}
