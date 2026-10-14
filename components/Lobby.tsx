"use client";

import { useState } from "react";
import type { ClientRoom, RoomSettings } from "@/lib/types";
import { DECK_SIZE, MAX_PLAYERS, MIN_PLAYERS } from "@/lib/types";
import RulesPanel from "./RulesPanel";

export default function Lobby({
  room,
  viewerId,
  onStart,
  onSettings,
  onAddBot,
  onRemoveBot,
}: {
  room: ClientRoom;
  viewerId: string;
  onStart: () => Promise<string | null>;
  onSettings: (settings: Partial<RoomSettings>) => Promise<string | null>;
  onAddBot: () => Promise<string | null>;
  onRemoveBot: (botId: string) => Promise<string | null>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const me = room.players.find((p) => p.id === viewerId);
  const isHost = !!me?.isHost;
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/room/${room.code}` : "";
  const count = room.players.length;
  const mode = room.settings.buildMode;
  const startBlocker = count < MIN_PLAYERS ? `開始には${MIN_PLAYERS}人以上必要です(現在${count}人)` : null;
  const botControls = room.isTest && isHost;

  async function handleStart() {
    setStarting(true);
    const err = await onStart();
    setStarting(false);
    setError(err);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // clipboard unavailable; user can copy manually
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl text-center">
      <p className="mb-1 text-white/60">部屋コード</p>
      <div className="mb-4 flex items-center justify-center gap-3">
        <span className="pl-[0.3em] text-5xl font-black tracking-[0.3em]">
          <span className="text-tk-red-light">{room.code.slice(0, 3)}</span>
          <span className="text-tk-gold">{room.code.slice(3)}</span>
        </span>
      </div>
      <div className="mb-6 flex items-center justify-center gap-2">
        <input
          readOnly
          value={shareUrl}
          className="w-full max-w-sm rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70"
        />
        <button onClick={copyLink} className="whitespace-nowrap rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20">
          リンクをコピー
        </button>
      </div>

      {room.isTest && (
        <p className="mb-4 rounded-lg border border-tk-red-light/40 bg-tk-red/15 px-4 py-2 text-sm text-tk-red-light">
          🤖 テスト部屋: ボットが自動で相手をします。{isHost && "ボットの追加・削除ができます。"}
        </p>
      )}

      <ul className="mb-6 space-y-2 text-left">
        {room.players.map((p) => (
          <li key={p.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
            <span className={`min-w-0 flex-1 truncate ${p.connected ? "" : "opacity-40"}`}>
              {p.name}
              {p.isBot && " 🤖"}
              {p.isHost && <span className="ml-1 text-xs text-white/40">(ホスト)</span>}
            </span>
            {p.id === viewerId && <span className="shrink-0 text-xs text-white/40">(あなた)</span>}
            {botControls && p.isBot && (
              <button
                onClick={async () => setError(await onRemoveBot(p.id))}
                className="rounded border border-white/15 px-1.5 text-xs text-white/60 hover:bg-white/10"
                title="ボットを外す"
              >
                ×
              </button>
            )}
          </li>
        ))}
        {botControls && count < MAX_PLAYERS && (
          <li>
            <button
              onClick={async () => setError(await onAddBot())}
              className="w-full rounded-lg border border-dashed border-white/15 py-2 text-sm text-white/60 hover:bg-white/10"
            >
              + ボットを追加
            </button>
          </li>
        )}
      </ul>

      <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
        <p className="mb-3 text-white/60">
          {count >= MIN_PLAYERS ? (
            <>
              {count}人なら1人<b className="text-tk-gold">{DECK_SIZE[Math.min(count, MAX_PLAYERS)]}枚</b>のデッキで
              {DECK_SIZE[Math.min(count, MAX_PLAYERS)]}ラウンド
            </>
          ) : (
            <>デッキ枚数: 2人15枚・3人12枚・4人10枚・5人8枚</>
          )}
        </p>
        <div className="flex items-center justify-center gap-2">
          <span className="text-white/50">デッキの作り方</span>
          {(
            [
              ["random", "ランダム"],
              ["choice3", "3択"],
              ["draft", "ドラフト"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              disabled={!isHost}
              onClick={async () => setError(await onSettings({ buildMode: key }))}
              className={`rounded-lg border px-3 py-1.5 ${
                mode === key ? "border-tk-red-light bg-tk-red/30 text-white" : "border-white/10 text-white/50 enabled:hover:bg-white/10"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {startBlocker && <p className="mb-4 text-sm text-white/50">{startBlocker}</p>}

      {isHost ? (
        <button
          onClick={handleStart}
          disabled={starting || !!startBlocker}
          className="rounded-full bg-tk-red px-8 py-3 font-bold text-white hover:bg-tk-red-bright disabled:cursor-not-allowed disabled:opacity-40"
        >
          {starting ? "開始中..." : "ゲームを始める"}
        </button>
      ) : (
        <p className="text-white/60">ホストの開始を待っています…</p>
      )}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <p className="mt-2 text-xs text-white/35">最大{MAX_PLAYERS}人</p>

      <div className="mt-10 text-left">
        <RulesPanel defaultOpen />
      </div>
    </div>
  );
}
