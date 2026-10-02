export type PlayerId = 0 | 1;
export type Category = 'GWANG' | 'YEOL' | 'TTI' | 'PI' | 'BONUS';
export type RibbonType = 'HONGDAN' | 'CHEONGDAN' | 'CHODAN' | 'NONE';
export interface Card {
  id: string;
  month: number;
  name: string;
  category: Category;
  isGwang: boolean;
  isYeol: boolean;
  isTti: boolean;
  isPi: boolean;
  piValue: number;
  isBonus: boolean;
  isGodori: boolean;
  ribbonType: RibbonType;
  specialType: 'RAIN' | 'KUKJIN' | 'DOUBLE_PI' | null;
}
export interface PlayerState {
  hand: Card[];
  captured: Card[];
  goCount: number;
  goAtScore: number;
  shakes: number[];
  bombs: number;
  bombPasses: number;
  turnsRemaining: number;
  ppukCount: number;
  openingPpukStreak: number;
  emptyStreak: number;
  kukjinAsPi: boolean;
  sidePoints: number;
}
export interface TurnState {
  played: Card | null;
  playMatches: Card[];
  chosen: Card | null;
  revealed: Card | null;
  bonuses: Card[];
  captured: Card[];
  transfer: number;
  last: boolean;
  bomb: boolean;
  stage: 'hand' | 'deck';
  options: string[];
}
export interface ScoreResult {
  gwangScore: number;
  yeolScore: number;
  godoriScore: number;
  ribbonScore: number;
  hongdanScore: number;
  cheongdanScore: number;
  chodanScore: number;
  piScore: number;
  piCount: number;
  yeolCount: number;
  baseScore: number;
  goBonus: number;
  goMultiplier: number;
  shakeMultiplier: number;
  pibakMultiplier: number;
  gwangbakMultiplier: number;
  meongttaMultiplier: number;
  gobakMultiplier: number;
  nagariMultiplier: number;
  finalScore: number;
}
export interface GameResult {
  winner: PlayerId | null;
  reason: 'STOP' | 'NAGARI' | 'CHONGTONG' | 'THREE_PPUK' | 'HEODANG';
  score: ScoreResult | null;
  points: number;
  sidePoints: [number, number];
}
export interface GameState {
  players: [PlayerState, PlayerState];
  floor: Card[];
  deck: Card[];
  currentPlayer: PlayerId;
  dealer: PlayerId;
  dealerDraw: [number, number];
  phase: 'PLAY' | 'SELECT_FLOOR' | 'SELECT_KUKJIN' | 'GO_STOP' | 'FINISHED';
  turn: TurnState | null;
  ppukOwners: Record<number, PlayerId>;
  bonusAttachments: Record<string, number>;
  lastGo: PlayerId | null;
  nagariMultiplier: number;
  stateVersion: number;
  turnNumber: number;
  result: GameResult | null;
}
export type GameAction =
  | { type: 'PLAY_CARD'; player: PlayerId; cardId: string; shake?: boolean }
  | { type: 'SELECT_FLOOR'; player: PlayerId; cardId: string }
  | { type: 'BOMB'; player: PlayerId; month: number }
  | { type: 'PASS'; player: PlayerId }
  | { type: 'GO' | 'STOP'; player: PlayerId }
  | { type: 'SET_KUKJIN'; player: PlayerId; asPi?: boolean };
export interface GameEvent {
  type: string;
  player: PlayerId;
  cards?: Card[];
  label?: string;
  points?: number;
  stage?: 'hand' | 'deck';
}
export interface ActionResult {
  nextState: GameState;
  events: GameEvent[];
}
export interface PlayerView extends Omit<PlayerState, 'hand'> {
  handCount: number;
}
export interface GameView {
  players: [PlayerView, PlayerView];
  hand: Card[];
  floor: Card[];
  deckCount: number;
  bonusAttachments: Record<string, number>;
  currentPlayer: PlayerId;
  dealer: PlayerId;
  dealerDraw: [number, number];
  phase: GameState['phase'];
  options: string[];
  turnCards: Card[];
  stateVersion: number;
  turnNumber: number;
  result: GameResult | null;
  nagariMultiplier: number;
  lastGo: PlayerId | null;
  scores: [ScoreResult, ScoreResult];
}
export interface RuleConfig {
  stopScore: number;
  bonusCount: number;
  bonusPiValue: number;
}
export const RULES: RuleConfig = { stopScore: 7, bonusCount: 2, bonusPiValue: 2 };
