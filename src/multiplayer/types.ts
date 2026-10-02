import type { GameAction, GameEvent, GameState, GameView, PlayerId } from '../game-engine/types';
export interface Stats {
  wins: [number, number];
  points: [number, number];
}
export interface RoomMessage {
  code: string;
  me: PlayerId;
  nickname: string;
  names: [string, string];
  connected: [boolean, boolean];
  round: number;
  stats: Stats;
  nextReady: [boolean, boolean];
  actionSequence: number;
  canAct: boolean;
  game: GameView | null;
  events: GameEvent[];
  revision: number;
  closed: boolean;
  expiresAt: number;
}
export interface Envelope {
  round: number;
  sequence: number;
  stateVersion: number;
  action: GameAction | { type: 'NEXT_ROUND' };
}
export interface Request extends Envelope {
  uid: string;
  createdAt: number;
}
export interface HostState {
  revision: number;
  round: number;
  game: GameState | null;
  events: GameEvent[];
  stats: Stats;
  processed: [number, number];
  nextReady: [boolean, boolean];
  receipts: [{ seq: number; error?: string }, { seq: number; error?: string }];
  settledVersion: number | null;
}
export interface PlayerRecord {
  name: string;
  connections?: Record<string, boolean>;
  ready?: { round: number; version: number };
}
export interface RoomData {
  meta: {
    hostUid: string;
    guestUid?: string;
    createdAt: number;
    expiresAt: number;
    status: 'waiting' | 'active' | 'closed';
    updatedAt: number;
  };
  players?: Record<string, PlayerRecord>;
  state: { version: number; data: string };
  actions?: Record<string, Record<string, Request>>;
}
export interface MultiplayerTransport {
  readonly code: string;
  readonly uid: string;
  readonly connected: boolean;
  action(envelope: Envelope): Promise<void>;
  ready(round: number, version: number): Promise<void>;
  nextRound(round: number, version: number, sequence: number): Promise<void>;
  leave(): Promise<void>;
  dispose(): void;
}
