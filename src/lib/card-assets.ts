'use client';
import manifest from '../../public/card-assets.json';
const initial: Record<string, string> = manifest.cards;
let current = initial;
const listeners = new Set<() => void>();
function receive(event: MessageEvent) {
  if (event.data?.type !== 'CARD_ASSETS' || !event.data.cards) return;
  const cards: unknown = event.data.cards;
  if (typeof cards !== 'object' || cards === null || Array.isArray(cards)) return;
  const entries = Object.entries(cards);
  if (
    !entries.length ||
    entries.some(
      ([id, url]) =>
        typeof url !== 'string' ||
        !/^\/cards\/(?:m\d+-\d\.webp|bonus-\d\.svg|back\.svg)\?v=[a-f0-9]+$/.test(url) ||
        !(id in initial),
    )
  )
    return;
  if (JSON.stringify(current) === JSON.stringify(cards)) return;
  current = Object.fromEntries(entries);
  for (const listener of listeners) listener();
}
export function subscribeCardAssets(listener: () => void) {
  if (!listeners.size && 'serviceWorker' in navigator)
    navigator.serviceWorker.addEventListener('message', receive);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size && 'serviceWorker' in navigator)
      navigator.serviceWorker.removeEventListener('message', receive);
  };
}
export const getCardAssets = () => current;
export const getServerCardAssets = () => initial;
