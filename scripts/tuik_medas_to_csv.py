"""Convert TÜİK MEDAS pivot exports (Bitkisel Üretim İstatistikleri,
"(Kuru / Sulu) - (1. Ekiliş / 2. Ekiliş) ürünleri") into one long CSV.

Usage:  pip install xlrd   (only needed for this script)
        python -I scripts/tuik_medas_to_csv.py
Reads:  data/sources/tuik/medas_*.xls   (provinces across, years down, one block per indicator)
Writes: data/sources/tuik/tuik_medas_long.csv
        columns: province_plate, province, measure, water, sowing, product_code, product, unit, year, value

Indicator labels look like
  "Verim ve Kuru ve 01.11.11.00.00. (Durum Buğdayı) - Kg/Dekar"
  "Verim ve Sulu ve İkinci Ekiliş ve 01.11.81.00.00. (Soya Fasulyesi) - Kg/Dekar"
Exports without the first/second-crop breakdown get sowing = "all".
"""
import csv
import re
from pathlib import Path

import xlrd

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "sources" / "tuik"
OUT = SRC / "tuik_medas_long.csv"

LABEL = re.compile(
    r"^(?P<measure>Ekilen Alan|Hasat Edilen Alan|Verim|Üretim Miktarı)(?: ve (?P<water>Kuru|Sulu))?"
    r"(?: ve (?P<sowing>Birinci|İkinci) Ekiliş)? ve (?P<code>[\d.]+?)\.? \((?P<product>.+)\) - (?P<unit>.+)$"
)
MEASURE = {"Ekilen Alan": "planted_area", "Hasat Edilen Alan": "harvested_area", "Verim": "yield", "Üretim Miktarı": "production"}
WATER = {"Kuru": "rainfed", "Sulu": "irrigated", None: "all"}  # "all": table without the rain-fed / irrigated split
SOWING = {"Birinci": "first", "İkinci": "second", None: "all"}


def parse(path):
    sh = xlrd.open_workbook(str(path)).sheet_by_index(0)
    header_row = next(r for r in range(sh.nrows) if str(sh.cell_value(r, 0)).strip().startswith("Satırlar"))
    provinces = []
    for c in range(3, sh.ncols):
        name = str(sh.cell_value(header_row, c)).strip()
        m = re.match(r"^(.*)-(\d+)$", name)
        provinces.append((c, m.group(1), int(m.group(2))) if m else None)
    label = None
    for r in range(header_row + 1, sh.nrows):
        text = str(sh.cell_value(r, 1)).strip()
        if text:
            m = LABEL.match(text)
            if not m:
                raise ValueError(f"{path.name} row {r}: cannot read indicator label {text!r}")
            label = m.groupdict()
        year = str(sh.cell_value(r, 2)).strip().split(".")[0]
        if not label or not year.isdigit():
            continue
        for p in provinces:
            if not p:
                continue
            c, name, plate = p
            v = sh.cell_value(r, c)
            if v in ("", None):
                continue
            yield {
                "province_plate": plate,
                "province": name,
                "measure": MEASURE[label["measure"]],
                "water": WATER[label["water"]],
                "sowing": SOWING[label["sowing"]],
                "product_code": label["code"],
                "product": label["product"],
                "unit": label["unit"],
                "year": int(year),
                "value": float(v),
            }


def main():
    rows, seen = [], set()
    files = sorted(SRC.glob("medas_*.xls"))
    for f in files:
        n = 0
        for row in parse(f):
            key = (row["province_plate"], row["measure"], row["water"], row["sowing"], row["product_code"], row["year"])
            if key in seen:  # the same value exported twice (overlapping files): keep the first
                continue
            seen.add(key)
            rows.append(row)
            n += 1
        print(f"{f.name}: {n} values")
    rows.sort(key=lambda r: (r["product_code"], r["water"], r["sowing"], r["measure"], r["province_plate"], r["year"]))
    with OUT.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print(f"{len(rows)} values from {len(files)} files -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
