// Build web/public/data/tuik_yields.json: per crop and province, the average TÜİK
// yield (t/ha) for rain-fed and irrigated land, first and second crop, over the
// last complete years, plus the rain-fed planted area where exported.
//
// Usage: node scripts/build_tuik_yields.mjs   (after python -I scripts/tuik_medas_to_csv.py)
// Reads:  data/sources/tuik/tuik_medas_long.csv, data/sources/tuik/tuik_crop_map.csv,
//         web/public/data/provinces.json (plate number -> province id)
// Writes: web/public/data/tuik_yields.json

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "data/sources/tuik");
export const YEARS = [2020, 2021, 2022, 2023, 2024]; // 2025 is provisional
export const MIN_YEARS = 3; // fewer reported years -> no local value
// "Tahıllar ve diğer bitkisel ürünler" has no rain-fed / irrigated split (water "all").
// Rice is only grown flooded, so its unsplit figures are irrigated; other crops keep
// "all" (rain-fed and irrigated together) and the app labels them that way.
export const UNSPLIT_AS = { rice: "irrigated" };

function readCsv(file) {
  const [head, ...lines] = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
  const cols = head.split(",");
  return lines.map((line) => {
    const cells = [];
    let cur = "", q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === "," && !q) { cells.push(cur); cur = ""; }
      else cur += ch;
    }
    cells.push(cur);
    return Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? ""]));
  });
}

const map = Object.fromEntries(readCsv(path.join(SRC, "tuik_crop_map.csv")).map((r) => [r.product_code, r.crop_id]));
const provinces = JSON.parse(fs.readFileSync(path.join(ROOT, "web/public/data/provinces.json"), "utf8"));
const byPlate = Object.fromEntries(provinces.map((p) => [p.plate, p.id]));
const rows = readCsv(path.join(SRC, "tuik_medas_long.csv"));

// group values: crop -> province -> water -> sowing -> measure -> [values]
const acc = {};
for (const r of rows) {
  const crop = map[r.product_code];
  const prov = byPlate[Number(r.province_plate)];
  const year = Number(r.year);
  if (!crop || !prov || !YEARS.includes(year) || !["yield", "planted_area"].includes(r.measure)) continue;
  const sowing = r.sowing === "second" ? "second" : "first"; // "all" = no breakdown; these crops are first crops
  const v = Number(r.value);
  if (!(v > 0)) continue;
  const water = r.water === "all" ? (UNSPLIT_AS[crop] ?? "all") : r.water;
  ((((acc[crop] ??= {})[prov] ??= {})[water] ??= {})[sowing] ??= { yield: [], planted_area: [] })[r.measure].push(v);
}

const out = {};
let n = 0;
for (const [crop, provs] of Object.entries(acc)) {
  for (const [prov, waters] of Object.entries(provs)) {
    for (const [water, sowings] of Object.entries(waters)) {
      for (const [sowing, m] of Object.entries(sowings)) {
        if (m.yield.length < MIN_YEARS) continue;
        const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
        const entry = { t_ha: Math.round(mean(m.yield)) / 100, years: m.yield.length }; // kg/dekar -> t/ha
        if (m.planted_area.length) entry.planted_ha = Math.round(mean(m.planted_area) / 10); // dekar -> ha
        (((out[crop] ??= {})[prov] ??= {})[water] ??= {})[sowing] = entry;
        n++;
      }
    }
  }
}

const result = {
  _meta: {
    source: "TÜİK Merkezi Dağıtım Sistemi (MEDAS), Bitkisel Üretim İstatistikleri, (Kuru / Sulu) - (1. Ekiliş / 2. Ekiliş) ürünleri",
    period: `${YEARS[0]}-${YEARS.at(-1)}`,
    years: `${YEARS[0]}-${YEARS.at(-1)} average (2025 provisional, not used); at least ${MIN_YEARS} reported years`,
    units: "t_ha = tonnes per hectare (TÜİK kg/dekar ÷ 100); planted_ha = planted area in hectares (TÜİK dekar ÷ 10), 5-year mean; rain-fed for the 12-crop export, rain-fed and irrigated for sunflower; 'all' = Tahıllar table, rain-fed and irrigated together (rice counted as irrigated)",
    crops_covered: Object.keys(out).sort(),
  },
  crops: out,
};
fs.writeFileSync(path.join(ROOT, "web/public/data/tuik_yields.json"), JSON.stringify(result) + "\n");
console.log(`${n} crop x province x water x sowing averages for ${Object.keys(out).length} crops: ${Object.keys(out).sort().join(", ")}`);
for (const [crop, prov] of [["wheat", "konya"], ["wheat", "adana"], ["chickpea", "konya"], ["sunflower", "edirne"], ["lentil", "sanliurfa"]]) {
  console.log(`  ${crop} ${prov}:`, JSON.stringify(out[crop]?.[prov]));
}
