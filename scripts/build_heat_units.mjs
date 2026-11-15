// Copy FAO AquaCrop thermal-time parameters into the crop table (heat_units field)
// for the crops mapped with use = heat_check.
//
// Usage: node scripts/build_heat_units.mjs   (after python -I scripts/extract_aquacrop.py)
// Reads:  data/sources/aquacrop_gdd.csv, data/sources/aquacrop_crop_map.csv
// Writes: web/public/data/crops.json (adds or replaces heat_units on mapped crops)

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const csv = (file) => {
  const [head, ...rows] = fs.readFileSync(path.join(ROOT, "data/sources", file), "utf8").trim().split(/\r?\n/);
  const keys = head.split(",");
  return rows.map((line) => {
    const vals = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((v) => v.replace(/,$/, "").replace(/^"|"$/g, ""));
    return Object.fromEntries(keys.map((k, i) => [k, vals[i]]));
  });
};

const gdd = Object.fromEntries(csv("aquacrop_gdd.csv").map((r) => [r.aquacrop_name, r]));
const map = csv("aquacrop_crop_map.csv").filter((m) => m.use === "heat_check");
const file = path.join(ROOT, "web/public/data/crops.json");
const table = JSON.parse(fs.readFileSync(file, "utf8"));

for (const crop of table.crops) delete crop.heat_units;
for (const m of map) {
  const crop = table.crops.find((c) => c.id === m.crop_id);
  const g = gdd[m.aquacrop_name];
  if (!crop || !g) throw new Error(`missing ${m.crop_id} or ${m.aquacrop_name}`);
  crop.heat_units = {
    base_c: +g.tbase_c,
    upper_c: +g.tupp_c,
    flowering_gdd: +g.flowering_start_gdd,
    maturity_gdd: +g.maturity_gdd,
    source: `FAO AquaCrop default crop file (${m.aquacrop_name}, AquaCrop-OSPy ${g.source_commit.slice(0, 10)})`,
  };
  if (!crop.sources.includes("FAO AquaCrop")) crop.sources.push("FAO AquaCrop");
}
table._meta.how_to_read +=
  table._meta.how_to_read.includes("heat_units") ? "" :
  " heat_units (warm-season crops): growing degree days between base_c and upper_c needed to reach flowering and maturity, from the FAO AquaCrop default crop files (typical varieties; local short-season varieties may need less).";

let s = JSON.stringify(table, null, 2)
  .replace(/\[\s+([^\[\]{}]*?)\s+\]/g, (m, g) => "[" + g.split(/,\s+/).join(", ") + "]")
  .replace(/\{\s+("(ini|base_c)"[^{}]*?)\s+\}/g, (m, g) => "{ " + g.split(/,\s+/).join(", ") + " }");
fs.writeFileSync(file, s + "\n");
console.log(`heat_units set on: ${map.map((m) => m.crop_id).join(", ")}`);
