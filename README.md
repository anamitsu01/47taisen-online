# 都道府県大戦

都道府県カードでデッキを作り、毎ラウンド発表されるランキングで順位を競うオンライン対戦ゲーム(2〜5人)。

## 動かし方

```bash
npm install
npm run dev        # http://localhost:3000
```

部屋コード `ZZZZZ` で入ると、ボット3体入りのテスト部屋が開きます。

```bash
npm run simulate   # ボット同士で全人数・両方式を通しプレイして検証
npm run build && npm start
```

## ランキングデータ

- `data/rankings.json` がゲームで使うランキング(現在407種類)。サーバー側だけで読み込み、数値は結果発表まで送らない。
- 元データは政府統計の [統計ダッシュボード API](https://dashboard.e-stat.go.jp/)(登録不要)。
- 追加・修正は `scripts/rankingSpec.json` に1行足して `npm run rankings`(= `python scripts/fetch_rankings.py`)。
  - `src`: ダッシュボードの指標名(完全一致)
  - `per` / `factor`: 割り算して「人口10万人あたり」などにする場合
  - `dir`: `desc`(大きいほど上位、既定) / `asc`(小さいほど上位)
  - 同じ値が9県以上ある指標は自動で除外(`maxTies` で変更可)

## 構成

Next.js + Socket.IO のカスタムサーバー(`server.ts`)。部屋はメモリ上に保持。ゲームロジックは `lib/gameEngine.ts`。
Dockerfile あり(Railway でそのまま動く)。
