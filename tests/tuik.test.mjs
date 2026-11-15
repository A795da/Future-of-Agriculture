// TÜİK province statistics: local yields in the nutrient numbers and "grown here"
// evidence in the crop check.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { localYields } from "../web/src/scoring/yields.js";
import { nutrientBalance } from "../web/src/scoring/nutrients.js";
import { runCropCheck, validateCheck } from "../web/src/scoring/cropCheck.js";
import { runScoring } from "../web/src/scoring/index.js";
import { validateResult } from "../web/src/scoring/contract.js";
import { withSowingCalendar } from "../web/src/data/loader.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, "web/public/data", p), "utf8"));
const tuik = J("tuik_yields.json");
const nutrientTable = J("nutrients.json");
const cropTable = J("crops.json");
const plist = J("provinces.json");
const features = (id, irrigation = "rainfed") => {
  const raw = J(`cache/${id}/features.json`);
  return withSowingCalendar(raw.features ?? raw, plist.find((p) => p.id === id), J("tagem_calendar.json"), irrigation);
};

test("TÜİK yields: province, water regime and units", () => {
  assert.ok(tuik.crops.wheat && tuik.crops.chickpea && tuik.crops.sunflower, tuik._meta.crops_covered.join(","));
  const konya = tuik.crops.wheat.konya;
  assert.ok(konya.rainfed.first.t_ha > 1.5 && konya.rainfed.first.t_ha < 3.5, "rain-fed wheat in t/ha");
  assert.ok(konya.irrigated.first.t_ha > konya.rainfed.first.t_ha, "irrigated beats rain-fed");
  assert.ok(konya.rainfed.first.years >= 3 && konya.rainfed.first.planted_ha > 100000);
  assert.ok(tuik.crops.sunflower.edirne.rainfed.second, "second-crop yields kept separately");
  const lr = localYields(tuik, "konya", "rainfed");
  assert.equal(lr.irrigation, "rainfed");
  assert.equal(lr.crops.wheat.first.t_ha, konya.rainfed.first.t_ha);
  assert.equal(localYields(tuik, "konya", "irrigated").crops.wheat.first.t_ha, konya.irrigated.first.t_ha);
  assert.equal(localYields(null, "konya", "rainfed"), null);
});

test("nutrient numbers use the local yield and say so; national yield otherwise", () => {
  const local = localYields(tuik, "konya", "rainfed");
  const withLocal = nutrientBalance(["wheat", "chickpea"], null, nutrientTable, local);
  const national = nutrientBalance(["wheat", "chickpea"], null, nutrientTable, null);
  assert.deepEqual(withLocal.yields_local.sort(), ["chickpea", "wheat"]);
  assert.ok(withLocal.n_removed < national.n_removed, "Konya rain-fed yields are below the national average");
  assert.ok(withLocal.n_fixed < national.n_fixed, "fixation scales with the lower chickpea yield");
  const mixed = nutrientBalance(["wheat", "onion"], null, nutrientTable, local);
  assert.deepEqual(mixed.yields_national, ["onion"], "no TÜİK onion (vegetables table not exported): national fallback");
  // Sugar beet comes from the unsplit Tahıllar table: local, flagged as rain-fed and irrigated together.
  const beet = nutrientBalance(["wheat", "sugar_beet"], null, nutrientTable, localYields(tuik, "konya", "irrigated"));
  assert.deepEqual(beet.yields_mixed, ["sugar_beet"]);
  assert.ok(beet.yields_local.includes("sugar_beet"));
});

test("rotation cards: TÜİK named as the yield source and in the gaps", () => {
  const point = plist.find((p) => p.id === "konya");
  const { results } = runScoring({
    features: features("konya"), cropTable, rotationTable: J("rotations.json"), nutrientTable, ruleTable: J("rotation_rules.json"),
    localYields: localYields(tuik, "konya", "rainfed"),
    farmer: { region: point.region, irrigation: "rainfed", current_sequence: ["wheat", "fallow"], history: ["wheat", "fallow"], priorities: {}, never_grow: [] },
    dataStatus: { power: true },
  });
  const base = results[0];
  assert.ok(base.reasons.some((r) => r.source.startsWith("TÜİK province yields")));
  assert.ok(base.gaps.some((g) => g.includes("TÜİK rain-fed yields for this province")), base.gaps.join(" | "));
  for (const r of results) assert.deepEqual(validateResult(r), []);
});

test("crop check: 'grown here' from TÜİK, and a warning where TÜİK reports none", () => {
  const check = (province, cropId) =>
    runCropCheck({
      cropId, previous: ["wheat"], features: features(province), cropTable, nutrientTable, ruleTable: J("rotation_rules.json"),
      localYields: localYields(tuik, province, "rainfed"), farmer: { irrigation: "rainfed", never_grow: [] }, dataStatus: { power: true },
    });
  const grown = check("konya", "chickpea");
  const here = grown.reasons.find((r) => r.type === "local");
  assert.ok(here && here.effect === "positive" && here.kind === "official statistics", JSON.stringify(here));
  assert.deepEqual(validateCheck(grown), []);
  // a province with cached climate but no rain-fed chickpea in TÜİK
  const none = plist.find((p) => fs.existsSync(path.join(ROOT, "web/public/data/cache", p.id, "features.json")) && !tuik.crops.chickpea[p.id]?.rainfed);
  assert.ok(none, "some province reports no rain-fed chickpea");
  const absent = check(none.id, "chickpea");
  const miss = absent.reasons.find((r) => r.type === "local");
  assert.ok(miss && miss.effect === "negative" && miss.level === "info", JSON.stringify(miss));
  assert.ok(absent.risks.some((r) => r.includes("TÜİK reports no rain-fed chickpea")));
  // crops TÜİK does not cover yet get no local line at all
  assert.ok(!check("konya", "onion").reasons.some((r) => r.type === "local"));
});

test("observed farming beats the model: TÜİK-grown crops keep failed water/warmth checks as risks", async () => {
  const { checkCrop } = await import("../web/src/scoring/filter.js");
  const byId = Object.fromEntries(cropTable.crops.map((c) => [c.id, c]));
  const rainfed = { irrigation: "rainfed", never_grow: [] };
  const f = features("konya");
  // Without TÜİK data the dry-year check removes rain-fed sunflower in Konya ...
  const model = checkCrop(byId.sunflower, f, rainfed);
  assert.equal(model.ok, false);
  assert.ok(model.details.some((d) => d.check === "dry_year"), JSON.stringify(model.details));
  // ... with TÜİK (rain-fed sunflower reported in Konya) it stays, with the failure as a caution.
  const local = localYields(tuik, "konya", "rainfed");
  const seen = checkCrop(byId.sunflower, f, rainfed, local);
  assert.equal(seen.ok, true, seen.reasons.join("; "));
  assert.ok(seen.cautions.some((c) => c.check === "dry_year" && c.evidence.includes("TÜİK reports rain-fed")));
  const check = runCropCheck({
    cropId: "sunflower", previous: ["wheat"], features: f, cropTable, nutrientTable, ruleTable: J("rotation_rules.json"),
    localYields: local, farmer: rainfed, dataStatus: { power: true },
  });
  assert.equal(check.verdict, "possible_with_care");
  assert.deepEqual(validateCheck(check), []);
  // Winter cold stays a hard check even where TÜİK reports the crop.
  const cold = plist.find((p) => {
    const fp = path.join(ROOT, "web/public/data/cache", p.id, "features.json");
    return fs.existsSync(fp) && tuik.crops.wheat[p.id]?.rainfed && !checkCrop(byId.wheat, features(p.id), rainfed).ok;
  });
  if (cold) assert.equal(checkCrop(byId.wheat, features(cold.id), rainfed, localYields(tuik, cold.id, "rainfed")).ok, false);
  // Dry bean is allowed rain-fed (TÜİK reports it in about 50 provinces).
  assert.equal(byId.dry_bean.rainfed_ok, true);
  // A few hectares province-wide are not proof: below OBSERVED_MIN_HA the NASA check stays a removal.
  const { OBSERVED_MIN_HA } = await import("../web/src/scoring/filter.js");
  const tiny = tuik.crops.dry_bean.hatay.rainfed.first;
  assert.ok(tiny.planted_ha < OBSERVED_MIN_HA, JSON.stringify(tiny));
  const hatay = checkCrop(byId.dry_bean, features("hatay"), rainfed, localYields(tuik, "hatay", "rainfed"));
  assert.equal(hatay.ok, false, "1 ha of rain-fed dry bean does not override the dry-year check");
  assert.equal(hatay.cautions.length, 0);
  // Sunflower now carries a planted area too: Konya clears the floor, Diyarbakır (a few hundred ha) does not.
  assert.ok(tuik.crops.sunflower.konya.rainfed.first.planted_ha >= OBSERVED_MIN_HA);
  assert.ok(tuik.crops.sunflower.diyarbakir.rainfed.first.planted_ha < OBSERVED_MIN_HA);
  assert.equal(checkCrop(byId.sunflower, features("diyarbakir"), rainfed, localYields(tuik, "diyarbakir", "rainfed")).ok, false);
});

test("Tahıllar table: rice counts as irrigated, other unsplit figures never prove a water regime", async () => {
  const { checkCrop } = await import("../web/src/scoring/filter.js");
  const byId = Object.fromEntries(cropTable.crops.map((c) => [c.id, c]));
  assert.ok(tuik.crops.rice.edirne.irrigated.first.planted_ha > 30000, "Edirne paddy area");
  assert.equal(tuik.crops.rice.edirne.all, undefined);
  assert.ok(tuik.crops.maize.konya.all, "maize from the unsplit table");
  const big = Object.entries(tuik.crops.rice).filter(([, v]) => (v.irrigated?.first?.planted_ha ?? 0) >= 1000).map(([k]) => k);
  for (const id of ["edirne", "samsun", "balikesir", "canakkale", "corum"]) assert.ok(big.includes(id), id);
  assert.ok(!big.includes("konya"));
  // the real paddy-area rule: rice kept in Edirne, removed in Konya (irrigated)
  const irr = { irrigation: "irrigated", never_grow: [] };
  assert.equal(checkCrop(byId.rice, features("edirne", "irrigated"), irr, localYields(tuik, "edirne", "irrigated")).ok, true);
  const konya = checkCrop(byId.rice, features("konya", "irrigated"), irr, localYields(tuik, "konya", "irrigated"));
  assert.ok(konya.details.some((d) => d.check === "paddy_area" && d.evidence.includes("no irrigated rice")), JSON.stringify(konya.details));
  // a mixed figure is flagged and does not trigger the observed-farming override
  const lk = localYields(tuik, "konya", "rainfed");
  assert.equal(lk.crops.maize.mixed, true);
  assert.equal(lk.crops.wheat.mixed, false);
  assert.ok(!checkCrop(byId.maize, features("konya"), { irrigation: "rainfed", never_grow: [] }, lk).ok, "rain-fed maize is not rescued by mixed figures");
  const check = runCropCheck({ cropId: "maize", previous: ["wheat"], features: features("konya", "irrigated"), cropTable, nutrientTable, ruleTable: J("rotation_rules.json"), localYields: localYields(tuik, "konya", "irrigated"), farmer: irr, dataStatus: { power: true } });
  assert.ok(check.reasons.some((r) => r.type === "local" && r.evidence.includes("rain-fed and irrigated together")));
});
