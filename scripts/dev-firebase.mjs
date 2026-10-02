import { spawn } from 'node:child_process';
const args = process.argv.slice(2);
const child = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'dev', '--hostname', '0.0.0.0', ...args],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_BUILD_DIR: '.next-firebase',
      NEXT_PUBLIC_FIREBASE_USE_EMULATORS: 'true',
      NEXT_PUBLIC_FIREBASE_API_KEY: 'demo-api-key',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-toki-matgo.firebaseapp.com',
      NEXT_PUBLIC_FIREBASE_DATABASE_URL: 'https://demo-toki-matgo-default-rtdb.firebaseio.com',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-toki-matgo',
      NEXT_PUBLIC_FIREBASE_APP_ID: '1:123456789:web:demo',
    },
  },
);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 0));
