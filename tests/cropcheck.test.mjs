// Crop check tests on real cached NASA POWER features. Run: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { matchCrop, normalize } from "../web/src/scoring/aliases.js";
import { runCropCheck, validateCheck } from "../web/src/scoring/cropCheck.js";
import { withSowingCalendar } from "../web/src/data/loader.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, "web/public/data", p), "utf8"));
const cropTable = J("crops.json");
const ruleTable = J("rotation_rules.json");
const nutrientTable = J("nutrients.json");
const tagem = J("tagem_calendar.json");
const provinces = J("provinces.json");
const plist = provinces.provinces ?? provinces;

function featuresFor(id, irrigation) {
  const raw = J(`cache/${id}/features.json`);
  return withSowingCalendar(raw.features ?? raw, plist.find((p) => p.id === id), tagem, irrigation);
}

const check = (province, cropId, previous, irrigation = "rainfed", never = []) =>
  runCropCheck({
    cropId,
    previous,
    features: featuresFor(province, irrigation),
    cropTable,
    ruleTable,
    nutrientTable,
    farmer: { irrigation, never_grow: never },
    dataStatus: { power: true },
  });

test("free text matches Turkish and English names, accent-insensitive", () => {
  const id = (t) => matchCrop(t, cropTable.crops).crop?.id ?? null;
  assert.equal(normalize("Ayçiçeği"), "aycicegi");
  assert.equal(id("nohut"), "chickpea");
  assert.equal(id("ayçiçek"), "sunflower");
  assert.equal(id("AYCICEK"), "sunflower");
  assert.equal(id("Mısır"), "maize");
  assert.equal(id("buğday"), "wheat", "plain buğday means winter wheat");
  assert.equal(id("yazlık buğday"), "spring_wheat");
  assert.equal(id("fiğ"), "vetch");
  assert.equal(id("Sugar beet"), "sugar_beet");
  assert.equal(id("şeker pancarı"), "sugar_beet");
  assert.equal(id("kiwi"), null);
  assert.deepEqual(matchCrop("kiwi", cropTable.crops).matches, []);
  assert.ok(matchCrop("so", cropTable.crops).matches.length > 1, "a prefix lists several crops");
});

test("sunflower two seasons after sunflower is not reasonable (broomrape rule)", () => {
  const r = check("edirne", "sunflower", ["wheat", "sunflower"]);
  assert.equal(r.verdict, "not_reasonable");
  const pest = r.reasons.find((x) => x.type === "pest" && x.level === "blocker");
  assert.ok(pest && pest.source.startsWith("Shevchenko"), JSON.stringify(r.reasons));
  assert.ok(pest.evidence.includes("2 seasons ago"));
});

test("sunflower four years after sunflower passes the rotation rule", () => {
  const r = check("edirne", "sunflower", ["wheat", "barley", "canola"]);
  assert.ok(!r.reasons.some((x) => x.type === "pest" && x.level === "blocker"));
  assert.notEqual(r.verdict, "not_reasonable");
});

test("wheat after wheat needs care (cereal root diseases), not a ban", () => {
  const r = check("konya", "wheat", ["wheat"]);
  assert.notEqual(r.verdict, "not_reasonable");
  assert.ok(r.reasons.some((x) => x.type === "pest" && x.level === "caution" && x.evidence.includes("take-all")));
});

test("chickpea inside its 3-year gap is blocked; legume credit shows for a cereal after it", () => {
  assert.equal(check("konya", "chickpea", ["wheat", "chickpea"]).verdict, "not_reasonable");
  const wheat = check("konya", "wheat", ["chickpea"]);
  assert.ok(wheat.reasons.some((x) => x.effect === "positive" && x.type === "soil" && x.evidence.includes("chickpea before wheat")));
});

test("site failures from the Plan tab's hard filters block the crop", () => {
  const sun = check("erzurum", "sunflower", ["spring_wheat"]);
  assert.equal(sun.verdict, "not_reasonable");
  assert.ok(sun.reasons.some((x) => x.level === "blocker" && x.evidence.includes("heat units")));
  const maize = check("konya", "maize", ["wheat"]); // rain-fed Konya
  assert.equal(maize.verdict, "not_reasonable");
  const never = check("konya", "barley", ["wheat"], "rainfed", ["barley"]);
  assert.ok(never.reasons.some((x) => x.type === "farmer" && x.level === "blocker"));
});

test("timing: cotton harvest against wheat sowing in Adana is flagged", () => {
  const r = check("adana", "wheat", ["cotton"], "irrigated");
  assert.ok(r.reasons.some((x) => x.type === "timing"), JSON.stringify(r.reasons.map((x) => x.evidence)));
});

test("alternatives: up to 3, never the crop itself, never a blocked crop or a never-grow crop", () => {
  const r = check("konya", "sunflower", ["wheat", "sunflower"], "rainfed", ["vetch"]);
  assert.ok(r.alternatives.length <= 3);
  assert.ok(!r.alternatives.includes("sunflower") && !r.alternatives.includes("vetch"));
  for (const id of r.alternatives) assert.notEqual(check("konya", id, ["wheat", "sunflower"]).verdict, "not_reasonable", id);
});

test("every crop in several places follows the frozen contract", () => {
  for (const province of ["konya", "edirne", "adana", "erzurum", "sanliurfa"]) {
    for (const irrigation of ["rainfed", "irrigated"]) {
      for (const c of cropTable.crops) {
        for (const prev of [[], ["wheat", "fallow"], [c.id]]) {
          const r = check(province, c.id, prev, irrigation);
          assert.deepEqual(validateCheck(r), [], `${province} ${irrigation} ${c.id} after ${prev}`);
          assert.notEqual(r.confidence, "high");
        }
      }
    }
  }
});

test("no previous seasons means low confidence and a gap", () => {
  const r = check("konya", "barley", []);
  assert.equal(r.confidence, "low");
  assert.ok(r.gaps.some((g) => g.includes("no previous seasons")));
});
