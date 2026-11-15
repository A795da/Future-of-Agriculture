// Checks the data files for internal consistency. Run: node scripts/validate_data.mjs
// Exits with code 1 if anything is wrong.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const errors = [];
const check = (cond, msg) => cond || errors.push(msg);
const range = (r) => Array.isArray(r) && r.length === 2 && r[0] < r[1];

// crops
const { families, crops } = read("web/public/data/crops.json");
const cropIds = new Set();
for (const c of crops) {
  const at = `crop ${c.id}`;
  check(!cropIds.has(c.id), `${at}: duplicate id`);
  cropIds.add(c.id);
  check(families[c.family], `${at}: unknown family ${c.family}`);
  check(c.is_legume === (c.family === "fabaceae"), `${at}: is_legume does not match family`);
  check(["winter", "spring", "summer", "perennial"].includes(c.season), `${at}: bad season`);
  check(c.sowing_months.every((m) => m >= 1 && m <= 12), `${at}: bad sowing month`);
  check(c.stages_days.length === 4, `${at}: stages_days needs 4 values`);
  check(
    c.stages_days.reduce((a, b) => a + b, 0) === c.season_days,
    `${at}: stages_days sum ${c.stages_days.reduce((a, b) => a + b, 0)} != season_days ${c.season_days}`
  );
  check(
    c.season === "perennial"
      ? c.sensitive_das === null
      : Number.isInteger(c.sensitive_das) && c.sensitive_das >= 0 && c.sensitive_das + 20 <= c.season_days,
    `${at}: sensitive_das must fall inside the season (null only for perennials)`
  );
  check(c.kc.ini > 0 && c.kc.mid > 0 && c.kc.end > 0 && c.kc.mid <= 1.3, `${at}: kc out of range`);
  check(range(c.temp_opt_c) && range(c.temp_abs_c), `${at}: temperature ranges must be [low, high]`);
  check(
    c.temp_abs_c[0] <= c.temp_opt_c[0] && c.temp_opt_c[1] <= c.temp_abs_c[1],
    `${at}: optimal range must sit inside absolute range`
  );
  check(c.heat_stress_c > c.temp_opt_c[1], `${at}: heat_stress_c should be above optimal max`);
  check(c.frost_damage_c <= 0, `${at}: frost_damage_c should be at or below 0`);
  check(
    (c.season === "winter" || c.season === "perennial") === (c.winter_hardiness_c != null),
    `${at}: winter_hardiness_c only for winter or perennial crops`
  );
  check(range(c.soil_ph) && range(c.root_depth_m), `${at}: soil_ph and root_depth_m must be ranges`);
  check(Array.isArray(c.sources) && c.sources.length > 0, `${at}: needs sources`);
  check(c.verified === false || c.verified === true, `${at}: verified flag missing`);
}
check(crops.length >= 12 && crops.length <= 50, `crop table has ${crops.length} rows (expected 12-50 field and vegetable crops)`);

// provinces and regions
const provinces = read("web/public/data/provinces.json");
const regions = new Set(provinces.map((p) => p.region));
check(provinces.length === 81, `expected 81 provinces, got ${provinces.length}`);
check(regions.size === 7, `expected 7 regions, got ${regions.size}`);
check(provinces.every((p) => p.region), "every province needs a region");

// rotations
const { rotations } = read("web/public/data/rotations.json");
const covered = new Set();
for (const r of rotations) {
  const at = `rotation ${r.id}`;
  for (const c of r.sequence) check(c === "fallow" || cropIds.has(c), `${at}: unknown crop ${c}`);
  for (const c of Object.values(r.second_crops ?? {})) check(cropIds.has(c), `${at}: unknown second crop ${c}`);
  for (const g of r.regions) {
    check(regions.has(g), `${at}: unknown region ${g}`);
    covered.add(g);
  }
  check(["rainfed", "irrigated", "either"].includes(r.irrigation), `${at}: bad irrigation`);
}
for (const g of regions) check(covered.has(g), `region ${g} has no rotation template`);

// frozen reasons contract
const contract = await import(pathToFileURL(path.join(ROOT, "web/src/scoring/contract.js")));
const exErrs = contract.validateResult(contract.EXAMPLE);
check(exErrs.length === 0, `contract EXAMPLE is invalid: ${exErrs.join("; ")}`);
check(contract.validateResult({}).length > 0, "validator accepted an empty object");

if (errors.length) {
  console.log(`FAIL: ${errors.length} problem(s)`);
  for (const e of errors) console.log(" - " + e);
  process.exit(1);
}
console.log(
  `OK: ${crops.length} crops, ${rotations.length} rotations, ${provinces.length} provinces in ${regions.size} regions, contract example valid`
);
