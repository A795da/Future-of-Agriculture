// Run the full pipeline on real NASA POWER data for one province.
// Usage: node scripts/score_demo.mjs <provinceId> [rainfed|irrigated] [current,sequence] [--save]
// Example: node scripts/score_demo.mjs konya rainfed wheat,fallow --save
// --save writes the POWER history to data/power/<id>.json (raw, not committed).

import fs from "node:fs";
import path from "node:path";
import { fetchPowerDaily } from "../web/src/data/power.js";
import { computeClimateFeatures } from "../web/src/features/climate.js";
import { computeVegetationFeatures } from "../web/src/features/vegetation.js";
import { runScoring } from "../web/src/scoring/index.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const [id = "konya", irrigation = "rainfed", seq = "wheat,fallow"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const save = process.argv.includes("--save");

const p = read("web/public/data/provinces.json").find((x) => x.id === id);
if (!p) throw new Error(`unknown province ${id}`);

const cacheDir = path.join(ROOT, "web/public/data/cache", id);
const cacheFile = path.join(ROOT, "data/power", `${id}.json`);
let conditions;
const t0 = Date.now();
if (fs.existsSync(cacheFile)) {
  conditions = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
  console.log(`POWER history from cache`);
} else {
  conditions = await fetchPowerDaily({ lat: p.lat, lon: p.lon, start: new Date("2005-01-01"), end: new Date("2024-12-31") });
  console.log(`POWER 2005-2024 fetched live in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (save) {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(conditions));
    console.log(`saved ${cacheFile}`);
  }
}

const { withSowingCalendar } = await import("../web/src/data/loader.js");
const features = withSowingCalendar(computeClimateFeatures(conditions, p.lat), p, read("web/public/data/tagem_calendar.json"), irrigation);
console.log(`TAGEM zone: ${p.tagem_zone} via station ${p.tagem_station}`);
const ndviFile = path.join(cacheDir, "ndvi.json");
const vegetation = fs.existsSync(ndviFile) ? computeVegetationFeatures(JSON.parse(fs.readFileSync(ndviFile, "utf8"))) : null;

const v = (k) => features[k].value;
console.log(`\n${p.name} (${p.region}), ${irrigation}, current: ${seq}`);
console.log(`rain ${v("annual_rain_mm")} mm/yr (dry year ${v("annual_rain_dry_mm")}), frost-free ${v("frost_free_days")} d, typical winter low ${v("yearly_min_temp_c")} °C, ET0 ${v("monthly_et0_mm").reduce((a, b) => a + b, 0)} mm/yr`);
{
  const { phenology } = await import("../web/src/scoring/calendar.js");
  const cropTable = read("web/public/data/crops.json");
  const date = (doy) => new Date(Date.UTC(2023, 0, doy)).toISOString().slice(5, 10);
  for (const id of ["wheat", "barley"]) {
    const c = cropTable.crops.find((x) => x.id === id);
    const ph = phenology(c, features);
    console.log(`${id}: sown ${date(ph.start)}, flowering ~${date(ph.start + ph.sensitiveDas)}, harvest ~${date(ph.start + ph.season)}`);
  }
}
if (vegetation) console.log(`NDVI: ${vegetation.bare_months.value} low-green months/yr (${vegetation.ndvi_by_month.period})`);

const out = runScoring({
  features,
  vegetation,
  cropTable: read("web/public/data/crops.json"),
  rotationTable: read("web/public/data/rotations.json"),
  nutrientTable: read("web/public/data/nutrients.json"),
  ruleTable: read("web/public/data/rotation_rules.json"),
  farmer: {
    region: p.region,
    irrigation,
    current_sequence: seq.split(","),
    history: seq.split(","),
    priorities: { water: 0.25, soil: 0.25, income: 0.25, simplicity: 0.25 },
    never_grow: [],
  },
  dataStatus: { power: true, soil: false },
});

console.log(`removed: ${out.removed.map((r) => `${r.name} (${r.reasons[0]})`).join("; ")}`);
for (const r of out.results) {
  console.log(`\n${r.is_baseline ? "CURRENT" : "OPTION "} ${r.label}  score ${r.score}  [${r.confidence}]`);
  console.log("  " + Object.entries(r.dimensions).map(([k, x]) => `${k} ${x}`).join(" · ") + `  adj ${r.sequence_adjustment}`);
  for (const x of r.reasons) console.log(`  ${x.effect === "positive" ? "+" : x.effect === "negative" ? "-" : "·"} ${x.type}: ${x.evidence} [${x.source}]`);
  if (r.risks.length) console.log(`  risks: ${r.risks.join(" | ")}`);
}
