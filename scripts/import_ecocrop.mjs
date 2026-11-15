// Import FAO EcoCrop temperature, pH and rainfall ranges into the crop table.
//
// Usage: node scripts/import_ecocrop.mjs
// Reads:  data/sources/EcoCrop_DB.csv, data/sources/ecocrop_crop_map.csv
// Writes: web/public/data/crops.json   (temp_opt_c, temp_abs_c, soil_ph, rain_abs_mm, field_sources)
//         data/sources/ecocrop_import_report.csv   (old vs new value per field)
//
// Not imported: KTMP / KTMPR (killing temperatures). EcoCrop gives barley -4 °C
// during rest, while winter barley survives about -15 °C, so these do not describe
// winter-hardy varieties; the crop table keeps its own hardiness and frost values.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "data/sources");

function parseCsv(text) {
  const rows = [];
  let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { f += '"'; i++; }
      else if (c === '"') q = false;
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
    else if (c !== "\r") f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.length > 1);
  return body.map((r) => Object.fromEntries(head.map((k, i) => [k, r[i]])));
}

const eco = parseCsv(fs.readFileSync(path.join(SRC, "EcoCrop_DB.csv"), "latin1"));
const map = parseCsv(fs.readFileSync(path.join(SRC, "ecocrop_crop_map.csv"), "utf8"));
const file = path.join(ROOT, "web/public/data/crops.json");
const table = JSON.parse(fs.readFileSync(file, "utf8"));

const num = (v) => (v === undefined || v === "" || v === "NA" ? null : +v);
const pair = (a, b) => (num(a) == null || num(b) == null ? null : [num(a), num(b)]);
const report = [];

for (const m of map) {
  const crop = table.crops.find((c) => c.id === m.crop_id);
  const row = eco.find((r) => r.ScientificName === m.ecocrop_name);
  if (!crop || !row) throw new Error(`missing ${m.crop_id} or EcoCrop row ${m.ecocrop_name}`);
  const label = `FAO EcoCrop (${m.ecocrop_name})`;
  const updates = {
    temp_opt_c: [pair(row.TOPMN, row.TOPMX), `${label}: TOPMN-TOPMX, mean temperature`],
    temp_abs_c: [pair(row.TMIN, row.TMAX), `${label}: TMIN-TMAX, mean temperature`],
    soil_ph: [pair(row.PHMIN, row.PHMAX), `${label}: PHMIN-PHMAX (absolute range)`],
    rain_abs_mm: [pair(row.RMIN, row.RMAX), `${label}: RMIN-RMAX, annual rainfall`],
  };
  crop.field_sources = crop.field_sources ?? {};
  for (const [field, [value, source]] of Object.entries(updates)) {
    if (!value) continue;
    report.push({ crop_id: crop.id, field, old: JSON.stringify(crop[field] ?? null), new: JSON.stringify(value), source });
    crop[field] = value;
    crop.field_sources[field] = source;
  }
  if (!crop.sources.includes("FAO EcoCrop")) crop.sources.push("FAO EcoCrop");
}

// Keep the crop table consistent: heat stress at flowering must be above the optimal maximum.
for (const c of table.crops) {
  if (c.heat_stress_c <= c.temp_opt_c[1]) {
    report.push({ crop_id: c.id, field: "heat_stress_c", old: String(c.heat_stress_c), new: String(c.temp_opt_c[1] + 2), source: "raised to stay above EcoCrop TOPMX" });
    c.heat_stress_c = c.temp_opt_c[1] + 2;
  }
}

table._meta.how_to_read += table._meta.how_to_read.includes("field_sources")
  ? ""
  : " field_sources names the source of each imported field. temp_opt_c, temp_abs_c, soil_ph and rain_abs_mm come from FAO EcoCrop (temperatures are mean-temperature limits).";

let s = JSON.stringify(table, null, 2)
  .replace(/\[\s+([^\[\]{}]*?)\s+\]/g, (m, g) => "[" + g.split(/,\s+/).join(", ") + "]")
  .replace(/\{\s+("(ini|base_c)"[^{}]*?)\s+\}/g, (m, g) => "{ " + g.split(/,\s+/).join(", ") + " }");
fs.writeFileSync(file, s + "\n");

const esc = (v) => (/[",]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
fs.writeFileSync(
  path.join(SRC, "ecocrop_import_report.csv"),
  ["crop_id,field,old,new,source", ...report.map((r) => [r.crop_id, r.field, r.old, r.new, r.source].map(esc).join(","))].join("\n") + "\n"
);
const changed = report.filter((r) => r.old !== r.new);
console.log(`${map.length} crops imported; ${changed.length} values changed`);
for (const r of changed) console.log(`  ${r.crop_id.padEnd(13)} ${r.field.padEnd(13)} ${r.old.padEnd(12)} -> ${r.new}`);
