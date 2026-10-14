import { PREF_COUNT } from "./prefectures";
import { RANKINGS, ranksOf, type Ranking } from "./rankings";
import {
  DECK_SIZE,
  MAX_PLAYERS,
  MIN_PLAYERS,
  OFFER_SIZE,
  type ClientRoom,
  type Play,
  type Player,
  type RankingHead,
  type RoomSettings,
  type RoomState,
} from "./types";

export class GameError extends Error {}

const ALL_PREFS = Array.from({ length: PREF_COUNT }, (_, i) => i);

function randInt(n: number): number {
  return Math.floor(Math.random() * n);
}

function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function makeCode(): string {
  // No Z, so a real room can never collide with the test code.
  const letters = "ABCDEFGHJKLMNPQRSTUVWXY";
  return Array.from({ length: 5 }, () => letters[randInt(letters.length)]).join("");
}

function newPlayer(id: string, name: string, isHost: boolean, isBot = false): Player {
  return { id, name, connected: true, isHost, isBot, hand: [], offer: [], choice: null, ready: false, score: 0 };
}

function getPlayer(room: RoomState, playerId: string): Player {
  const player = room.players.find((p) => p.id === playerId);
  if (!player) throw new GameError("このプレイヤーは部屋にいません");
  return player;
}

function requireHost(room: RoomState, playerId: string): void {
  if (!getPlayer(room, playerId).isHost) throw new GameError("ホストだけができる操作です");
}

function requirePlaying(room: RoomState): void {
  if (room.phase !== "playing") throw new GameError("ゲーム中ではありません");
}

// ---------- lobby ----------

export function createRoom(hostId: string, name: string, isTest = false): RoomState {
  return {
    code: makeCode(),
    isTest,
    phase: "lobby",
    players: [newPlayer(hostId, name, true)],
    settings: { buildMode: "random" },
    game: 0,
    stage: "build",
    buildMode: "choice3",
    deckSize: 0,
    order: [],
    picks: 0,
    pool: [],
    rankings: [],
    round: 0,
    results: [],
    createdAt: Date.now(),
  };
}

export function addPlayer(room: RoomState, playerId: string, name: string): RoomState {
  if (room.phase !== "lobby") throw new GameError("ゲームはすでに始まっています");
  if (room.players.length >= MAX_PLAYERS) throw new GameError("部屋が満員です");
  room.players.push(newPlayer(playerId, name, false));
  return room;
}

export function removePlayer(room: RoomState, playerId: string): RoomState {
  room.players = room.players.filter((p) => p.id !== playerId);
  if (!room.players.some((p) => p.isHost)) {
    const next = room.players.find((p) => !p.isBot);
    if (next) next.isHost = true;
  }
  return room;
}

export function markConnection(room: RoomState, playerId: string, connected: boolean): RoomState {
  getPlayer(room, playerId).connected = connected;
  return room;
}

export function addBot(room: RoomState, hostId: string): RoomState {
  requireHost(room, hostId);
  if (!room.isTest) throw new GameError("ボットはテスト部屋でだけ使えます");
  if (room.phase !== "lobby") throw new GameError("ゲームはすでに始まっています");
  if (room.players.length >= MAX_PLAYERS) throw new GameError("部屋が満員です");
  const used = new Set(room.players.map((p) => p.name));
  const name = ["ボットA", "ボットB", "ボットC", "ボットD"].find((n) => !used.has(n)) ?? "ボット";
  room.players.push(newPlayer(`bot-${Date.now()}-${randInt(1e6)}`, name, false, true));
  return room;
}

export function removeBot(room: RoomState, hostId: string, botId: string): RoomState {
  requireHost(room, hostId);
  if (room.phase !== "lobby") throw new GameError("ゲームはすでに始まっています");
  room.players = room.players.filter((p) => !(p.isBot && p.id === botId));
  return room;
}

export function updateSettings(room: RoomState, hostId: string, settings: Partial<RoomSettings>): RoomState {
  requireHost(room, hostId);
  if (room.phase !== "lobby") throw new GameError("ゲームはすでに始まっています");
  if (settings.buildMode && ["random", "choice3", "draft"].includes(settings.buildMode)) {
    room.settings.buildMode = settings.buildMode;
  }
  return room;
}

// ---------- start ----------

export function startGame(room: RoomState, hostId: string): RoomState {
  requireHost(room, hostId);
  if (room.phase !== "lobby") throw new GameError("ゲームはすでに始まっています");
  const count = room.players.length;
  if (count < MIN_PLAYERS) throw new GameError(`開始には${MIN_PLAYERS}人以上必要です`);

  for (const p of room.players) {
    p.hand = [];
    p.offer = [];
    p.choice = null;
    p.ready = false;
    p.score = 0;
  }
  const mode = room.settings.buildMode;
  room.buildMode = mode === "random" ? (Math.random() < 0.5 ? "choice3" : "draft") : mode;
  room.deckSize = DECK_SIZE[count];
  room.phase = "playing";
  room.game += 1;
  room.stage = "build";
  room.order = shuffle(room.players.map((p) => p.id));
  room.picks = 0;
  room.pool = [...ALL_PREFS];
  room.rankings = shuffle(RANKINGS.map((_, i) => i)).slice(0, room.deckSize);
  room.round = 0;
  room.results = [];
  if (room.buildMode === "choice3") refillOffers(room);
  return room;
}

export function playAgain(room: RoomState, hostId: string): RoomState {
  requireHost(room, hostId);
  if (room.phase !== "gameover") throw new GameError("ゲームはまだ終わっていません");
  room.phase = "lobby";
  return startGame(room, hostId);
}

export function backToLobby(room: RoomState, hostId: string): RoomState {
  requireHost(room, hostId);
  if (room.phase !== "gameover") throw new GameError("ゲームはまだ終わっていません");
  room.phase = "lobby";
  return room;
}

// ---------- deck building ----------

function needsCards(room: RoomState, p: Player): boolean {
  return p.hand.length < room.deckSize;
}

/**
 * 3-choice building runs for everyone at once. Each player waiting for an offer
 * gets up to 3 prefectures from the pool, so offers never overlap. A player can
 * briefly get nothing near the end while others hold the last offers; they get
 * one as soon as someone picks and returns their other candidates.
 */
function refillOffers(room: RoomState): void {
  for (const p of shuffle(room.players)) {
    if (p.offer.length || !needsCards(room, p)) continue;
    const pool = shuffle(room.pool);
    p.offer = pool.slice(0, OFFER_SIZE);
    room.pool = pool.slice(OFFER_SIZE);
  }
}

export function draftTurn(room: RoomState): string | null {
  if (room.phase !== "playing" || room.stage !== "build" || room.buildMode !== "draft") return null;
  return room.order[room.picks % room.order.length];
}

function buildDone(room: RoomState): boolean {
  return room.players.every((p) => !needsCards(room, p));
}

export function pickCard(room: RoomState, playerId: string, pref: number): RoomState {
  requirePlaying(room);
  if (room.stage !== "build") throw new GameError("デッキ構築は終わっています");
  const p = getPlayer(room, playerId);
  if (!needsCards(room, p)) throw new GameError("デッキはもう完成しています");

  if (room.buildMode === "choice3") {
    if (!p.offer.includes(pref)) throw new GameError("その都道府県は候補にありません");
    p.hand.push(pref);
    room.pool.push(...p.offer.filter((x) => x !== pref));
    p.offer = [];
    refillOffers(room);
  } else {
    if (draftTurn(room) !== playerId) throw new GameError("あなたの番ではありません");
    if (!room.pool.includes(pref)) throw new GameError("その都道府県はもう選ばれています");
    p.hand.push(pref);
    room.pool = room.pool.filter((x) => x !== pref);
    room.picks += 1;
  }
  if (buildDone(room)) startPlay(room);
  return room;
}

function startPlay(room: RoomState): void {
  for (const p of room.players) {
    p.offer = [];
    p.hand.sort((a, b) => a - b);
  }
  room.stage = "play";
  room.round = 1;
}

// ---------- rounds ----------

function currentRanking(room: RoomState): Ranking {
  return RANKINGS[room.rankings[room.round - 1]];
}

export function submitCard(room: RoomState, playerId: string, pref: number): RoomState {
  requirePlaying(room);
  if (room.stage !== "play") throw new GameError("今はカードを出せません");
  const p = getPlayer(room, playerId);
  if (!p.hand.includes(pref)) throw new GameError("その都道府県は手札にありません");
  p.choice = pref;
  if (room.players.every((q) => q.choice !== null)) resolveRound(room);
  return room;
}

export function cancelCard(room: RoomState, playerId: string): RoomState {
  requirePlaying(room);
  if (room.stage !== "play") throw new GameError("今は取り消せません");
  getPlayer(room, playerId).choice = null;
  return room;
}

/**
 * Each player scores the gap between their national rank and the next lower
 * rank among the cards played. Equal ranks score against the next different
 * rank; the lowest (and anyone tied with it) scores 0.
 */
export function scorePlays(ranks: number[]): number[] {
  return ranks.map((r) => {
    const lower = ranks.filter((x) => x > r);
    return lower.length ? Math.min(...lower) - r : 0;
  });
}

function resolveRound(room: RoomState): void {
  const ranking = currentRanking(room);
  const ranks = ranksOf(ranking);
  const played = room.players.map((p) => ({ playerId: p.id, pref: p.choice!, rank: ranks[p.choice!], value: ranking.values[p.choice!] }));
  const points = scorePlays(played.map((x) => x.rank));
  const plays: Play[] = played.map((x, i) => ({ ...x, points: points[i] })).sort((a, b) => a.rank - b.rank);
  for (const p of room.players) {
    p.score += plays.find((x) => x.playerId === p.id)!.points;
    p.hand = p.hand.filter((x) => x !== p.choice);
    p.choice = null;
    p.ready = false;
  }
  room.results.push({ round: room.round, ranking: room.rankings[room.round - 1], plays });
  room.stage = "result";
}

/** 次へ on the result screen. The next round starts once everyone has pressed it. */
export function pressNext(room: RoomState, playerId: string): RoomState {
  requirePlaying(room);
  if (room.stage !== "result") throw new GameError("今は進めません");
  getPlayer(room, playerId).ready = true;
  if (room.players.every((p) => p.ready)) nextRound(room);
  return room;
}

function nextRound(room: RoomState): void {
  for (const p of room.players) p.ready = false;
  if (room.round >= room.deckSize) {
    room.phase = "gameover";
    return;
  }
  room.round += 1;
  room.stage = "play";
}

/** Host moves the game on for players who are away: a random pick, a random card, or 次へ. */
export function hostSkip(room: RoomState, hostId: string): RoomState {
  requireHost(room, hostId);
  requirePlaying(room);
  if (room.stage === "build") {
    if (room.buildMode === "draft") {
      pickCard(room, draftTurn(room)!, room.pool[randInt(room.pool.length)]);
    } else {
      for (const p of room.players) {
        if (room.stage === "build" && p.offer.length) pickCard(room, p.id, p.offer[randInt(p.offer.length)]);
      }
    }
  } else if (room.stage === "play") {
    for (const p of room.players) p.choice ??= p.hand[randInt(p.hand.length)];
    resolveRound(room);
  } else {
    nextRound(room);
  }
  return room;
}

// ---------- view ----------

function headOf(r: Ranking): RankingHead {
  return { title: r.title, cat: r.cat, unit: r.unit, dir: r.dir, year: r.year, source: r.source, note: r.note };
}

/** The room as one player is allowed to see it: no ranking values before the reveal. */
export function viewFor(room: RoomState, playerId: string): ClientRoom {
  const me = room.players.find((p) => p.id === playerId);
  const playing = room.phase !== "lobby";
  const building = playing && room.stage === "build";
  const last = room.results[room.results.length - 1];
  const showReveal = playing && (room.stage === "result" || room.phase === "gameover") && last;
  const lastRanking = last ? RANKINGS[last.ranking] : null;

  let owners: (string | null)[] | null = null;
  if (building && room.buildMode === "draft") {
    owners = ALL_PREFS.map(() => null);
    for (const p of room.players) for (const x of p.hand) owners[x] = p.id;
  }

  return {
    code: room.code,
    isTest: room.isTest,
    phase: room.phase,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
      isHost: p.isHost,
      isBot: p.isBot,
      score: p.score,
      done: building ? !needsCards(room, p) : room.stage === "play" ? p.choice !== null : p.ready,
    })),
    settings: room.settings,
    game: room.game,
    stage: room.stage,
    buildMode: room.buildMode,
    deckSize: room.deckSize,
    round: room.round,
    totalRounds: room.deckSize,
    owners,
    turn: draftTurn(room),
    me: me && playing ? { hand: me.hand, offer: me.offer, choice: me.choice } : null,
    ranking: playing && room.round > 0 ? headOf(currentRanking(room)) : null,
    reveal: showReveal ? { plays: last.plays, values: lastRanking!.values, ranks: ranksOf(lastRanking!) } : null,
    history:
      room.phase === "gameover"
        ? room.results.map((r) => ({ round: r.round, ranking: headOf(RANKINGS[r.ranking]), plays: r.plays }))
        : null,
  };
}

// ---------- bots ----------

/** The bot that should act next in a test room, if any. */
export function pendingBot(room: RoomState): Player | undefined {
  if (room.phase !== "playing") return undefined;
  if (room.stage === "build") {
    if (room.buildMode === "draft") return room.players.find((p) => p.isBot && p.id === draftTurn(room));
    return room.players.find((p) => p.isBot && p.offer.length > 0);
  }
  if (room.stage === "play") return room.players.find((p) => p.isBot && p.choice === null);
  return room.players.find((p) => p.isBot && !p.ready);
}

/** Simple bots: random picks while building; in a round, often the best card for the ranking. */
export function botAct(room: RoomState, botId: string): RoomState {
  const bot = getPlayer(room, botId);
  if (room.stage === "build") {
    const from = room.buildMode === "draft" ? room.pool : bot.offer;
    return pickCard(room, botId, from[randInt(from.length)]);
  }
  if (room.stage === "play") {
    const ranks = ranksOf(currentRanking(room));
    const best = [...bot.hand].sort((a, b) => ranks[a] - ranks[b])[0];
    return submitCard(room, botId, Math.random() < 0.5 ? best : bot.hand[randInt(bot.hand.length)]);
  }
  return pressNext(room, botId);
}
