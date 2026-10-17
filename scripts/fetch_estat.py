# Builds data/rankings_estat.json from scripts/estatSpec.json using the e-Stat API.
# Needs ESTAT_APP_ID in .env.local (free registration at e-stat.go.jp; never commit it).
#
#   python scripts/fetch_estat.py
#
# Spec entries ("src" picks the table):
#   ec   2021 Economic Census, establishments by industry (code = 産業小分類/細分類 code),
#        always per 100,000 people (2021 population) unless "per": false
#   hh   Family Income and Expenditure Survey, yearly spending of 2+ person households in
#        each prefectural capital (東京は区部), averaged over the last 3 years
# Responses are cached in .stat-cache/estat/.
import json, os, sys, time, urllib.parse, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_rankings import indicator_index, series  # noqa: E402  (population for per-capita figures)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".stat-cache", "estat")
API = "https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData"
os.makedirs(CACHE, exist_ok=True)

EC_TABLE = "0004005645"  # 経済センサス-活動調査 2021 産業(小分類)別民営事業所数 - 都道府県
HH_TABLE = "0004023605"  # 家計調査 品目分類(2025年改定) 年次 二人以上の世帯 - 都道府県庁所在市
HH_YEARS = 3


def app_id():
    for line in open(os.path.join(ROOT, ".env.local"), encoding="utf-8"):
        if line.startswith("ESTAT_APP_ID="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("ESTAT_APP_ID が .env.local にありません")


def get(params, cache_name):
    path = os.path.join(CACHE, cache_name + ".json")
    if not os.path.exists(path):
        q = dict(params, appId=app_id(), metaGetFlg="N", cntGetFlg="N")
        with urllib.request.urlopen(API + "?" + urllib.parse.urlencode(q), timeout=120) as r:
            open(path, "wb").write(r.read())
        time.sleep(0.4)
    d = json.load(open(path, encoding="utf-8"))["GET_STATS_DATA"]
    if d["RESULT"]["STATUS"] not in (0, 1):
        raise ValueError(d["RESULT"]["ERROR_MSG"])
    vals = d.get("STATISTICAL_DATA", {}).get("DATA_INF", {}).get("VALUE", [])
    return vals if isinstance(vals, list) else [vals]


def num(v):
    try:
        return float(v["$"])
    except (KeyError, ValueError):
        return None  # "-", "x" (secret) etc.


def economic_census(code):
    rows = get({"statsDataId": EC_TABLE, "cdTab": "102-2021", "cdCat01": code, "cdCat02": "00"}, f"ec_{code}")
    by_pref = {int(v["@area"][:2]): num(v) for v in rows if v["@area"].endswith("000") and v["@area"] != "00000"}
    # A prefecture with no establishment of that kind is simply absent: count it as 0.
    return [by_pref.get(p) or 0.0 for p in range(1, 48)], "2021年", "経済センサス‐活動調査"


def household(code):
    rows = get({"statsDataId": HH_TABLE, "cdCat01": code, "cdCat02": "03"}, f"hh_{code}")
    # 県庁所在市 codes are XX003, except 福岡市 (40004; 40003 is 北九州市).
    capital = {p: "40004" if p == 40 else f"{p:02d}003" for p in range(1, 48)}
    years = sorted({v["@time"] for v in rows if num(v) is not None})[-HH_YEARS:]
    out = []
    for p in range(1, 48):
        vs = [num(v) for v in rows if v["@area"] == capital[p] and v["@time"] in years]
        vs = [x for x in vs if x is not None]
        if len(vs) != len(years):
            raise ValueError(f"{p}: {len(vs)}年分しかない")
        out.append(sum(vs) / len(vs))
    label = f"{years[0][:4]}〜{years[-1][:4]}年平均"
    return out, label, "家計調査"


def main():
    spec = json.load(open(os.path.join(ROOT, "scripts", "estatSpec.json"), encoding="utf-8"))
    index = indicator_index()
    pop_by_year, _ = series(index, "総人口（総数）")
    pop2021 = pop_by_year[min(pop_by_year, key=lambda t: abs(int(t[:4]) - 2021))]

    out, problems = [], []
    for s in spec:
        try:
            if s["src"] == "ec":
                vals, year, source = economic_census(s["code"])
                if s.get("per", True):
                    vals = [v / p * 100000 for v, p in zip(vals, pop2021)]
                    s.setdefault("note", "人口10万人あたり")
            else:
                vals, year, source = household(s["code"])
                s.setdefault("note", "県庁所在市（東京都は区部）の二人以上世帯・1世帯あたり年間")
            vals = [round(v, s.get("digits", 2)) for v in vals]
            ties = max(vals.count(v) for v in vals)
            if ties > s.get("maxTies", 8):
                raise ValueError(f"同じ値が{ties}県")
            out.append({
                "title": s["title"], "cat": s["cat"], "unit": s["unit"], "dir": s.get("dir", "desc"),
                "year": year, "source": source, "note": s.get("note", ""), "values": vals,
            })
        except Exception as e:  # noqa: BLE001
            problems.append(f"skip {s['title']}: {e}")
    json.dump(out, open(os.path.join(ROOT, "data", "rankings_estat.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print(f"{len(out)} rankings written")
    for p in problems:
        print(p)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
