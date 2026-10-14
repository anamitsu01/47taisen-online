import { DECK_SIZE } from "@/lib/types";

export default function RulesPanel({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="rounded-xl border border-white/10 bg-panel/80 p-4 text-sm leading-relaxed">
      <summary className="cursor-pointer text-base font-bold text-ink">ルール</summary>
      <RulesContent className="mt-3" />
    </details>
  );
}

export function RulesContent({ className = "" }: { className?: string }) {
  const sizes = Object.entries(DECK_SIZE)
    .map(([n, size]) => `${n}人${size}枚`)
    .join("・");
  return (
    <div className={`space-y-3 text-white/70 ${className}`}>
      <p>
        <b className="text-ink">目的</b>: 都道府県カードでデッキを作り、毎ラウンド発表されるランキングで順位を競う。勝ち負けより、
        「こんなランキングあるの?」「この県が1位なの!」を楽しむゲーム。
      </p>
      <p>
        <b className="text-ink">デッキ作り</b>: 枚数は{sizes}。同じ県を2人が持つことはない。作り方は毎回ランダムでどちらか。
        どんなランキングが出るかは<b className="text-ink">一切わからない</b>。
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <b className="text-ink">3択</b>: 全員同時に、自分にだけ出る3県から1県を選ぶのをくり返す。ほかの人が何を選んだかは見えない。
        </li>
        <li>
          <b className="text-ink">ドラフト</b>: 47都道府県を全員で見ながら、順番に1県ずつ選ぶ。誰が何を取ったかは見える。
        </li>
      </ul>
      <p>
        <b className="text-ink">ラウンド</b>: ランキングの名前だけが発表される → 全員が手札から1枚選ぶ(時間制限なし) →
        全員が決めたら一斉に公開 → 全国順位と実際の数値を発表。出したカードはなくなる。手札がなくなったら終了。
      </p>
      <p>
        <b className="text-ink">得点</b>: 出たカードを全国順位の高い順に並べ、<b className="text-tk-gold">1つ下の人との順位の差</b>が自分の得点。
        いちばん下は0点。同じ順位の人は、次にちがう順位の人との差で計算する。
        <br />
        <span className="text-white/50">
          例: 全国2位・3位・20位・35位 → 1点・17点・15点・0点。1位を取っても大量点とは限らない!
        </span>
      </p>
      <p>
        <b className="text-ink">結果画面</b>: 47都道府県すべての順位と数値を見られる。全員が「次へ」を押したら次のラウンドへ。
      </p>
      <p className="text-xs text-white/40">
        ランキングのデータは政府統計(e-Stat 統計ダッシュボード)から作成。数値は出典の調査年のもの。
      </p>
    </div>
  );
}
