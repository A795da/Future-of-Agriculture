"""Build web/public/data/water_storage.json: the long-term trend of total water
stored on land and underground (soil, groundwater, lakes, snow) near each province,
from NASA JPL GRACE and GRACE-FO mascons (RL06.3 v04 CRI, doi:10.5067/TEMSC-3JC634).

Usage:  pip install netCDF4 numpy
        python -E scripts/build_water_storage.py
Reads:  data/sources/raw/GRCTellus.JPL.*.GLO.RL06.3M.MSCNv04CRI.nc  (44 MB, not committed;
        NASA Earthdata / PO.DAAC, TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4)
        web/public/data/provinces.json
Writes: web/public/data/water_storage.json

Method: liquid water equivalent thickness (cm) times the CRI scale factor (JPL's
recommended gain for land hydrology) at the 0.5 degree cell of the province point.
The native resolution is a 3 degree mascon (about 300 km), so neighbouring provinces
share values. Trend = least-squares fit of a line plus an annual cycle (sine and
cosine) over all available months (the 2017-2018 gap between the missions is simply
missing). Change = trend times the years covered.
"""

import json
import math
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import numpy as np
from netCDF4 import Dataset

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "sources" / "raw"
OUT = ROOT / "web" / "public" / "data" / "water_storage.json"
MAX_RING = 3  # cells of 0.5 degree
# CRI scale factors are gain factors for land hydrology; right at the coast they can
# be near zero or negative (Adana's cell: -0.06), which wipes out a real trend. Outside
# this range the mascon's median inland scale factor is used instead.
SCALE_OK = (0.5, 2.0)


def main():
    files = sorted(RAW.glob("GRCTellus.JPL.*.MSCNv04CRI.nc"))
    if not files:
        raise SystemExit(f"missing GRACE mascon file in {RAW}")
    ds = Dataset(str(files[-1]))
    ds.set_auto_mask(True)
    lat = ds.variables["lat"][:]
    lon = ds.variables["lon"][:]
    t = ds.variables["time"][:]  # days since 2002-01-01
    epoch = datetime(2002, 1, 1, tzinfo=timezone.utc)
    when = [epoch + timedelta(days=float(x)) for x in t]
    years = np.array([d.year + (d.timetuple().tm_yday - 0.5) / 365.25 for d in when])
    lwe = ds.variables["lwe_thickness"]
    scale = ds.variables["scale_factor"][:]
    land = ds.variables["land_mask"][:]
    mascon = ds.variables["mascon_ID"][:]
    sane = np.ma.filled((scale >= SCALE_OK[0]) & (scale <= SCALE_OK[1]) & (land == 1), False)
    median_scale = {}
    for m in np.unique(np.asarray(mascon)[np.asarray(sane)]):
        median_scale[int(m)] = float(np.median(np.asarray(scale)[np.asarray(sane) & (np.asarray(mascon) == m)]))

    provinces = json.loads((ROOT / "web/public/data/provinces.json").read_text(encoding="utf-8"))
    out = {}
    for p in provinces:
        i0 = int(np.argmin(np.abs(lat - p["lat"])))
        j0 = int(np.argmin(np.abs(lon - (p["lon"] % 360))))
        # coastal points can fall on a sea cell: take the nearest land cell within MAX_RING cells
        cells = sorted(
            ((i, j) for i in range(i0 - MAX_RING, i0 + MAX_RING + 1) for j in range(j0 - MAX_RING, j0 + MAX_RING + 1) if land[i, j]),
            key=lambda c: (c[0] - i0) ** 2 + (c[1] - j0) ** 2,
        )
        if not cells:
            continue
        i, j = cells[0]
        km = math.hypot((lat[i] - p["lat"]) * 111.0, (lon[j] - p["lon"] % 360) * 111.0 * math.cos(math.radians(p["lat"])))
        sc = float(scale[i, j]) if not np.ma.is_masked(scale[i, j]) else float("nan")
        m_id = int(mascon[i, j])
        cell_ok = SCALE_OK[0] <= sc <= SCALE_OK[1]
        used = sc if cell_ok else median_scale.get(m_id, 1.0)
        series = np.asarray(lwe[:, i, j], dtype=float) * used
        ok = np.isfinite(series)
        y, s = years[ok], series[ok]
        x = y - y.mean()
        A = np.column_stack([np.ones_like(x), x, np.sin(2 * math.pi * y), np.cos(2 * math.pi * y)])
        coef, *_ = np.linalg.lstsq(A, s, rcond=None)
        resid = s - A @ coef
        # standard error of the slope (residuals are autocorrelated, so treat it as a lower bound)
        se = math.sqrt((resid @ resid) / max(1, len(s) - 4) / (x @ x))
        span = float(y.max() - y.min())
        out[p["id"]] = {
            "trend_cm_yr": round(float(coef[1]), 2),
            "trend_se": round(se, 2),
            "change_cm": round(float(coef[1]) * span, 1),
            "months": int(ok.sum()),
            "mascon": int(ds.variables["mascon_ID"][i, j]),
            "km_from_point": round(float(km)),
            "scale": round(used, 2),
            "scale_from": "cell" if cell_ok else "mascon median (coastal cell factor out of range)",
        }
    result = {
        "_meta": {
            "source": "NASA JPL GRACE and GRACE-FO Mascon RL06.3 v04 CRI (Wiese, Landerer & Watkins 2016; Watkins et al. 2015), PO.DAAC TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4, doi:10.5067/TEMSC-3JC634",
            "short": "NASA GRACE/GRACE-FO",
            "period": f"{when[0]:%Y-%m} to {when[-1]:%Y-%m}",
            "variables": "total land water storage anomaly (liquid water equivalent, cm) x CRI scale factor, at the 0.5 degree cell of the province point; native resolution 3 degree mascons (~300 km)",
            "method": f"least-squares line plus annual cycle over all available months; change_cm = trend x years covered; CRI scale factor of the cell, or the mascon's median inland factor where the cell's is outside {SCALE_OK[0]}-{SCALE_OK[1]} (coastal cells)",
            "built": date.today().isoformat(),
        },
        "provinces": out,
    }
    OUT.write_text(json.dumps(result, ensure_ascii=False) + "\n", encoding="utf-8")
    trends = sorted((v["trend_cm_yr"], k) for k, v in out.items())
    print(f"{len(out)} provinces -> {OUT.relative_to(ROOT)} ({result['_meta']['period']})")
    print("steepest declines:", ", ".join(f"{k} {v:+.2f}" for v, k in trends[:8]))
    print("least decline / rises:", ", ".join(f"{k} {v:+.2f}" for v, k in trends[-5:]))


if __name__ == "__main__":
    main()
