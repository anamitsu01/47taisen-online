"use client";

import { useEffect, useState } from "react";
import { PREFECTURES, REGIONS, regionOf } from "@/lib/prefectures";
import type { ClientToServerEvents } from "@/lib/socketEvents";
import type { ClientPlayer, ClientRoom, Play, RankingHead } from "@/lib/types";

type Act = <E extends keyof ClientToServerEvents>(
  event: E,
  payload: Omit<Parameters<ClientToServerEvents[E]>[0], "code">
) => Promise<string | null>;

const PLAYER_COLORS = ["#ef3a52", "#5aa9e6", "#7bc96f", "#f4c95d", "#b08ee8"];

const primaryBtn =
  "rounded-full bg-tk-red px-6 py-2.5 font-bold text-white hover:bg-tk-red-bright disabled:cursor-not-allowed disabled:opacity-40";
const ghostBtn = "rounded-full border border-white/15 px-4 py-2 text-sm text-white/70 hover:bg-white/10";

function fmt(v: number): string {
  return v.toLocaleString("ja-JP", { maximumFractionDigits: 2 });
}

function withUnit(v: number, unit: string): string {
  return `${fmt(v)}${unit ? ` ${unit}` : ""}`;
}

function Panel({ title, children, className = "" }: { title?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-white/10 bg-panel/80 p-4 ${className}`}>
      {title && <h2 className="mb-3 text-sm font-bold text-white/60">{title}</h2>}
      {children}
    </section>
  );
}

/** The prefecture's character illustration (public/chara/01.webp = 北海道 … 47.webp = 沖縄県). */
function Chara({ pref, className = "" }: { pref: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small static files, no optimisation needed
    <img
      src={`/chara/${String(pref + 1).padStart(2, "0")}.webp`}
      alt=""
      draggable={false}
      decoding="async"
      className={`pointer-events-none select-none object-contain ${className}`}
    />
  );
}

/** A prefecture card: region colour stripe on top, name in the middle. Large cards also show the character. */
function PrefCard({
  pref,
  selected = false,
  disabled = false,
  owner,
  onClick,
  size = "md",
}: {
  pref: number;
  selected?: boolean;
  disabled?: boolean;
  owner?: { name: string; color: string } | null;
  onClick?: () => void;
  size?: "sm" | "md" | "lg";
}) {
  const region = regionOf(pref);
  const name = PREFECTURES[pref];
  const sizing =
    size === "lg" ? "h-56 text-xl sm:h-64 sm:text-2xl" : size === "sm" ? "h-14 text-xs" : "h-20 text-base";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      className={`relative flex w-full flex-col overflow-hidden rounded-lg border text-center font-bold transition ${sizing} ${
        selected
          ? "border-tk-gold bg-tk-gold/15 ring-2 ring-tk-gold"
          : owner
            ? "border-white/5 bg-white/[0.02] text-white/35"
            : "border-white/15 bg-white/[0.06] enabled:hover:-translate-y-0.5 enabled:hover:bg-white/10"
      } disabled:cursor-default`}
    >
      <span className="h-1.5 w-full shrink-0" style={{ background: region.color, opacity: owner ? 0.35 : 1 }} />
      {size === "lg" ? (
        <>
          <span className="relative min-h-0 flex-1">
            <Chara pref={pref} className="absolute inset-0 h-full w-full p-1" />
          </span>
          <span className="shrink-0 bg-black/40 px-1 py-1.5 leading-tight">{name}</span>
        </>
      ) : (
        <span className="flex flex-1 items-center justify-center px-1 leading-tight">{name}</span>
      )}
      {owner && (
        <span className="mb-1 truncate px-1 text-[10px] font-semibold" style={{ color: owner.color }}>
          {owner.name}
        </span>
      )}
    </button>
  );
}

function Scoreboard({ room, viewerId }: { room: ClientRoom; viewerId: string }) {
  const doneLabel = room.stage === "build" ? "完成" : room.stage === "play" ? "決定" : "次へ";
  return (
    <div className="flex flex-wrap gap-2">
      {room.players.map((p, i) => {
        const isTurn = room.turn === p.id;
        return (
          <div
            key={p.id}
            className={`flex min-w-[8rem] flex-1 items-center gap-2 rounded-lg border px-3 py-2 ${
              isTurn ? "border-tk-gold bg-tk-gold/10" : "border-white/10 bg-white/5"
            } ${p.connected ? "" : "opacity-50"}`}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PLAYER_COLORS[i % PLAYER_COLORS.length] }} />
            <span className="min-w-0 flex-1 truncate text-sm">
              {p.name}
              {p.isBot && " 🤖"}
              {p.id === viewerId && <span className="ml-1 text-xs text-white/40">(あなた)</span>}
            </span>
            {room.phase === "playing" && room.stage !== "build" && (
              <span className={`text-xs ${p.done ? "text-tk-gold" : "text-white/30"}`}>{p.done ? `✓${doneLabel}` : "…"}</span>
            )}
            {room.phase === "playing" && room.stage === "build" && room.buildMode === "choice3" && (
              <span className={`text-xs ${p.done ? "text-tk-gold" : "text-white/30"}`}>{p.done ? "✓完成" : "選択中"}</span>
            )}
            {isTurn && <span className="text-xs font-bold text-tk-gold">選択中</span>}
            <span className="w-12 text-right font-black tabular-nums text-tk-gold">{p.score}点</span>
          </div>
        );
      })}
    </div>
  );
}

function HostSkip({ room, viewerId, act }: { room: ClientRoom; viewerId: string; act: Act }) {
  const [error, setError] = useState<string | null>(null);
  const me = room.players.find((p) => p.id === viewerId);
  const waitingOnAway =
    room.stage === "build" && room.buildMode === "draft"
      ? room.players.some((p) => p.id === room.turn && !p.connected)
      : room.players.some((p) => !p.done && !p.connected);
  if (!me?.isHost || room.phase !== "playing" || !waitingOnAway) return null;
  const label = room.stage === "result" ? "切断中の人を待たずに次へ" : "切断中の人の分をランダムで決める";
  return (
    <div className="text-center">
      <button onClick={async () => setError(await act("game:hostSkip", {}))} className={ghostBtn}>
        {label}
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}

// ---------- deck building ----------

function BuildChoice3({ room, act }: { room: ClientRoom; act: Act }) {
  const me = room.me!;
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const done = me.hand.length >= room.deckSize;
  const current = selected !== null && me.offer.includes(selected) ? selected : null;

  async function pick() {
    if (current === null) return;
    const err = await act("game:pick", { pref: current });
    setError(err);
    if (!err) setSelected(null);
  }

  return (
    <div className="space-y-4">
      <Panel>
        <p className="mb-1 text-center text-xs tracking-[0.3em] text-white/50">デッキ作り · 3択</p>
        <h2 className="mb-4 text-center text-xl font-bold">
          {done ? "デッキ完成! ほかの人を待っています…" : `3県から1県を選んでください (${me.hand.length + 1}/${room.deckSize}枚目)`}
        </h2>
        {!done && me.offer.length === 0 && <p className="text-center text-white/50">候補を準備中…</p>}
        {!done && me.offer.length > 0 && (
          <>
            <div key={me.offer.join(",")} className="tk-pop mx-auto grid max-w-2xl grid-cols-3 gap-2 sm:gap-3">
              {me.offer.map((pref) => (
                <PrefCard key={pref} pref={pref} size="lg" selected={current === pref} onClick={() => setSelected(pref)} />
              ))}
            </div>
            <div className="mt-4 text-center">
              <button onClick={pick} disabled={current === null} className={primaryBtn}>
                {current === null ? "カードを選んでください" : `${PREFECTURES[current]}をデッキに入れる`}
              </button>
            </div>
          </>
        )}
        {error && <p className="mt-2 text-center text-sm text-red-400">{error}</p>}
        <p className="mt-4 text-center text-xs text-white/40">ほかの人が選んだ県は見えません。どんなランキングが出るかもわかりません。</p>
      </Panel>
      <MyDeck hand={me.hand} deckSize={room.deckSize} />
    </div>
  );
}

function BuildDraft({ room, viewerId, act }: { room: ClientRoom; viewerId: string; act: Act }) {
  const me = room.me!;
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const owners = room.owners ?? [];
  const myTurn = room.turn === viewerId;
  const turnName = room.players.find((p) => p.id === room.turn)?.name ?? "";
  const current = selected !== null && !owners[selected] ? selected : null;
  const ownerOf = (pref: number) => {
    const id = owners[pref];
    if (!id) return null;
    const i = room.players.findIndex((p) => p.id === id);
    return { name: room.players[i]?.name ?? "", color: PLAYER_COLORS[i % PLAYER_COLORS.length] };
  };

  async function pick() {
    if (current === null) return;
    const err = await act("game:pick", { pref: current });
    setError(err);
    if (!err) setSelected(null);
  }

  return (
    <div className="space-y-4">
      <Panel>
        <p className="mb-1 text-center text-xs tracking-[0.3em] text-white/50">デッキ作り · ドラフト</p>
        <h2 className={`mb-1 text-center text-xl font-bold ${myTurn ? "text-tk-gold" : ""}`}>
          {myTurn ? `あなたの番です (${me.hand.length + 1}/${room.deckSize}枚目)` : `${turnName}さんが選んでいます…`}
        </h2>
        <p className="mb-4 text-center text-xs text-white/40">順番に1県ずつ選びます。誰が何を取ったかは全員に見えます。</p>
        <div className="space-y-3">
          {REGIONS.map((r) => (
            <div key={r.name}>
              <p className="mb-1 text-xs font-bold" style={{ color: r.color }}>
                {r.name}
              </p>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-9">
                {Array.from({ length: r.to - r.from + 1 }, (_, k) => r.from + k).map((pref) => {
                  const owner = ownerOf(pref);
                  return (
                    <PrefCard
                      key={pref}
                      pref={pref}
                      size="sm"
                      owner={owner}
                      selected={current === pref}
                      onClick={myTurn && !owner ? () => setSelected(pref) : undefined}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {myTurn && (
          <div className="sticky bottom-3 mt-4 text-center">
            <button onClick={pick} disabled={current === null} className={`${primaryBtn} shadow-lg shadow-black/50`}>
              {current === null ? "都道府県を選んでください" : `${PREFECTURES[current]}を取る`}
            </button>
          </div>
        )}
        {error && <p className="mt-2 text-center text-sm text-red-400">{error}</p>}
      </Panel>
      <MyDeck hand={me.hand} deckSize={room.deckSize} />
    </div>
  );
}

function MyDeck({ hand, deckSize }: { hand: number[]; deckSize: number }) {
  return (
    <Panel title={`あなたのデッキ ${hand.length}/${deckSize}`}>
      {hand.length === 0 ? (
        <p className="text-sm text-white/40">まだありません</p>
      ) : (
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-8">
          {[...hand]
            .sort((a, b) => a - b)
            .map((pref) => (
              <PrefCard key={pref} pref={pref} size="sm" />
            ))}
        </div>
      )}
    </Panel>
  );
}

// ---------- rounds ----------

function RankingBanner({ room, ranking }: { room: ClientRoom; ranking: RankingHead }) {
  return (
    <div className="tk-pop rounded-xl border border-tk-red/40 bg-gradient-to-b from-tk-red/20 to-transparent px-4 py-5 text-center">
      <p className="mb-2 text-xs tracking-[0.3em] text-white/50">
        ROUND {room.round} / {room.totalRounds}
      </p>
      <span className="mb-2 inline-block rounded-full border border-white/15 px-3 py-0.5 text-xs text-white/60">{ranking.cat}</span>
      <h2 className="text-2xl font-black leading-snug sm:text-3xl">
        {ranking.title}
        <span className="text-white/60">都道府県</span>
      </h2>
      {ranking.note && <p className="mt-2 text-xs text-white/45">※{ranking.note}</p>}
    </div>
  );
}

function PlayStage({ room, act }: { room: ClientRoom; act: Act }) {
  const me = room.me!;
  const ranking = room.ranking!;
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = selected !== null && me.hand.includes(selected) ? selected : null;
  const waiting = room.players.filter((p) => !p.done).length;

  return (
    <div className="space-y-4">
      <RankingBanner room={room} ranking={ranking} />
      <Panel>
        {me.choice !== null ? (
          <div className="text-center">
            <p className="mb-3 text-white/60">あなたが出すカード</p>
            <div className="mx-auto mb-4 w-44 sm:w-52">
              <PrefCard pref={me.choice} size="lg" selected />
            </div>
            <p className="mb-3 text-sm text-white/50">ほかの人を待っています… (あと{waiting}人)</p>
            <button
              onClick={async () => setError(await act("game:cancel", {}))}
              className={ghostBtn}
            >
              選び直す
            </button>
          </div>
        ) : (
          <>
            <h3 className="mb-3 text-center font-bold">手札から1枚選んでください</h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {me.hand.map((pref) => (
                <PrefCard key={pref} pref={pref} selected={current === pref} onClick={() => setSelected(pref)} />
              ))}
            </div>
            <div className="mt-4 text-center">
              <button
                onClick={async () => {
                  if (current === null) return;
                  const err = await act("game:submit", { pref: current });
                  setError(err);
                  if (!err) setSelected(null);
                }}
                disabled={current === null}
                className={primaryBtn}
              >
                {current === null ? "カードを選んでください" : `${PREFECTURES[current]}で勝負!`}
              </button>
            </div>
          </>
        )}
        {error && <p className="mt-2 text-center text-sm text-red-400">{error}</p>}
      </Panel>
    </div>
  );
}

function PlayRows({ plays, players, unit }: { plays: Play[]; players: ClientPlayer[]; unit: string }) {
  return (
    <div className="space-y-2">
      {plays.map((x, i) => {
        const idx = players.findIndex((p) => p.id === x.playerId);
        return (
          <div
            key={x.playerId}
            className="tk-flip flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-2 sm:gap-3 sm:px-3"
            style={{ animationDelay: `${i * 0.35}s` }}
          >
            <span className="w-10 shrink-0 whitespace-nowrap text-center font-black text-white/80 sm:w-12 sm:text-lg">{x.rank}位</span>
            <span
              className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-b-4 bg-white/5 sm:h-20 sm:w-20"
              style={{ borderColor: regionOf(x.pref).color }}
            >
              <Chara pref={x.pref} className="h-full w-full" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="whitespace-nowrap font-bold sm:text-lg">{PREFECTURES[x.pref]}</p>
              <p className="truncate text-xs" style={{ color: PLAYER_COLORS[idx % PLAYER_COLORS.length] }}>
                {players[idx]?.name}
              </p>
              <p className="truncate text-xs tabular-nums text-white/60 sm:hidden">{withUnit(x.value, unit)}</p>
            </div>
            <span className="hidden text-right text-sm tabular-nums text-white/70 sm:block">{withUnit(x.value, unit)}</span>
            <span className={`w-12 shrink-0 text-right text-lg font-black tabular-nums sm:w-14 ${x.points > 0 ? "text-tk-gold" : "text-white/30"}`}>
              +{x.points}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function FullRanking({ room, ranking }: { room: ClientRoom; ranking: RankingHead }) {
  const reveal = room.reveal!;
  const played = new Map(reveal.plays.map((x) => [x.pref, x.playerId]));
  const order = reveal.ranks.map((rank, pref) => ({ rank, pref })).sort((a, b) => a.rank - b.rank || a.pref - b.pref);
  return (
    <details open className="rounded-xl border border-white/10 bg-panel/80 p-4">
      <summary className="cursor-pointer text-sm font-bold text-white/60">47都道府県の全順位</summary>
      <ol className="mt-3 gap-x-6 space-y-0.5 text-sm sm:columns-2">
        {order.map(({ rank, pref }) => {
          const owner = played.get(pref);
          const idx = owner ? room.players.findIndex((p) => p.id === owner) : -1;
          return (
            <li
              key={pref}
              className={`flex break-inside-avoid items-center gap-2 rounded px-2 py-0.5 ${owner ? "bg-tk-gold/15 font-bold" : ""}`}
            >
              <span className="w-9 shrink-0 text-right tabular-nums text-white/50">{rank}位</span>
              <span className="h-3 w-1 shrink-0 rounded" style={{ background: regionOf(pref).color }} />
              <span className="min-w-0 flex-1 truncate">
                {PREFECTURES[pref]}
                {owner && (
                  <span className="ml-2 text-xs" style={{ color: PLAYER_COLORS[idx % PLAYER_COLORS.length] }}>
                    ← {room.players[idx]?.name}
                  </span>
                )}
              </span>
              <span className="shrink-0 tabular-nums text-white/60">{withUnit(reveal.values[pref], ranking.unit)}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-xs text-white/40">
        出典: {ranking.source}({ranking.year}) · {ranking.dir === "desc" ? "数値が大きいほど上位" : "数値が小さいほど上位"}
        {ranking.note && ` · ${ranking.note}`}
      </p>
    </details>
  );
}

function ResultStage({ room, viewerId, act }: { room: ClientRoom; viewerId: string; act: Act }) {
  const ranking = room.ranking!;
  const reveal = room.reveal!;
  const [error, setError] = useState<string | null>(null);
  const meDone = room.players.find((p) => p.id === viewerId)?.done;
  // Play the reveal once per round; someone who already pressed 次へ (e.g. after a reload) skips it.
  const [showReveal, setShowReveal] = useState(!meDone);
  const waiting = room.players.filter((p) => !p.done).length;
  const last = room.round >= room.totalRounds;

  return (
    <div className="space-y-4">
      {showReveal && <RevealOverlay room={room} ranking={ranking} onClose={() => setShowReveal(false)} />}
      <RankingBanner room={room} ranking={ranking} />
      <Panel title="結果">
        <PlayRows plays={reveal.plays} players={room.players} unit={ranking.unit} />
        <div className="mt-4 text-center">
          {meDone ? (
            <p className="text-sm text-white/50">ほかの人を待っています… (あと{waiting}人)</p>
          ) : (
            <button onClick={async () => setError(await act("game:next", {}))} className={primaryBtn}>
              {last ? "最終結果へ" : "次へ"}
            </button>
          )}
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        </div>
      </Panel>
      <FullRanking room={room} ranking={ranking} />
    </div>
  );
}

// ---------- reveal show ----------

const FLIP_START_MS = 700;
const FLIP_EACH_MS = 900;
const MVP_PAUSE_MS = 900;
const MVP_SHOW_MS = 4500;

/**
 * Full-screen reveal: the played cards lie face down in seat order and flip one
 * by one from the lowest national rank to the highest, then the round MVP (most
 * points) takes the stage with its character. Tap or スキップ to close early.
 */
function RevealOverlay({ room, ranking, onClose }: { room: ClientRoom; ranking: RankingHead; onClose: () => void }) {
  const plays = room.reveal!.plays;
  const flipOrder = [...plays].reverse().map((x) => x.playerId);
  const [flipped, setFlipped] = useState(0);
  const [stage, setStage] = useState<"flip" | "mvp">("flip");
  const best = Math.max(...plays.map((x) => x.points));
  const mvps = best > 0 ? plays.filter((x) => x.points === best) : [];

  useEffect(() => {
    const timers = flipOrder.map((_, i) => setTimeout(() => setFlipped(i + 1), FLIP_START_MS + i * FLIP_EACH_MS));
    const flipEnd = FLIP_START_MS + flipOrder.length * FLIP_EACH_MS;
    if (mvps.length) {
      timers.push(setTimeout(() => setStage("mvp"), flipEnd + MVP_PAUSE_MS));
      timers.push(setTimeout(onClose, flipEnd + MVP_PAUSE_MS + MVP_SHOW_MS));
    } else {
      timers.push(setTimeout(onClose, flipEnd + 2000));
    }
    return () => timers.forEach(clearTimeout);
    // Runs once per round: the overlay is remounted for each round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seat = (playerId: string) => room.players.findIndex((p) => p.id === playerId);

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center overflow-y-auto bg-black/85 px-3 py-6 backdrop-blur-sm"
      onClick={stage === "mvp" ? onClose : undefined}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute right-3 top-3 rounded-full border border-white/20 px-4 py-1.5 text-sm text-white/70 hover:bg-white/10"
      >
        スキップ
      </button>

      <p className="mb-1 text-xs tracking-[0.3em] text-white/50">
        ROUND {room.round} / {room.totalRounds}
      </p>
      <h2 className="mb-5 px-10 text-center text-xl font-black sm:text-2xl">
        {ranking.title}
        <span className="text-white/60">都道府県</span>
      </h2>

      {stage === "flip" ? (
        <div className="flex w-full max-w-4xl flex-wrap justify-center gap-2 sm:gap-4">
          {room.players.map((p) => {
            const play = plays.find((x) => x.playerId === p.id)!;
            const open = flipOrder.indexOf(p.id) < flipped;
            const color = PLAYER_COLORS[seat(p.id) % PLAYER_COLORS.length];
            return (
              <div key={p.id} className="w-[30%] max-w-[180px] sm:w-[18%]">
                <p className="mb-1 truncate text-center text-xs font-bold sm:text-sm" style={{ color }}>
                  {p.name}
                </p>
                {open ? (
                  <div className="tk-flip overflow-hidden rounded-xl border-2 border-white/20 bg-panel">
                    <div className="h-1.5" style={{ background: regionOf(play.pref).color }} />
                    <div className="relative aspect-square">
                      <Chara pref={play.pref} className="absolute inset-0 h-full w-full p-1" />
                    </div>
                    <div className="bg-black/40 px-1 py-1.5 text-center">
                      <p className="truncate text-sm font-bold sm:text-base">{PREFECTURES[play.pref]}</p>
                      <p className="text-lg font-black text-tk-gold sm:text-2xl">{play.rank}位</p>
                      <p className="truncate text-[10px] tabular-nums text-white/60 sm:text-xs">{withUnit(play.value, ranking.unit)}</p>
                    </div>
                  </div>
                ) : (
                  // Same box as the face-up card (stripe + square + caption) so nothing jumps on the flip.
                  <div className="relative overflow-hidden rounded-xl border-2 border-tk-red/60 bg-gradient-to-br from-tk-red/70 to-[#5c0f1c] shadow-lg">
                    <div className="invisible">
                      <div className="h-1.5" />
                      <div className="aspect-square" />
                      <div className="px-1 py-1.5 text-center">
                        <p className="text-sm sm:text-base">-</p>
                        <p className="text-lg sm:text-2xl">-</p>
                        <p className="text-[10px] sm:text-xs">-</p>
                      </div>
                    </div>
                    <span className="absolute inset-0 flex items-center justify-center text-center text-sm font-black leading-tight text-white/80 sm:text-lg">
                      都道府県
                      <br />
                      大戦
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="tk-pop flex flex-col items-center">
          <p className="mb-2 text-lg font-black tracking-[0.4em] text-tk-gold sm:text-2xl">ラウンドMVP</p>
          <div className="flex flex-wrap justify-center gap-4">
            {mvps.map((m) => (
              <div key={m.playerId} className="flex flex-col items-center">
                <div className="relative h-[46vh] max-h-[460px] w-[46vh] max-w-[90vw]">
                  <div className="absolute inset-[8%] rounded-full bg-tk-gold/25 blur-3xl" />
                  <Chara pref={m.pref} className="relative h-full w-full drop-shadow-[0_10px_30px_rgba(0,0,0,0.6)]" />
                </div>
                <p className="text-3xl font-black sm:text-4xl">{PREFECTURES[m.pref]}</p>
                <p className="mt-1 text-white/70">
                  全国{m.rank}位 ·{" "}
                  <span style={{ color: PLAYER_COLORS[seat(m.playerId) % PLAYER_COLORS.length] }}>
                    {room.players[seat(m.playerId)]?.name}
                  </span>
                </p>
                <p className="mt-1 text-5xl font-black text-tk-gold sm:text-6xl">+{m.points}点</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-white/40">タップで閉じる</p>
        </div>
      )}
    </div>
  );
}

// ---------- game over ----------

function GameOver({ room, viewerId, act }: { room: ClientRoom; viewerId: string; act: Act }) {
  const [error, setError] = useState<string | null>(null);
  const isHost = room.players.find((p) => p.id === viewerId)?.isHost;
  const standings = [...room.players].sort((a, b) => b.score - a.score);
  const top = standings[0]?.score;
  const nameOf = (id: string) => room.players.find((p) => p.id === id)?.name ?? "";

  return (
    <div className="space-y-4">
      <Panel className="tk-pop text-center">
        <p className="mb-1 text-xs tracking-[0.3em] text-white/50">FINAL RESULT</p>
        <h2 className="mb-4 text-3xl font-black">
          {standings.filter((p) => p.score === top).map((p) => p.name).join("・")}
          <span className="text-tk-gold"> の勝利!</span>
        </h2>
        <ol className="mx-auto max-w-sm space-y-1.5">
          {standings.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-lg bg-white/5 px-4 py-2">
              <span className="w-8 font-black text-white/60">{standings.findIndex((q) => q.score === p.score) + 1}位</span>
              <span className="flex-1 truncate text-left">{p.name}</span>
              <span className="font-black tabular-nums text-tk-gold">{p.score}点</span>
            </li>
          ))}
        </ol>
        {isHost ? (
          <div className="mt-5 flex justify-center gap-3">
            <button onClick={async () => setError(await act("game:playAgain", {}))} className={primaryBtn}>
              もう一度遊ぶ
            </button>
            <button onClick={async () => setError(await act("game:backToLobby", {}))} className={ghostBtn}>
              ロビーに戻る
            </button>
          </div>
        ) : (
          <p className="mt-5 text-sm text-white/50">ホストが次のゲームを始めるのを待っています…</p>
        )}
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </Panel>

      <Panel title="ふりかえり">
        <div className="space-y-3">
          {room.history?.map((h) => (
            <div key={h.round} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <p className="mb-1 text-sm font-bold">
                <span className="mr-2 text-white/40">R{h.round}</span>
                {h.ranking.title}都道府県
              </p>
              <p className="text-xs leading-relaxed text-white/60">
                {h.plays.map((x) => (
                  <span key={x.playerId} className="mr-3 inline-block">
                    {nameOf(x.playerId)}: {PREFECTURES[x.pref]}({x.rank}位) <b className="text-tk-gold">+{x.points}</b>
                  </span>
                ))}
              </p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ---------- board ----------

export default function GameBoard({ room, viewerId, act }: { room: ClientRoom; viewerId: string; act: Act }) {
  let body: React.ReactNode;
  if (room.phase === "gameover") body = <GameOver room={room} viewerId={viewerId} act={act} />;
  else if (!room.me) body = <p className="text-center text-white/50">読み込み中…</p>;
  else if (room.stage === "build")
    body =
      room.buildMode === "draft" ? (
        <BuildDraft key={room.game} room={room} viewerId={viewerId} act={act} />
      ) : (
        <BuildChoice3 key={room.game} room={room} act={act} />
      );
  else if (room.stage === "play") body = <PlayStage key={`${room.game}-${room.round}`} room={room} act={act} />;
  else body = <ResultStage key={`${room.game}-${room.round}`} room={room} viewerId={viewerId} act={act} />;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <Scoreboard room={room} viewerId={viewerId} />
      {body}
      <HostSkip room={room} viewerId={viewerId} act={act} />
    </div>
  );
}
