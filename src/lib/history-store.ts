import { HISTORY_KEY, parseHistory, type PlayHistory } from './play-history';
const DB = 'toki-history-v2';
const STORE = 'history';
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('다른 창을 닫고 기록을 다시 저장해주세요.'));
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}
/** Read and write in ONE IndexedDB transaction: different tabs cannot overwrite each other. */
export async function updateHistory(change: (h: PlayHistory) => PlayHistory): Promise<PlayHistory> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    let next: PlayHistory;
    const request = store.get('current');
    request.onsuccess = () => {
      try {
        let legacy: string | null = null;
        if (!request.result) {
          try {
            legacy = localStorage.getItem(HISTORY_KEY);
          } catch {}
        }
        next = change(request.result ?? parseHistory(legacy));
        store.put(next, 'current');
      } catch {
        tx.abort();
      }
    };
    tx.oncomplete = () => {
      db.close();
      // Compatibility cache and invalidation signal only; never authoritative after migration.
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {}
      resolve(next);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('기록을 저장하지 못했어요.'));
    };
  });
}
export const readHistory = () => updateHistory((h) => h);
