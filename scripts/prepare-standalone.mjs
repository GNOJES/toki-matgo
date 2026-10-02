import { cp, mkdir } from 'node:fs/promises';
const root = '.next-prod/standalone';
await mkdir(`${root}/.next-prod`, { recursive: true });
await cp('public', `${root}/public`, { recursive: true });
await cp('.next-prod/static', `${root}/.next-prod/static`, { recursive: true });
console.log('Standalone frontend prepared with static cards, PWA and app chunks.');
