"""Build web/public/data/soil_texture.json: topsoil (0-30 cm) sand and clay percent
for each province point, from NASA ORNL DAAC's Regridded Harmonized World Soil
Database v1.2 (Wieder et al. 2014, doi:10.3334/ORNLDAAC/1247, 0.05 degree grid).

Usage:  pip install netCDF4   (only needed for this script)
        python -E scripts/build_soil_texture.py
Reads:  data/sources/raw/T_CLAY.nc4, data/sources/raw/T_SAND.nc4
        (download from https://daac.ornl.gov/SOILS/guides/HWSD.html with a NASA
        Earthdata login; large raw files, not committed)
        web/public/data/provinces.json
Writes: web/public/data/soil_texture.json

Where the province point falls on a water, urban or no-data cell, the nearest
valid cell within MAX_RING cells (about 5 km each) is used and its distance kept.
"""

import json
import math
from datetime import date
from pathlib import Path

from netCDF4 import Dataset

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "sources" / "raw"
OUT = ROOT / "web" / "public" / "data" / "soil_texture.json"
MAX_RING = 6


def find(name):
    hits = [p for p in RAW.iterdir() if p.name.lower() == f"{name.lower()}.nc4"]
    if not hits:
        raise SystemExit(f"missing {RAW / (name + '.nc4')}: download it from the ORNL DAAC HWSD page")
    return hits[0]


def open_grid(path):
    ds = Dataset(str(path))
    ds.set_auto_mask(True)
    lat_name = next(v for v in ds.variables if v.lower() in ("lat", "latitude"))
    lon_name = next(v for v in ds.variables if v.lower() in ("lon", "longitude"))
    data_name = next(v for v in ds.variables if v not in (lat_name, lon_name) and ds.variables[v].ndim == 2)
    return ds, ds.variables[lat_name][:], ds.variables[lon_name][:], ds.variables[data_name]


def nearest_index(axis, x):
    step = float(axis[1] - axis[0])
    i = int(round((x - float(axis[0])) / step))
    return max(0, min(len(axis) - 1, i))


def sample(grid, lat, lon):
    _, lats, lons, var = grid
    i0, j0 = nearest_index(lats, lat), nearest_index(lons, lon)
    best = None
    for ring in range(MAX_RING + 1):
        for i in range(i0 - ring, i0 + ring + 1):
            for j in range(j0 - ring, j0 + ring + 1):
                if max(abs(i - i0), abs(j - j0)) != ring or not (0 <= i < len(lats) and 0 <= j < len(lons)):
                    continue
                v = var[i, j]
                if v is None or getattr(v, "mask", False) or not math.isfinite(float(v)) or float(v) < 0:
                    continue
                d = math.hypot((float(lats[i]) - lat) * 111.0, (float(lons[j]) - lon) * 111.0 * math.cos(math.radians(lat)))
                if best is None or d < best[1]:
                    best = (float(v), d)
        if best:
            return best
    return None


def main():
    provinces = json.loads((ROOT / "web/public/data/provinces.json").read_text(encoding="utf-8"))
    clay, sand = open_grid(find("T_CLAY")), open_grid(find("T_SAND"))
    out, missing = {}, []
    for p in provinces:
        c, s = sample(clay, p["lat"], p["lon"]), sample(sand, p["lat"], p["lon"])
        if not c or not s:
            missing.append(p["id"])
            continue
        out[p["id"]] = {"clay": round(c[0]), "sand": round(s[0]), "km_from_point": round(max(c[1], s[1]), 1)}
    result = {
        "_meta": {
            "source": "NASA ORNL DAAC, Regridded Harmonized World Soil Database v1.2 (Wieder, Boehnert, Bonan & Langseth 2014), doi:10.3334/ORNLDAAC/1247",
            "short": "NASA ORNL DAAC regridded HWSD v1.2",
            "variables": "T_CLAY and T_SAND: topsoil (0-30 cm) clay and sand, % weight; 0.05 degree grid (about 5 km), nominal year 2000",
            "method": f"value at the province point, or the nearest valid cell within {MAX_RING} cells; texture class in the app: clay >= 40% -> clay, sand >= 70% -> sandy, else loam",
            "built": date.today().isoformat(),
        },
        "provinces": out,
    }
    OUT.write_text(json.dumps(result, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(out)} provinces -> {OUT.relative_to(ROOT)}" + (f"; no value for {', '.join(missing)}" if missing else ""))


if __name__ == "__main__":
    main()
