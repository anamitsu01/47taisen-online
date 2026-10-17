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

- ゲームで使うランキングは `data/rankings.json`(407種類)と `data/rankings_estat.json`(223種類)の合計630種類。サーバー側だけで読み込み、数値は結果発表まで送らない。
- 元データは政府統計の [統計ダッシュボード API](https://dashboard.e-stat.go.jp/)(登録不要)。
- 追加・修正は `scripts/rankingSpec.json` に1行足して `npm run rankings`(= `python scripts/fetch_rankings.py`)。
  - `src`: ダッシュボードの指標名(完全一致)
  - `per` / `factor`: 割り算して「人口10万人あたり」などにする場合
  - `dir`: `desc`(大きいほど上位、既定) / `asc`(小さいほど上位)
  - 同じ値が9県以上ある指標は自動で除外(`maxTies` で変更可)

### e-Stat API のランキング(お店の数・食べ物などへの支出)

- `scripts/estatSpec.json` に1行足して `npm run rankings:estat`(= `python scripts/fetch_estat.py`)。
- `.env.local` に `ESTAT_APP_ID=...` が必要(e-Statで無料登録して発行。GitHubには上げない)。
- `src: "ec"` は経済センサス‐活動調査(2021年)の産業分類コード別事業所数を人口10万人あたりにしたもの。
- `src: "hh"` は家計調査の品目別支出(県庁所在市・東京は区部、二人以上世帯、直近3年平均)。

## 構成

Next.js + Socket.IO のカスタムサーバー(`server.ts`)。部屋はメモリ上に保持。ゲームロジックは `lib/gameEngine.ts`。
Dockerfile あり(Railway でそのまま動く)。

## キャラクター画像

`public/chara/01.webp`(北海道)〜`47.webp`(沖縄県)。3択の候補カード・提出したカード・結果画面に表示。
元のイラストを差し替えたら `python scripts/prepare_chara.py <イラストのフォルダ>` で作り直す(背景の市松模様・白・黒は自動で透過)。1枚だけなら `... <フォルダ> akita` のように名前を付ける。
