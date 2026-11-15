// Scoring unit tests with known inputs. Run: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runScoring } from "../web/src/scoring/index.js";
import { scoreRotation, weightsFrom } from "../web/src/scoring/score.js";
import { checkCrop } from "../web/src/scoring/filter.js";
import { validateResult } from "../web/src/scoring/contract.js";
import { applyScenario } from "../web/src/features/scenario.js";
import { computeTerrainFeatures, gridAroundPin } from "../web/src/features/terrain.js";
import { et0Hargreaves } from "../web/src/features/climate.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const cropTable = JSON.parse(fs.readFileSync(path.join(ROOT, "web/public/data/crops.json"), "utf8"));
const rotationTable = JSON.parse(fs.readFileSync(path.join(ROOT, "web/public/data/rotations.json"), "utf8"));
const cropsById = Object.fromEntries(cropTable.crops.map((c) => [c.id, c]));

// A semi-arid, Konya-like climate (~320 mm/year, cold winters, hot dry summers).
function konyaLike() {
  const F = (value, unit = "") => ({ value, unit, source: "test", kind: "NASA reanalysis", period: "test" });
  const tmin = [-5, -4, -1, 4, 8, 12, 16, 15, 11, 5, 0, -3];
  const tmax = [5, 7, 12, 18, 23, 28, 31, 31, 27, 20, 12, 7];
  const rain = [36, 28, 30, 38, 40, 22, 6, 5, 10, 30, 32, 40];
  const dry = rain.map((r) => Math.round(r * 0.6));
  const et0 = [15, 25, 55, 85, 120, 150, 175, 160, 115, 70, 30, 15];
  const dek = (monthly) => monthly.flatMap((v) => [v, v, v]); // 36 dekads
  const years = Array.from({ length: 20 }, (_, i) => ({
    year: 2005 + i,
    tmin_abs: dek(tmin.map((t, m) => t - 8 - (m === 3 && i % 5 === 0 ? 3 : 0))),
    tmax_abs: dek(tmax.map((t) => t + 6)),
  }));
  return {
    monthly_tmin_c: F(tmin), monthly_tmax_c: F(tmax), monthly_rain_mm: F(rain),
    monthly_rain_dry_mm: F(dry), monthly_et0_mm: F(et0), annual_rain_mm: F(317),
    annual_rain_dry_mm: F(250), last_spring_frost_doy: F(110), first_autumn_frost_doy: F(290),
    frost_free_days: F(180), yearly_min_temp_c: F(-16), heavy_rain_days_per_year: F(1.5),
    dekad_extremes_by_year: F(years),
  };
}

const farmer = (over = {}) => ({
  region: "central-anatolia",
  irrigation: "rainfed",
  current_sequence: ["wheat", "fallow"],
  history: ["wheat", "fallow"],
  priorities: { water: 0.25, soil: 0.25, income: 0.25, simplicity: 0.25 },
  never_grow: [],
  ...over,
});

const run = (over = {}, extra = {}) =>
  runScoring({ features: konyaLike(), cropTable, rotationTable, farmer: farmer(over), dataStatus: { power: true }, ...extra });

const score = (sequence, over = {}) =>
  scoreRotation({ id: "t", sequence }, { f: konyaLike(), cropsById, farmer: farmer(over), terrain: null });

test("rain-fed Konya removes crops that need irrigation", () => {
  const { removed } = run();
  const ids = removed.map((r) => r.id);
  for (const id of ["maize", "cotton", "sugar_beet", "potato", "tomato", "dry_bean", "alfalfa"]) {
    assert.ok(ids.includes(id), `${id} should be removed`);
  }
  for (const id of ["wheat", "barley", "chickpea"]) assert.ok(!ids.includes(id), `${id} should pass`);
});

test("returns the baseline first plus two valid alternatives", () => {
  const { results } = run();
  assert.equal(results.length, 3);
  assert.equal(results[0].is_baseline, true);
  assert.deepEqual(results[0].sequence, ["wheat", "fallow"]);
  for (const r of results) assert.deepEqual(validateResult(r), [], r.id);
  assert.notDeepEqual(results[1].sequence, results[0].sequence);
});

test("legume rotation beats wheat-fallow on soil health; fallow raises erosion risk", () => {
  const fallow = score(["wheat", "fallow"]);
  const legume = score(["wheat", "chickpea", "barley"]);
  const vetch = score(["wheat", "vetch"]);
  assert.ok(legume.dimensions.soil > fallow.dimensions.soil);
  assert.ok(vetch.dimensions.erosion > fallow.dimensions.erosion);
});

test("monoculture scores lowest on pest-cycle break", () => {
  const mono = score(["wheat"]);
  const rot = score(["wheat", "chickpea", "barley"]);
  assert.ok(mono.dimensions.pest < rot.dimensions.pest);
  assert.ok(mono.sequence_adjustment < 0);
});

test("never-grow crops never appear in the alternatives", () => {
  const { results, removed } = run({ never_grow: ["chickpea"] });
  assert.ok(removed.some((r) => r.id === "chickpea" && r.reasons[0].includes("never-grow")));
  for (const r of results.filter((x) => !x.is_baseline)) assert.ok(!r.sequence.includes("chickpea"));
});

test("a drier scenario lowers water fit and is marked what-if", () => {
  const base = run();
  const dry = run({}, { scenario: { rainPct: -20 } });
  assert.equal(dry.what_if, true);
  assert.ok(dry.results[0].dimensions.water <= base.results[0].dimensions.water);
  assert.ok(dry.results.every((r) => r.what_if));
});

test("a what-if scenario re-ranks options but never removes them", () => {
  const base = run();
  const dry = run({}, { scenario: { rainPct: -30, tempC: 2 } });
  assert.deepEqual(dry.removed.map((r) => r.id), base.removed.map((r) => r.id));
  assert.equal(dry.results.length, base.results.length);
});

test("builds labelled rotations when fewer than two templates are usable", () => {
  // Allow only wheat, barley and chickpea: one template (wheat-chickpea-barley) is
  // usable, so the generator must build the second option. Robust to new templates.
  const never = cropTable.crops.map((c) => c.id).filter((id) => !["wheat", "barley", "chickpea"].includes(id));
  const { results } = run({ never_grow: never });
  const alts = results.filter((r) => !r.is_baseline);
  assert.equal(alts.length, 2);
  assert.ok(alts.some((r) => r.id.startsWith("generated-")));
  for (const r of alts.filter((x) => x.id.startsWith("generated-"))) {
    assert.equal(r.confidence, "low");
    assert.ok(r.risks.some((x) => x.includes("not a known local rotation")));
    assert.ok(!r.sequence.some((id) => never.includes(id)));
  }
});

test("warming shifts temperatures and frost dates", () => {
  const f = applyScenario(konyaLike(), { tempC: 2 });
  assert.equal(f.monthly_tmax_c.value[6], 33);
  assert.equal(f.frost_free_days.value, 200);
});

test("priority sliders change the weights and the score", () => {
  const w = weightsFrom({ water: 1, soil: 0, income: 0, simplicity: 0 });
  const total = Object.values(w).reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
  const a = score(["wheat", "fallow"], { priorities: { water: 1, soil: 0, income: 0, simplicity: 0 } });
  const b = score(["wheat", "fallow"], { priorities: { water: 0, soil: 1, income: 0, simplicity: 0 } });
  assert.notEqual(a.score, b.score);
});

test("irrigated field allows irrigated crops", () => {
  const { removed } = run({ irrigation: "irrigated" });
  assert.ok(!removed.some((r) => r.id === "sugar_beet"));
});

test("terrain plane fit recovers a known slope", () => {
  const pts = gridAroundPin([32.5, 37.9], 30);
  // elevation rises 3 m per 30 m to the north = 10% slope
  const elev = pts.map(([, lat]) => 1000 + ((lat - 37.9) * 110540) * 0.1);
  const t = computeTerrainFeatures(pts, elev);
  assert.ok(Math.abs(t.mean_slope_pct.value - 10) < 0.2, `got ${t.mean_slope_pct.value}`);
});

test("Hargreaves ET0 is in a sensible summer range", () => {
  const e = et0Hargreaves(16, 31, 23.5, 196, 37.9);
  assert.ok(e > 5 && e < 8, `got ${e}`);
});

test("winter crop calendars follow local temperature", async () => {
  const { phenology } = await import("../web/src/scoring/calendar.js");
  const cold = konyaLike();
  const warm = applyScenario(konyaLike(), { tempC: 4 });
  const a = phenology(cropsById.wheat, cold);
  const b = phenology(cropsById.wheat, warm);
  assert.ok(b.sensitiveDas <= a.sensitiveDas, "warmer place flowers no later");
  assert.ok(b.season <= a.season, "warmer place matures no later");
  assert.equal(a.stages.reduce((s, v) => s + v, 0), a.season);
});

test("a cool, short summer rules out sunflower by heat units; a warm one keeps it", async () => {
  const { heatUnits } = await import("../web/src/scoring/heat.js");
  // Erzurum-like plateau: cool summer, first autumn frost in late September.
  const cool = konyaLike();
  cool.monthly_tmin_c.value = [-15, -14, -8, 0, 4, 8, 12, 12, 7, 2, -5, -11];
  cool.monthly_tmax_c.value = [-4, -2, 3, 12, 17, 22, 27, 27, 23, 15, 6, -1];
  cool.first_autumn_frost_doy.value = 265;
  cool.last_spring_frost_doy.value = 150;
  cool.frost_free_days.value = 115;
  const irrigated = farmer({ irrigation: "irrigated" });
  const cold = checkCrop(cropsById.sunflower, cool, irrigated);
  assert.equal(cold.ok, false);
  assert.ok(cold.reasons.some((r) => r.includes("too cool") && r.includes("AquaCrop")), cold.reasons.join("; "));

  const warm = konyaLike();
  const h = heatUnits(cropsById.sunflower, warm, 91);
  assert.ok(h.ratio >= 0.85, `Konya-like summer should give enough heat, got ${h.available}`);
  assert.ok(checkCrop(cropsById.sunflower, warm, irrigated).reasons.every((r) => !r.includes("too cool")));
});

test("heat units do not change season length (AquaCrop varieties are long-season)", async () => {
  const { phenology } = await import("../web/src/scoring/calendar.js");
  const ph = phenology(cropsById.sunflower, konyaLike());
  assert.equal(ph.season, cropsById.sunflower.season_days);
});

test("an official zone calendar overrides the generic heat and season checks", () => {
  const cool = konyaLike();
  cool.monthly_tmin_c.value = [-15, -14, -8, 0, 4, 8, 12, 12, 7, 2, -5, -11];
  cool.monthly_tmax_c.value = [-4, -2, 3, 12, 17, 22, 27, 27, 23, 15, 6, -1];
  cool.first_autumn_frost_doy.value = 265;
  cool.frost_free_days.value = 115;
  cool.sowing_calendar = {
    value: { sugar_beet: { sow_month: 4, sow_dekad: 3, stages: [30, 45, 60, 30], season: 165, use: "full" } },
    listed: ["sugar_beet"],
    mapped: ["sugar_beet"],
  };
  const r = checkCrop(cropsById.sugar_beet, cool, farmer({ irrigation: "irrigated" }));
  assert.ok(r.reasons.every((x) => !x.includes("too cool") && !x.includes("frost-free")), r.reasons.join("; "));
});

test("nutrient balance: legumes add nitrogen, P and K are only removed", async () => {
  const { nutrientBalance } = await import("../web/src/scoring/nutrients.js");
  const table = JSON.parse(fs.readFileSync(path.join(ROOT, "web/public/data/nutrients.json"), "utf8"));
  const fallow = nutrientBalance(["wheat", "fallow"], null, table);
  const legume = nutrientBalance(["wheat", "chickpea"], null, table);
  assert.equal(fallow.n_fixed, 0);
  assert.ok(fallow.n_net < 0, "wheat-fallow mines nitrogen");
  assert.ok(legume.n_net > fallow.n_net, "chickpea improves the nitrogen balance");
  assert.ok(legume.p2o5_removed > 0 && legume.k2o_removed > 0, "P and K are only removed");
  // second crops count too
  const second = nutrientBalance(["wheat", "cotton"], { 0: "maize" }, table);
  const plain = nutrientBalance(["wheat", "cotton"], null, table);
  assert.ok(second.n_removed > plain.n_removed);
  // alfalfa: fixation known, removal not
  assert.deepEqual(nutrientBalance(["alfalfa"], null, table).missing, ["alfalfa"]);
});

test("rotation results carry the nutrient balance when the table is given", () => {
  const nutrientTable = JSON.parse(fs.readFileSync(path.join(ROOT, "web/public/data/nutrients.json"), "utf8"));
  const { results } = run({}, { nutrientTable });
  for (const r of results) {
    assert.ok(r.nutrients && Number.isFinite(r.nutrients.n_net), r.id);
    assert.ok(r.reasons.some((x) => x.source.includes("Ludemann")), r.id);
    assert.deepEqual(validateResult(r), []);
  }
});

test("rotation rules: return intervals, family repeats and good preceding crops", async () => {
  const { applyRotationRules } = await import("../web/src/scoring/rules.js");
  const rules = JSON.parse(fs.readFileSync(path.join(ROOT, "web/public/data/rotation_rules.json"), "utf8"));
  const ids = (seq) => applyRotationRules(seq, cropsById, rules).hits.map((h) => h.rule.id);

  assert.ok(ids(["wheat", "sunflower"]).includes("sunflower_gap"), "sunflower every 2 years breaks the 4-year rule");
  assert.ok(!ids(["wheat", "sunflower", "barley", "chickpea"]).includes("sunflower_gap"), "every 4 years is fine");
  assert.ok(ids(["wheat"]).includes("cereal_repeat"), "wheat after wheat");
  assert.ok(ids(["wheat", "chickpea"]).includes("legume_before_cereal"));
  assert.ok(ids(["potato", "tomato", "wheat"]).includes("nightshade_repeat"));
  assert.ok(ids(["canola", "potato", "wheat", "barley"]).includes("brassica_before_potato"));
  assert.ok(ids(["sugar_beet", "wheat"]).includes("sugar_beet_gap"));

  const bad = applyRotationRules(["wheat", "sunflower"], cropsById, rules);
  // chickpea every 4 years, before a cereal, sunflower every 4 years: only benefits
  const good = applyRotationRules(["wheat", "chickpea", "barley", "sunflower"], cropsById, rules);
  assert.ok(bad.adjustment < 0 && good.adjustment > 0, `${bad.adjustment} / ${good.adjustment}`);
  // a 2-year wheat-chickpea breaks chickpea's 3-year rule even though the legume helps the wheat
  assert.ok(ids(["wheat", "chickpea"]).includes("chickpea_gap"));
  // every rule carries a source and a link
  for (const r of rules.rules) assert.ok(r.source && r.url.startsWith("http"), r.id);
});

test("rule hits appear as sourced evidence and risks on the cards", () => {
  const ruleTable = JSON.parse(fs.readFileSync(path.join(ROOT, "web/public/data/rotation_rules.json"), "utf8"));
  const { results } = run({ current_sequence: ["wheat", "sunflower"], irrigation: "irrigated" }, { ruleTable });
  const base = results[0];
  assert.ok(base.risks.some((r) => r.includes("sunflower comes back every 2 years")), base.risks.join(" | "));
  assert.ok(base.reasons.some((r) => r.source.startsWith("Shevchenko")));
  for (const r of results) assert.deepEqual(validateResult(r), []);
});

test("winter cold removes non-hardy winter crops", () => {
  const f = konyaLike();
  f.yearly_min_temp_c.value = -18;
  const lentil = checkCrop(cropsById.lentil, f, farmer());
  const wheat = checkCrop(cropsById.wheat, f, farmer());
  assert.equal(lentil.ok, false);
  assert.equal(wheat.ok, true);
});
