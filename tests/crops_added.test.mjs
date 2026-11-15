// The six crops added on 15 Nov (sesame, groundnut, tobacco, onion, watermelon, melon):
// data wiring, the warmth check, sourced rotation rules and second-crop calendars.
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
const NEW = ["sesame", "groundnut", "tobacco", "onion", "watermelon", "melon"];

const features = (id, irrigation) => {
  const raw = J(`cache/${id}/features.json`);
  return withSowingCalendar(raw.features ?? raw, plist.find((p) => p.id === id), tagem, irrigation);
};
const check = (province, cropId, previous, irrigation = "irrigated") =>
  runCropCheck({ cropId, previous, features: features(province, irrigation), ...tables, farmer: { irrigation, never_grow: [] }, dataStatus: { power: true } });

test("new crops are wired into every table with sources", () => {
  const nutrients = J("nutrients.json").crops;
  for (const id of NEW) {
    const c = byId[id];
    assert.ok(c, id);
    assert.equal(c.verified, false, `${id} stays unverified until an expert checks it`);
    assert.match(c.field_sources.temp_opt_c, /FAO EcoCrop/, `${id} temperatures from EcoCrop`);
    assert.ok(c.field_sources.kc && c.field_sources.stages_days, `${id} kc and stages cite their source`);
    assert.ok(nutrients[id]?.yield_t_ha > 0, `${id} has a FAOSTAT yield`);
    assert.equal(matchCrop(c.name_tr.split(" (")[0], cropTable.crops).crop?.id, id, `Turkish name finds ${id}`);
  }
  assert.ok(nutrients.groundnut.fixed_kg_n_ha > 0, "groundnut fixes nitrogen (Herridge 2008)");
  assert.equal(nutrients.sesame.fixed_kg_n_ha ?? 0, 0);
  for (const w of ["susam", "yerfıstığı", "tütün", "soğan", "karpuz", "kavun", "peanut"]) assert.ok(matchCrop(w, cropTable.crops).crop, w);
});

test("warmth check: sesame and groundnut fail in Erzurum's cool summer, pass in Adana", () => {
  const cold = checkCrop(byId.sesame, features("erzurum", "rainfed"), { irrigation: "rainfed" });
  assert.equal(cold.ok, false);
  assert.ok(cold.reasons.some((r) => r.includes("summer is too cool") && r.includes("EcoCrop")), cold.reasons.join("; "));
  assert.equal(checkCrop(byId.groundnut, features("erzurum", "irrigated"), { irrigation: "irrigated" }).ok, false);
  for (const id of ["sesame", "groundnut", "watermelon", "melon", "tobacco", "onion"]) {
    assert.equal(checkCrop(byId[id], features("adana", "irrigated"), { irrigation: "irrigated" }).ok, true, id);
  }
  // the official TAGEM calendar overrides: it lists irrigated watermelon for the Erzurum-Kars zone
  assert.equal(checkCrop(byId.watermelon, features("erzurum", "irrigated"), { irrigation: "irrigated" }).ok, true);
});

test("sourced rotation rules: watermelon 5 years, groundnut 3, onion 4, cucurbits and nightshades", () => {
  const wm = check("adana", "watermelon", ["wheat", "watermelon"]);
  assert.equal(wm.verdict, "not_reasonable");
  assert.ok(wm.reasons.some((r) => r.level === "blocker" && r.source.startsWith("Michigan State")));
  assert.equal(check("adana", "groundnut", ["wheat", "groundnut"]).verdict, "not_reasonable");
  assert.notEqual(check("adana", "groundnut", ["wheat", "maize", "cotton"]).verdict, "not_reasonable");
  assert.equal(check("amasya", "onion", ["wheat", "onion"]).verdict, "not_reasonable");
  const melon = check("adana", "melon", ["watermelon"]);
  assert.ok(melon.reasons.some((r) => r.type === "pest" && r.level === "caution" && r.source.startsWith("Oklahoma")), JSON.stringify(melon.reasons));
  const tob = check("samsun", "tobacco", ["potato"]);
  assert.ok(tob.reasons.some((r) => r.type === "pest" && /potato and tomato share/.test(r.evidence)), "tobacco after potato: nightshade rule");
  const wheat = check("adana", "wheat", ["groundnut"]);
  assert.ok(wheat.reasons.some((r) => r.effect === "positive" && /groundnut before wheat/.test(r.evidence)), "legume before cereal");
});

test("second-crop calendars from TAGEM-DSİ for sesame and groundnut", () => {
  const f = features("adana", "irrigated");
  assert.ok(zoneCalendar("groundnut_second", f), "Çukurova has a groundnut second-crop calendar");
  assert.ok(zoneCalendar("sesame_second", f), "and a sesame one");
  const rot = J("rotations.json").rotations;
  for (const id of ["wheat-groundnut2-cotton", "wheat-sesame2-cotton"]) assert.ok(rot.find((r) => r.id === id)?.second_crops, id);
});

test("results carry their second crops, so the Turkish title can show them", async () => {
  const { runScoring } = await import("../web/src/scoring/index.js");
  const { rotationLabel } = await import("../web/src/i18n/strings.js");
  const point = plist.find((p) => p.id === "adana");
  const { results } = runScoring({
    features: features("adana", "irrigated"), cropTable, rotationTable: J("rotations.json"), nutrientTable: tables.nutrientTable, ruleTable: tables.ruleTable,
    farmer: { region: point.region, irrigation: "irrigated", current_sequence: ["wheat", "faba_bean"], history: ["wheat", "faba_bean"], priorities: {}, never_grow: [] },
    dataStatus: { power: true },
  });
  const second = results.filter((r) => r.second_crops);
  assert.ok(second.length > 0, results.map((r) => r.label).join(" | "));
  const titles = second.map((r) => rotationLabel(r.sequence, byId, "tr", r.second_crops));
  assert.ok(titles.every((t) => t.includes(" + ")), titles.join(" | "));
  assert.equal(new Set(titles).size, titles.length, "two different rotations never share a Turkish title");
});
