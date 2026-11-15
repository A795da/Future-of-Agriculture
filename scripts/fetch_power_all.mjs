// Cache NASA POWER daily history (2005-2024) for every province and compute
// its climate features once, so the app loads a province instantly and works offline.
//
// Usage: node scripts/fetch_power_all.mjs [provinceId ...]
// Raw series:  data/power/<id>.json                      (not committed; re-fetchable)
// Features:    web/public/data/cache/<id>/features.json  (small; read by the app)

import fs from "node:fs";
import path from "node:path";
import { fetchPowerDaily } from "../web/src/data/power.js";
import { computeClimateFeatures } from "../web/src/features/climate.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const provinces = JSON.parse(fs.readFileSync(path.join(ROOT, "web/public/data/provinces.json"), "utf8"));
const ids = process.argv.slice(2);
const list = ids.length ? provinces.filter((p) => ids.includes(p.id)) : provinces;
const RAW = path.join(ROOT, "data/power");
fs.mkdirSync(RAW, { recursive: true });

let ok = 0;
const failed = [];
for (const p of list) {
  const rawFile = path.join(RAW, `${p.id}.json`);
  const legacy = path.join(ROOT, "web/public/data/cache", p.id, "power.json");
  const outDir = path.join(ROOT, "web/public/data/cache", p.id);
  try {
    let conditions;
    if (fs.existsSync(rawFile)) conditions = JSON.parse(fs.readFileSync(rawFile, "utf8"));
    else if (fs.existsSync(legacy)) {
      conditions = JSON.parse(fs.readFileSync(legacy, "utf8"));
      fs.writeFileSync(rawFile, JSON.stringify(conditions));
    } else {
      for (let attempt = 1; ; attempt++) {
        try {
          conditions = await fetchPowerDaily({ lat: p.lat, lon: p.lon, start: new Date("2005-01-01"), end: new Date("2024-12-31") });
          break;
        } catch (e) {
          if (attempt >= 3) throw e;
          await new Promise((r) => setTimeout(r, 3000 * attempt));
        }
      }
      fs.writeFileSync(rawFile, JSON.stringify(conditions));
    }
    const features = computeClimateFeatures(conditions, p.lat);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, "features.json"),
      JSON.stringify({ point: { id: p.id, lat: p.lat, lon: p.lon }, computed: new Date().toISOString(), features })
    );
    if (fs.existsSync(legacy)) fs.unlinkSync(legacy); // raw history now lives in data/power
    ok++;
    console.log(`${String(ok).padStart(2)} ${p.id}: ${features.annual_rain_mm.value} mm/yr, frost-free ${features.frost_free_days.value} d`);
  } catch (e) {
    failed.push(p.id);
    console.log(`FAIL ${p.id}: ${e.message}`);
  }
}
console.log(`\ndone: ${ok} ok, ${failed.length} failed${failed.length ? ": " + failed.join(", ") : ""}`);
