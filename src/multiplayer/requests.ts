import type { Request } from './types';
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown, min = 0): boolean => Number.isSafeInteger(v) && (v as number) >= min;
const fields = (v: Record<string, unknown>, allowed: string[]) =>
  Object.keys(v).every((k) => allowed.includes(k));
export function isRequest(value: unknown): value is Request {
  if (
    !object(value) ||
    !fields(value, ['uid', 'sequence', 'round', 'stateVersion', 'createdAt', 'action'])
  )
    return false;
  if (
    typeof value.uid !== 'string' ||
    !value.uid.length ||
    value.uid.length > 128 ||
    !integer(value.sequence, 1) ||
    !integer(value.round) ||
    !integer(value.stateVersion) ||
    !integer(value.createdAt)
  )
    return false;
  const a = value.action;
  if (!object(a)) return false;
  if (a.type === 'NEXT_ROUND') return fields(a, ['type']);
  if (a.player !== 0 && a.player !== 1) return false;
  switch (a.type) {
    case 'PLAY_CARD':
    case 'SELECT_FLOOR':
      return (
        fields(
          a,
          a.type === 'PLAY_CARD'
            ? ['type', 'player', 'cardId', 'shake']
            : ['type', 'player', 'cardId'],
        ) &&
        typeof a.cardId === 'string' &&
        /^(m([1-9]|1[0-2])-[0-3]|bonus-[01])$/.test(a.cardId) &&
        (a.shake === undefined || typeof a.shake === 'boolean')
      );
    case 'BOMB':
      return (
        fields(a, ['type', 'player', 'month']) && integer(a.month, 1) && (a.month as number) <= 12
      );
    case 'SET_KUKJIN':
      return (
        fields(a, ['type', 'player', 'asPi']) &&
        (a.asPi === undefined || typeof a.asPi === 'boolean')
      );
    case 'PASS':
    case 'GO':
    case 'STOP':
      return fields(a, ['type', 'player']);
    default:
      return false;
  }
}
/** Legacy queue entries are untrusted too; one bad entry must not poison the pump. */
export function pendingRequests(actions: unknown, participants: (string | undefined)[]) {
  const requests: Request[] = [],
    invalid: string[] = [];
  if (object(actions))
    for (const [uid, entries] of Object.entries(actions)) {
      if (!object(entries)) {
        invalid.push(`actions/${uid}`);
        continue;
      }
      for (const [key, value] of Object.entries(entries)) {
        if (!participants.includes(uid) || !isRequest(value) || value.uid !== uid)
          invalid.push(`actions/${uid}/${key}`);
        else requests.push(value);
      }
    }
  requests.sort((a, b) => a.createdAt - b.createdAt || a.sequence - b.sequence);
  return { requests, invalid };
}
