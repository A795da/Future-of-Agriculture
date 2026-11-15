"""Extract crop thermal-time (growing degree day) parameters from the FAO AquaCrop
default crop files, as distributed in AquaCrop-OSPy (Apache-2.0).

Usage:  python -I scripts/extract_aquacrop.py
Writes: data/sources/raw/aquacrop_crop_params.py   (downloaded source, not committed)
        data/sources/aquacrop_gdd.csv               (thermal parameters of the GDD crop versions)

The source file is a Python dict literal; it is parsed with ast.literal_eval, which
reads data without executing any code.
"""

import ast
import csv
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPO = "aquacropos/aquacrop"
PATH = "aquacrop/entities/crops/crop_params.py"
RAW_OUT = ROOT / "data/sources/raw/aquacrop_crop_params.py"
CSV_OUT = ROOT / "data/sources/aquacrop_gdd.csv"

# AquaCrop GDD crop versions we use (CalendarType 2 = growing degree days).
WANTED = ["WheatGDD", "BarleyGDD", "MaizeGDD", "SunflowerGDD", "CottonGDD", "PotatoGDD",
          "SugarBeetGDD", "TomatoGDD", "DryBeanGDD", "SoybeanGDD", "AlfalfaGDD", "SorghumGDD", "PaddyRiceGDD"]


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "fieldshift-data-script"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def main():
    commits = json.loads(get(f"https://api.github.com/repos/{REPO}/commits?path={PATH}&per_page=1"))
    sha = commits[0]["sha"]
    date = commits[0]["commit"]["committer"]["date"]
    src = get(f"https://raw.githubusercontent.com/{REPO}/{sha}/{PATH}").decode("utf-8")
    RAW_OUT.parent.mkdir(parents=True, exist_ok=True)
    RAW_OUT.write_text(src, encoding="utf-8")

    start = src.index("crop_params=") + len("crop_params=")
    depth, end = 0, None
    for i, ch in enumerate(src[start:], start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    params = ast.literal_eval(src[start:end])

    rows = []
    for name in WANTED:
        c = params[name]
        assert c["CalendarType"] == 2, f"{name} is not a GDD crop"
        rows.append({
            "aquacrop_name": name,
            "tbase_c": c["Tbase"],
            "tupp_c": c["Tupp"],
            "emergence_gdd": c["Emergence"],
            "flowering_start_gdd": c["HIstart"],
            "flowering_duration_gdd": c["Flowering"],
            "senescence_gdd": c["Senescence"],
            "maturity_gdd": c["Maturity"],
            "source_commit": sha,
            "commit_date": date,
        })
    with open(CSV_OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print(f"{len(rows)} crops from {REPO}@{sha[:10]} ({date}) -> {CSV_OUT.relative_to(ROOT)}")
    for r in rows:
        print(f"  {r['aquacrop_name']:13} base {r['tbase_c']:>4} upper {r['tupp_c']:>4} flowering {r['flowering_start_gdd']:>6} maturity {r['maturity_gdd']:>6}")


if __name__ == "__main__":
    main()
