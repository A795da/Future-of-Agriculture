"""Extract tables from the TAGEM-DSI 2017 guide "Turkiye'de Sulanan Bitkilerin
Bitki Su Tuketimleri" (Ankara, 2017) into CSV files.

Usage:  python -E scripts/extract_tagem.py
Needs:  PyMuPDF (import fitz); the PDF at data/sources/raw/TAGEM-DSI_2017_Bitki_Su_Tuketimleri.pdf
Writes: data/sources/tagem_zones.csv     (29 climate zones, Section 6)
        data/sources/tagem_stations.csv  (259 climate stations, Section 7)
        data/sources/tagem_calendar.csv  (sowing dekad and FAO-56 stage lengths per zone and crop, Section 8)
Every row keeps the guide's page number so it can be checked by hand.
"""

import csv
import re
import sys
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "data/sources/raw/TAGEM-DSI_2017_Bitki_Su_Tuketimleri.pdf"
OUT = ROOT / "data/sources"

MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
DEKAD = {"I": 1, "II": 2, "III": 3}

# PDF page indices (0-based) of each section, read from the table of contents.
ZONE_PAGES = range(23, 26)       # Section 6, pp. 14-16
STATION_PAGES = range(28, 37)    # Section 7, pp. 18-26
CALENDAR_PAGES = range(38, 79)   # Section 8, pp. 28-69 (PDF pages 39-79)


def page_texts(doc, pages):
    return [(i, doc[i].get_text()) for i in pages]


def extract_zones(doc):
    zones = {}
    for i, t in page_texts(doc, ZONE_PAGES):
        for m in re.finditer(r"\n(\d{1,2}) (BLG_\d{2})\n([^\n]+)\n(\d+) ", t):
            zones[m.group(2)] = {"code": m.group(2), "name": m.group(3).strip(), "stations": int(m.group(4)), "pdf_page": i + 1}
    return [zones[k] for k in sorted(zones)]


def extract_stations(doc):
    """Station rows: number, WMO id, name and PROVINCE (upper case, sometimes on the
    same line as the name), latitude, longitude, elevation, zone code."""
    rows = []
    rx = re.compile(r"(?:^| )(\d{1,3}) (\d{5}) (.+?) (\d{2},\d+) (\d{2},\d+) ([\d.]+) (BLG_\d{2})")
    upper = "A-ZÇĞİÖŞÜÂÎÛ"
    prov_rx = re.compile(rf"^(.*?)\s*([{upper}][{upper}\-]+(?: [{upper}][{upper}\-]+)*)$")
    for i, t in page_texts(doc, STATION_PAGES):
        flat = re.sub(r"\s+", " ", t)
        for m in rx.finditer(flat):
            name_prov = m.group(3).strip()
            pm = prov_rx.match(name_prov)
            station, province = (pm.group(1).strip(), pm.group(2).strip()) if pm else (name_prov, "")
            rows.append({
                "no": int(m.group(1)),
                "wmo_id": m.group(2),
                "station": station,
                "province": province,
                "lat": float(m.group(4).replace(",", ".")),
                "lon": float(m.group(5).replace(",", ".")),
                "elevation_m": int(m.group(6).replace(".", "")),
                "zone": m.group(7),
                "pdf_page": i + 1,
            })
    rows.sort(key=lambda r: r["no"])
    return rows


def tr_key(s):
    """Sort key for Turkish alphabetical order."""
    order = "aâbcçdefgğhıiîjklmnoöprsştuûüvyz"
    return [order.index(ch) if ch in order else 100 + ord(ch) for ch in s.lower()]


def extract_calendar(doc):
    month_alt = "|".join(MONTHS)
    rx = re.compile(
        # row numbers above 999 are printed with a thousands separator: "1.215"
        rf"(?:^|\n)(\d{{1,3}}(?:\.\d{{3}})?) ([^\n]+?)\n\s*({month_alt}) ?-(I{{1,3}})\s*\n(\d+)\n(\d+)\n(\d+)\n(\d+)\n(\d+)"
    )
    label_rx = re.compile(r"^\s*(\d{1,2})\. (.+?BÖLGESİ)", re.M)
    rows, labels, page_zones = [], {}, {}
    for i, t in page_texts(doc, CALENDAR_PAGES):
        zs = set()
        for m in label_rx.finditer(t):
            labels.setdefault(int(m.group(1)), m.group(2).strip())
            zs.add(int(m.group(1)))
        page_zones[i + 1] = sorted(zs)
        for m in rx.finditer(t):
            rows.append({
                "seq": int(m.group(1).replace(".", "")),
                "crop_tr": m.group(2).strip(),
                "sowing_month": MONTHS.index(m.group(3)) + 1,
                "sowing_dekad": DEKAD[m.group(4)],
                "stage1_days": int(m.group(5)),
                "stage2_days": int(m.group(6)),
                "stage3_days": int(m.group(7)),
                "stage4_days": int(m.group(8)),
                "season_days": int(m.group(9)),
                "pdf_page": i + 1,
            })
    rows.sort(key=lambda r: r["seq"])  # the guide numbers rows continuously 1..N
    # Zone of each row: every page prints the labels of the zones it contains, and
    # each zone's crops are alphabetical, so a step back in the alphabet starts the
    # next zone. A page whose lowest zone is above the current one also starts it.
    # Only the first letter is compared: the guide's own sort differs from ours on
    # punctuation, digits and ı/i, but a new zone always jumps back to an early letter.
    first = lambda s: tr_key(s[:1])
    zone = 0
    for k, r in enumerate(rows):
        if k == 0:
            zone = (page_zones.get(r["pdf_page"]) or [1])[0]
        elif first(r["crop_tr"]) < first(rows[k - 1]["crop_tr"]):
            zone += 1
        r["_z"] = zone
        r["zone"] = f"BLG_{zone:02d}"
        r["zone_label"] = labels.get(zone, "")
    mismatches = [r for r in rows if page_zones.get(r["pdf_page"]) and r["_z"] not in page_zones[r["pdf_page"]]]
    for r in rows:
        del r["_z"]
    return rows, labels, mismatches


def write_csv(path, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    doc = fitz.open(PDF)
    zones = extract_zones(doc)
    stations = extract_stations(doc)
    calendar, labels, mismatches = extract_calendar(doc)

    problems = []
    if len(zones) != 29:
        problems.append(f"expected 29 zones, got {len(zones)}")
    if len(stations) != 259:
        problems.append(f"expected 259 stations, got {len(stations)}")
    missing = sorted(set(range(1, 260)) - {s["no"] for s in stations})
    if missing:
        problems.append(f"missing station numbers: {missing[:20]}")
    zone_count = len({r["zone"] for r in calendar})
    if zone_count != 29:
        problems.append(f"calendar split into {zone_count} zones, expected 29")
    if mismatches:
        problems.append(f"{len(mismatches)} rows assigned to a zone not printed on their page, e.g. "
                        + ", ".join(f"#{r['seq']} {r['crop_tr']} p{r['pdf_page']} {r['zone']}" for r in mismatches[:5]))
    bad_sum = [r for r in calendar if sum(r[f"stage{k}_days"] for k in range(1, 5)) != r["season_days"]]
    seqs = [r["seq"] for r in calendar]
    gaps = sorted(set(range(1, max(seqs) + 1)) - set(seqs))

    write_csv(OUT / "tagem_zones.csv", zones)
    write_csv(OUT / "tagem_stations.csv", stations)
    write_csv(OUT / "tagem_calendar.csv", calendar)

    print(f"zones: {len(zones)}, stations: {len(stations)}, calendar rows: {len(calendar)} in {zone_count} zones")
    print(f"calendar row numbers 1..{max(seqs)}, missing: {gaps[:30]}{' ...' if len(gaps) > 30 else ''}")
    print(f"rows where stages do not add up to the season (as printed in the guide): {len(bad_sum)}")
    print("zone labels found:", len(labels))
    for p in problems:
        print("PROBLEM:", p)


if __name__ == "__main__":
    main()
