// Field parts and second crops: the farmer's own second crop is scored fully
// (water, soil, pests, nutrients), and the default single-part farm still gives
// exactly the facts the saved AI texts were written for.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { DEFAULT_FARM, effectiveInputs, newPart, defaultRotation } from "../web/src/scoring/defaults.js";
import { scorePart } from "../web/src/scoring/parts.js";
import { withSowingCalendar } from "../web/src/data/loader.js";
import { cacheKey, rotationFacts } from "../web/src/explain/payload.js";
import { cardSummary } from "../web/src/explain/templates.js";
import { validateResult } from "../web/src/scoring/contract.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, "web/public/data", p), "utf8"));
const provinces = J("provinces.json");
const tables = {
  cropTable: J("crops.json"),
  rotationTable: J("rotations.json"),
  nutrientTable: J("nutrients.json"),
  ruleTable: J("rotation_rules.json"),
  provinces: provinces.provinces ?? provinces,
  tagem: J("tagem_calendar.json"),
  tuikYields: J("tuik_yields.json"),
  soilTexture: J("soil_texture.json"),
  waterStorage: J("water_storage.json"),
};
const scenario = { rainPct: 0, tempC: 0 };
const raw = (id) => {
  const r = J(`cache/${id}/features.json`);
  return r.features ?? r;
};
const point = (id) => tables.provinces.find((p) => p.id === id);

function run(id, part, farm = DEFAULT_FARM) {
  const out = scorePart({ part: { ...newPart("x"), ...part }, farm, rawFeatures: raw(id), point: point(id), tables, scenario });
  assert.ok(!out.outcome.error, out.outcome.error);
  return out.outcome.results;
}
const baseline = (results) => results.find((r) => r.is_baseline);

test("default farm: one part, and effectiveInputs gives the active part", () => {
  assert.equal(DEFAULT_FARM.parts.length, 1);
  const farm = { ...DEFAULT_FARM, parts: [newPart("p1"), { ...newPart("p2"), irrigation: "irrigated", current: ["maize"] }], activePart: "p2" };
  const e = effectiveInputs(farm);
  assert.equal(e.irrigation, "irrigated");
  assert.deepEqual(e.current, ["maize"]);
  assert.equal(e.priorities, DEFAULT_FARM.priorities);
});

test("default single-part farm still matches the saved AI texts (Konya)", () => {
  const cache = J("explain_cache.json").entries;
  const p = point("konya");
  const current = defaultRotation(tables, p.region, withSowingCalendar(raw("konya"), p, tables.tagem, "rainfed"));
  const results = run("konya", { current });
  const b = baseline(results);
  for (const r of results) {
    const ref = r.is_baseline ? undefined : b;
    const key = cacheKey("rotation", "en", rotationFacts(r, ref, cardSummary(r, ref)));
    assert.ok(cache[key], `no saved text for ${r.label}`);
  }
});

test("irrigated wheat + second-crop maize needs more water than wheat alone", () => {
  const alone = baseline(run("adana", { irrigation: "irrigated", current: ["wheat", "cotton"] }));
  const twice = baseline(run("adana", { irrigation: "irrigated", current: ["wheat", "cotton"], second: { 0: "maize" } }));
  assert.deepEqual(twice.second_crops, { 0: "maize" });
  assert.match(twice.label, /\+/);
  assert.ok(twice.dimensions.water < alone.dimensions.water, `${twice.dimensions.water} !< ${alone.dimensions.water}`);
  assert.deepEqual(validateResult(twice), []);
  // wheat then maize are both cereals: a same-family pair the plain rotation does not have
  assert.ok(twice.dimensions.pest < alone.dimensions.pest);
});

test("a rain-fed second crop is flagged as relying on summer rain", () => {
  const r = baseline(run("konya", { current: ["wheat", "fallow"], second: { 0: "sunflower" } }));
  assert.ok(r.risks.some((x) => /relies on summer rain/.test(x)), r.risks.join(" | "));
  assert.ok(r.gaps.some((g) => /second crops are checked/.test(g)));
});

test("a legume second crop adds to soil health and the nitrogen credit", () => {
  const alone = baseline(run("adana", { irrigation: "irrigated", current: ["wheat", "maize"] }));
  const soy = baseline(run("adana", { irrigation: "irrigated", current: ["wheat", "maize"], second: { 0: "soybean" } }));
  assert.ok(soy.dimensions.soil > alone.dimensions.soil);
  assert.ok((soy.nutrients?.n_fixed ?? 0) > (alone.nutrients?.n_fixed ?? 0));
});

test("rotations without a second crop score exactly as before the change", () => {
  const a = baseline(run("konya", { current: ["wheat", "chickpea"] }));
  const b = baseline(run("konya", { current: ["wheat", "chickpea"], second: {} }));
  assert.deepEqual(a, b);
  assert.equal(a.second_crops, null);
});

// ---- Ministry support rule (Tebliğ 2024/39, Art. 13) and second-crop season fit
import { supportRuleBreach } from "../web/src/scoring/support.js";
import { runCropCheck, validateCheck } from "../web/src/scoring/cropCheck.js";

const cropsById = Object.fromEntries(tables.cropTable.crops.map((c) => [c.id, c]));

test("support rule: the same crop more than twice in a row, rice and perennials exempt", () => {
  assert.equal(supportRuleBreach(["wheat"], cropsById), "wheat");
  assert.equal(supportRuleBreach(["wheat", "wheat"], cropsById), "wheat");
  assert.equal(supportRuleBreach(["wheat", "spring_wheat", "wheat"], cropsById), "wheat"); // same product
  assert.equal(supportRuleBreach(["wheat", "wheat", "barley"], cropsById), null);
  assert.equal(supportRuleBreach(["wheat", "fallow"], cropsById), null);
  assert.equal(supportRuleBreach(["rice"], cropsById), null);
  assert.equal(supportRuleBreach(["alfalfa"], cropsById), null);
  // no shipped template breaks the rule (apart from rice, which is exempt)
  for (const r of tables.rotationTable.rotations) assert.equal(supportRuleBreach(r.sequence, cropsById), null, r.id);
});

test("support rule: wheat every year gets the warning on its card", () => {
  const r = baseline(run("konya", { current: ["wheat"] }));
  assert.ok(r.risks.some((x) => /Tebliğ 2024\/39/.test(x)), r.risks.join(" | "));
  const ok = baseline(run("konya", { current: ["wheat", "fallow"] }));
  assert.ok(!ok.risks.some((x) => /Tebliğ 2024\/39/.test(x)));
});

test("support rule: crop check warns when wheat would be the third year in a row", () => {
  const f = scorePart({ part: newPart("x"), farm: DEFAULT_FARM, rawFeatures: raw("konya"), point: point("konya"), tables, scenario }).features;
  const r = runCropCheck({ cropId: "wheat", previous: ["wheat", "wheat"], features: f, ...tables, farmer: { irrigation: "rainfed", never_grow: [] }, dataStatus: { power: true } });
  assert.ok(r.reasons.some((x) => x.level === "caution" && /third year in a row/.test(x.evidence)));
  if (validateCheck) assert.deepEqual(validateCheck(r), []);
  const once = runCropCheck({ cropId: "wheat", previous: ["wheat", "chickpea"], features: f, ...tables, farmer: { irrigation: "rainfed", never_grow: [] }, dataStatus: { power: true } });
  assert.ok(!once.reasons.some((x) => /third year in a row/.test(x.evidence)));
});

test("season fit: second-crop maize after wheat is too late in Erzurum, fine where TAGEM lists it", () => {
  const cold = baseline(run("erzurum", { irrigation: "irrigated", current: ["wheat", "potato"], second: { 0: "maize" } }));
  assert.ok(cold.risks.some((x) => /season is too short/.test(x)), cold.risks.join(" | "));
  const warm = baseline(run("adana", { irrigation: "irrigated", current: ["wheat", "cotton"], second: { 0: "maize" } }));
  assert.ok(!warm.risks.some((x) => /season is too short/.test(x)), warm.risks.join(" | "));
});

// ---- Season plan: crop calendar and per-crop nutrients (Overview)
import { rotationCalendar } from "../web/src/scoring/calendar.js";

test("season plan: Konya wheat > chickpea dates, bare gaps and per-crop nutrients", () => {
  const out = scorePart({ part: { ...newPart("x"), current: ["wheat", "chickpea"] }, farm: DEFAULT_FARM, rawFeatures: raw("konya"), point: point("konya"), tables, scenario });
  const cal = rotationCalendar(["wheat", "chickpea"], {}, cropsById, out.features);
  const [wheat, chickpea] = cal.plantings;
  assert.equal(wheat.id, "wheat");
  assert.ok(wheat.sowDoy >= 260 && wheat.sowDoy <= 305, `wheat sown on day ${wheat.sowDoy}`); // October
  assert.ok(wheat.harvestDoy >= 150 && wheat.harvestDoy <= 200, `wheat harvested on day ${wheat.harvestDoy}`); // June-July
  assert.ok(wheat.flowerDoy > 90 && wheat.flowerDoy < wheat.harvestDoy);
  assert.equal(chickpea.id, "chickpea");
  assert.equal(cal.gaps.length, 2);
  assert.ok(cal.gaps.every((g) => g.days >= 20));
  const b = baseline(out.outcome.results);
  const per = b.nutrients.per_crop;
  assert.equal(per.length, 2);
  assert.ok(per.find((n) => n.id === "chickpea").n_fixed > 0);
  assert.ok(per.find((n) => n.id === "wheat").n > 0);
});

test("season plan: a second crop gets its own planting after the main harvest", () => {
  const out = scorePart({ part: { ...newPart("x"), irrigation: "irrigated", current: ["wheat", "cotton"], second: { 0: "maize" } }, farm: DEFAULT_FARM, rawFeatures: raw("adana"), point: point("adana"), tables, scenario });
  const cal = rotationCalendar(["wheat", "cotton"], { 0: "maize" }, cropsById, out.features);
  const maize = cal.plantings.find((p) => p.id === "maize");
  const wheat = cal.plantings.find((p) => p.id === "wheat");
  assert.ok(maize.second);
  assert.ok(maize.offset >= wheat.offset + wheat.days, "maize starts after the wheat harvest");
});
