// The nine vegetables added on 15 Nov: data wiring, calendars, rotation rules.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { checkCrop } from "../web/src/scoring/filter.js";
import { runCropCheck } from "../web/src/scoring/cropCheck.js";
import { matchCrop } from "../web/src/scoring/aliases.js";
import { zoneCalendar } from "../web/src/scoring/calendar.js";
import { withSowingCalendar } from "../web/src/data/loader.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, "web/public/data", p), "utf8"));
const cropTable = J("crops.json");
const byId = Object.fromEntries(cropTable.crops.map((c) => [c.id, c]));
const tables = { cropTable, ruleTable: J("rotation_rules.json"), nutrientTable: J("nutrients.json") };
const tagem = J("tagem_calendar.json");
const plist = J("provinces.json").provinces ?? J("provinces.json");
const VEG = ["pepper", "cucumber", "eggplant", "zucchini", "green_bean", "cabbage", "carrot", "garlic", "lettuce"];

const features = (id, irrigation) => {
  const raw = J(`cache/${id}/features.json`);
  return withSowingCalendar(raw.features ?? raw, plist.find((p) => p.id === id), tagem, irrigation);
};
const check = (province, cropId, previous, irrigation = "irrigated") =>
  runCropCheck({ cropId, previous, features: features(province, irrigation), ...tables, farmer: { irrigation, never_grow: [] }, dataStatus: { power: true } });

test("vegetables are wired into every table with sources", () => {
  const nutrients = J("nutrients.json").crops;
  for (const id of VEG) {
    const c = byId[id];
    assert.ok(c, id);
    assert.equal(c.verified, false, `${id} stays unverified`);
    assert.equal(c.rainfed_ok, false, `${id} is an irrigated crop`);
    assert.match(c.field_sources.temp_opt_c, /FAO EcoCrop/);
    assert.match(c.field_sources.kc, /FAO-56/);
    assert.match(c.field_sources.stages_days, /TAGEM-DSİ/);
    assert.ok(nutrients[id]?.yield_t_ha > 0 && nutrients[id].product, `${id} has yield and nutrients`);
    assert.equal(matchCrop(c.name_tr.split(" (")[0], cropTable.crops).crop?.id, id, `Turkish name finds ${id}`);
  }
  assert.equal(matchCrop("fasulye", cropTable.crops).crop?.id, "dry_bean", "plain 'fasulye' stays dry bean");
  assert.equal(matchCrop("taze fasulye", cropTable.crops).crop?.id, "green_bean");
  assert.ok(!nutrients.green_bean.fixed_kg_n_ha, "green bean fixation is not estimated");
});

test("official TAGEM calendars: pepper in Antalya's zone, carrot in Konya", () => {
  assert.ok(zoneCalendar("pepper", features("antalya", "irrigated")), "pepper listed for the Mediterranean zone");
  assert.ok(zoneCalendar("carrot", features("konya", "irrigated")), "carrot listed for Central Anatolia");
});

test("climate checks: eggplant passes irrigated in Adana; vegetables fail on rain-fed land", () => {
  for (const id of ["pepper", "eggplant", "cucumber", "green_bean"]) {
    assert.equal(checkCrop(byId[id], features("adana", "irrigated"), { irrigation: "irrigated" }).ok, true, id);
  }
  assert.equal(checkCrop(byId.pepper, features("konya", "rainfed"), { irrigation: "rainfed" }).ok, false);
});

test("rotation rules: nightshades, cucurbits and alliums do not follow their own family", () => {
  const pep = check("antalya", "pepper", ["tomato"]);
  assert.ok(pep.reasons.some((r) => r.type === "pest" && /potato and tomato share/.test(r.evidence)), "pepper after tomato");
  const cuc = check("antalya", "cucumber", ["watermelon"]);
  assert.ok(cuc.reasons.some((r) => r.type === "pest" && r.source.startsWith("Oklahoma")), "cucumber after watermelon");
  const gar = check("konya", "garlic", ["onion"]);
  assert.ok(gar.reasons.some((r) => r.type === "pest" && /white rot/.test(r.evidence)), JSON.stringify(gar.reasons.map((r) => r.evidence)));
  const wheat = check("konya", "wheat", ["green_bean"], "irrigated");
  assert.ok(wheat.reasons.some((r) => r.effect === "positive" && /before wheat/.test(r.evidence)), "green bean is a legume before wheat");
});
