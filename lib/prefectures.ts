/** The 47 prefectures in JIS order; the index is the prefecture id used everywhere (北海道 = 0). */
export const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県",
  "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県",
  "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
] as const;

export const PREF_COUNT = PREFECTURES.length;

export const REGIONS = [
  { name: "北海道・東北", color: "#5aa9e6", from: 0, to: 6 },
  { name: "関東", color: "#f28f3b", from: 7, to: 13 },
  { name: "中部", color: "#7bc96f", from: 14, to: 22 },
  { name: "近畿", color: "#e05780", from: 23, to: 29 },
  { name: "中国", color: "#b08ee8", from: 30, to: 34 },
  { name: "四国", color: "#e8c547", from: 35, to: 38 },
  { name: "九州・沖縄", color: "#ef6f6c", from: 39, to: 46 },
] as const;

export function regionOf(pref: number) {
  return REGIONS.find((r) => pref >= r.from && pref <= r.to)!;
}

/** "東京都" -> "東京", but 北海道 stays whole. */
export function shortName(pref: number): string {
  const name = PREFECTURES[pref];
  return name === "北海道" ? name : name.slice(0, -1);
}
