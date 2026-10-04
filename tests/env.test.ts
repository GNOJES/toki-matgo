import { expect, it } from 'vitest';
import { validateFirebaseEnv } from '../scripts/validate-env.mjs';
const good = {
  NEXT_PUBLIC_FIREBASE_API_KEY: 'test-key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'toki-matgo.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_DATABASE_URL:
    'https://toki-matgo-default-rtdb.asia-southeast1.firebasedatabase.app',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'toki-matgo',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'toki-matgo.firebasestorage.app',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '651336244726',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:651336244726:web:abc',
};
it('rejects missing and cross-project production config without printing values', () => {
  expect(() => validateFirebaseEnv(good)).not.toThrow();
  expect(() => validateFirebaseEnv({ ...good, NEXT_PUBLIC_FIREBASE_API_KEY: '' })).toThrow(
    'API_KEY',
  );
  expect(() =>
    validateFirebaseEnv({ ...good, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'another.firebaseapp.com' }),
  ).toThrow('AUTH_DOMAIN');
  expect(() =>
    validateFirebaseEnv({ ...good, NEXT_PUBLIC_FIREBASE_USE_EMULATORS: 'true' }),
  ).toThrow('EMULATORS');
  expect(() =>
    validateFirebaseEnv({ ...good, NEXT_PUBLIC_FIREBASE_DATABASE_URL: 'http://localhost:9000' }),
  ).toThrow('DATABASE_URL');
});
