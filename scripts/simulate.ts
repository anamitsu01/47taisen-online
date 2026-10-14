// Plays bot-only games to check the engine runs to the end, and checks the scoring examples.
import assert from "node:assert/strict";
import { addBot, botAct, createRoom, pendingBot, scorePlays, startGame, updateSettings, viewFor } from "../lib/gameEngine";
import { RANKINGS } from "../lib/rankings";

assert.deepEqual(scorePlays([2, 3, 20, 35]), [1, 17, 15, 0]);
assert.deepEqual(scorePlays([5, 5, 20]), [15, 15, 0]);
assert.deepEqual(scorePlays([5, 15, 15]), [10, 0, 0]);
assert.deepEqual(scorePlays([1, 47]), [46, 0]);

const GAMES = Number(process.argv[2]) || 100;
for (const players of [2, 3, 4, 5]) {
  for (const mode of ["choice3", "draft"] as const) {
    let total = 0;
    for (let g = 0; g < GAMES; g++) {
      const room = createRoom("host", "ホスト", true);
      room.players[0].isBot = true;
      for (let i = 1; i < players; i++) addBot(room, "host");
      updateSettings(room, "host", { buildMode: mode });
      startGame(room, "host");
      let steps = 0;
      while (room.phase === "playing") {
        const bot = pendingBot(room);
        assert(bot, `stuck in ${room.stage}`);
        botAct(room, bot.id);
        assert(++steps < 10_000, "too many steps");
        // Decks never overlap.
        const all = room.players.flatMap((p) => [...p.hand, ...p.offer]);
        assert.equal(new Set(all).size, all.length);
      }
      assert.equal(room.results.length, room.deckSize);
      assert(room.players.every((p) => p.hand.length === 0));
      viewFor(room, "host");
      total += Math.max(...room.players.map((p) => p.score));
    }
    console.log(`${players}人 ${mode}: OK  勝者の平均点 ${(total / GAMES).toFixed(1)}`);
  }
}
console.log(`ランキング ${RANKINGS.length}種類`);
