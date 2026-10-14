# Rebuilds data/rankings.json from scripts/rankingSpec.json using the e-Stat
# statistics dashboard API (https://dashboard.e-stat.go.jp/, no app id needed).
#
#   python scripts/fetch_rankings.py
#
# Each spec entry names a dashboard indicator ("src", exact Japanese name) and
# optionally a denominator ("per") to turn a count into a per-capita figure.
# Responses are cached in .stat-cache/ so re-runs are quick.
import json, os, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".stat-cache")
API = "https://dashboard.e-stat.go.jp/api/1.0/Json/"
os.makedirs(CACHE, exist_ok=True)


def get(endpoint, params, cache_name):
    path = os.path.join(CACHE, cache_name)
    if not os.path.exists(path):
        url = API + endpoint + "?" + urllib.parse.urlencode(params)
        with urllib.request.urlopen(url, timeout=120) as r:
            open(path, "wb").write(r.read())
        time.sleep(0.3)
    return json.load(open(path, encoding="utf-8"))


def indicator_index():
    """name -> (code, statName) for indicators with current prefecture-level data."""
    d = get("getIndicatorInfo", {"Lang": "JP"}, "indicators.json")
    index = {}
    for o in d["GET_META_INDICATOR_INF"]["METADATA_INF"]["CLASS_INF"]["CLASS_OBJ"]:
        classes = o["CLASS"] if isinstance(o["CLASS"], list) else [o["CLASS"]]
        for c in classes:
            if c["RegionalRank"]["@code"] == "3" and c["@toDate"].startswith("9999"):
                index.setdefault(o["@name"], (o["@code"], c["@statName"].strip()))
    return index


def series(index, name):
    """time -> {prefecture number: value}, yearly / fiscal-yearly values only."""
    code, stat = index[name]
    d = get("getData", {"Lang": "JP", "IndicatorCode": code, "RegionalRank": "3"}, code + ".json")["GET_STATS"]
    objs = d.get("STATISTICAL_DATA", {}).get("DATA_INF", {}).get("DATA_OBJ", [])
    by_time = {}
    for o in objs if isinstance(objs, list) else [objs]:
        v = o["VALUE"]
        pref = int(v["@regionCode"][:2])
        if v["@regionCode"][2:] != "000" or not 1 <= pref <= 47 or v["@cycle"] not in ("3", "4"):
            continue
        try:
            by_time.setdefault(v["@time"], {})[pref] = float(v["$"])
        except (KeyError, ValueError):
            pass
    full = {t: [vals[p] for p in range(1, 48)] for t, vals in by_time.items() if len(vals) == 47}
    return full, stat


def year_label(t):
    return f"{t[:4]}年度" if t[4:6] == "FY" else f"{t[:4]}年"


def main():
    spec = json.load(open(os.path.join(ROOT, "scripts", "rankingSpec.json"), encoding="utf-8"))
    index = indicator_index()
    out, problems = [], []
    for s in spec:
        try:
            num, stat = series(index, s["src"])
            if not num:
                raise ValueError("47都道府県そろった年がない")
            t = max(num)
            vals = num[t]
            if "per" in s:
                den, _ = series(index, s["per"])
                dt = min(den, key=lambda d: (abs(int(d[:4]) - int(t[:4])), d))
                vals = [a / b for a, b in zip(vals, den[dt])]
            vals = [v * s.get("factor", 1) for v in vals]
            if "digits" in s:
                vals = [round(v, s["digits"]) for v in vals]
            ties = max(vals.count(v) for v in vals)
            if ties > s.get("maxTies", 8):
                raise ValueError(f"同じ値が{ties}県")
            out.append({
                "title": s["title"], "cat": s["cat"], "unit": s["unit"], "dir": s.get("dir", "desc"),
                "year": year_label(t), "source": stat, "note": s.get("note", ""), "values": vals,
            })
        except Exception as e:  # noqa: BLE001
            problems.append(f"skip {s['title']}: {e}")
    json.dump(out, open(os.path.join(ROOT, "data", "rankings.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print(f"{len(out)} rankings written")
    for p in problems:
        print(p)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
