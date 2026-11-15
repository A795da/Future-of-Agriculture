// Build web/public/data/climate_shift.json: for each province, how the last 5 years
// of NASA POWER weather differ from the earlier years of the record (temperature,
// very hot days, rain, heavy-rain days, spring dry spells, frost nights, last spring
// frost, spring root-zone wetness), with a noise test (web/src/features/shift.js).
//
// Usage: node scripts/build_climate_shift.mjs   (after scripts/fetch_power_all.mjs)
// Reads:  data/power/<province>.json (raw NASA POWER daily, not committed)
// Writes: web/public/data/climate_shift.json

import fs from "node:fs";
import path from "node:path";
import { RECENT_YEARS, Z_CLEAR, Z_POSSIBLE, climateShift } from "../web/src/features/shift.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIR = path.join(ROOT, "data/power");
const provinces = {};
let period = "";
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".json")).sort()) {
  const raw = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
  const s = climateShift(raw.daily);
  provinces[f.replace(/\.json$/, "")] = s;
  period = `${s.years[0]}-${s.years[1]}`;
}
const out = {
  _meta: {
    source: "NASA POWER daily (AG community), the same record as the cached climate features",
    period,
    method: `last ${RECENT_YEARS} complete years vs the earlier years; z = difference / (year-to-year SD x sqrt(1/n_recent + 1/n_early)); clear if |z| >= ${Z_CLEAR}, possible if |z| >= ${Z_POSSIBLE}; hot day = max >= 35 °C, frost night = min < 0 °C, heavy rain day >= 20 mm, dry spell = longest run of days under 1 mm in March-June, spring soil wetness = mean April-May root-zone wetness (NASA model estimate)`,
    built: new Date().toISOString().slice(0, 10),
  },
  provinces,
};
fs.writeFileSync(path.join(ROOT, "web/public/data/climate_shift.json"), JSON.stringify(out) + "\n");
const clear = (k, sign) => Object.values(provinces).filter((p) => p.measures[k]?.level === "clear" && Math.sign(p.measures[k].diff) === sign).length;
console.log(`${Object.keys(provinces).length} provinces (${period}); clearly warmer: ${clear("temp_c", 1)}, clearly more hot days: ${clear("hot_days", 1)}, clearly wetter: ${clear("rain_mm", 1)}, clearly drier: ${clear("rain_mm", -1)}`);
