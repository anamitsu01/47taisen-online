export type BuildMode = "choice3" | "draft";
/** build: making decks. play: choosing a card for the ranking. result: looking at the reveal. */
export type Stage = "build" | "play" | "result";

export interface Player {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
  /** Server-driven test player (only in test rooms). */
  isBot: boolean;
  /** Prefecture ids still in the deck. */
  hand: number[];
  /** 3-choice building: the candidates currently offered to this player (hidden from others). */
  offer: number[];
  /** Card submitted for the current round. */
  choice: number | null;
  /** Pressed 次へ on the result screen. */
  ready: boolean;
  score: number;
}

export interface Play {
  playerId: string;
  pref: number;
  rank: number;
  value: number;
  points: number;
}

export interface RoundResult {
  round: number;
  /** Index into RANKINGS. */
  ranking: number;
  plays: Play[];
}

export interface RoomSettings {
  /** "random" picks one of the two building methods at the start of each game. */
  buildMode: BuildMode | "random";
}

export interface RoomState {
  code: string;
  /** Test room (opened with TEST_ROOM_CODE): the host can add bots that play automatically. */
  isTest: boolean;
  phase: "lobby" | "playing" | "gameover";
  players: Player[];
  settings: RoomSettings;
  /** Counts games played in this room, so clients can drop per-game local state. */
  game: number;
  stage: Stage;
  buildMode: BuildMode;
  deckSize: number;
  /** Draft: player ids in picking order (A, B, C, A, B, C …). */
  order: string[];
  /** Draft: number of picks made so far. */
  picks: number;
  /** Prefectures not in any deck and not on offer. */
  pool: number[];
  /** Ranking indexes for every round of this game, drawn without repeats. */
  rankings: number[];
  /** 1-based; 0 while building. */
  round: number;
  results: RoundResult[];
  /** After the game: for each winner, one prefecture drawn at random from their deck. */
  finale: { playerId: string; pref: number }[];
  createdAt: number;
}

export interface ClientPlayer {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
  isBot: boolean;
  score: number;
  /** Building: deck is complete. Play: card chosen. Result: pressed 次へ. */
  done: boolean;
}

/** The ranking's question, without any values (safe during the round). */
export interface RankingHead {
  title: string;
  cat: string;
  unit: string;
  dir: "desc" | "asc";
  year: string;
  source: string;
  note: string;
}

/** What one player is allowed to know about the room. */
export interface ClientRoom {
  code: string;
  isTest: boolean;
  phase: RoomState["phase"];
  players: ClientPlayer[];
  settings: RoomSettings;
  game: number;
  stage: Stage;
  buildMode: BuildMode;
  deckSize: number;
  round: number;
  totalRounds: number;
  /** Draft only: who holds each prefecture (null = free). Hidden in 3-choice building. */
  owners: (string | null)[] | null;
  /** Draft only: whose pick it is. */
  turn: string | null;
  me: {
    hand: number[];
    offer: number[];
    choice: number | null;
  } | null;
  /** The current round's ranking (play and result stages). */
  ranking: RankingHead | null;
  /** Result stage and after the game: the full ranking and what everyone played. */
  reveal: {
    plays: Play[];
    values: number[];
    ranks: number[];
  } | null;
  /** After the game: every round, for the summary. */
  history: { round: number; ranking: RankingHead; plays: Play[] }[] | null;
  /** After the game: one prefecture from each winner's deck, the same for every viewer. */
  finale: RoomState["finale"] | null;
}

/** Entering this room code opens a fresh private test room with bots. */
export const TEST_ROOM_CODE = "ZZZZZ";
export const TEST_ROOM_BOTS = 3;

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 5;

/** Cards per player by player count. Leftover prefectures are not used. */
export const DECK_SIZE: Record<number, number> = { 2: 15, 3: 12, 4: 10, 5: 8 };
export const OFFER_SIZE = 3;
