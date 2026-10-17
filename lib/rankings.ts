// Server-side only: the values must not reach a client before the round's reveal.
import dashboard from "../data/rankings.json";
import estat from "../data/rankings_estat.json";

export interface Ranking {
  title: string;
  cat: string;
  unit: string;
  /** desc: larger is better (rank 1 = largest). asc: smaller is better. */
  dir: "desc" | "asc";
  year: string;
  source: string;
  note: string;
  /** One value per prefecture, in PREFECTURES order. */
  values: number[];
}

/** Statistics dashboard rankings (scripts/fetch_rankings.py) plus e-Stat API ones (scripts/fetch_estat.py). */
export const RANKINGS: Ranking[] = [...(dashboard as Ranking[]), ...(estat as Ranking[])];

/** National rank of every prefecture; equal values share a rank (1, 2, 2, 4 …). */
export function ranksOf(r: Ranking): number[] {
  const better = (a: number, b: number) => (r.dir === "desc" ? a > b : a < b);
  return r.values.map((v) => 1 + r.values.filter((w) => better(w, v)).length);
}
