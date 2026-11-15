// Climate-change features: resilience of each rotation card under what-if warming,
// and 20-year context on Today alarms.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runScoring, RESILIENCE_HOLDS_UP, RESILIENCE_SOME_LOSS } from "../web/src/scoring/index.js";
import { validateResult } from "../web/src/scoring/contract.js";
import { rotationFacts } from "../web/src/explain/payload.js";
import { DEFAULT_INPUTS, defaultRotation } from "../web/src/scoring/defaults.js";
import { withSowingCalendar } from "../web/src/data/loader.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, "web/public/data", p), "utf8"));
const tables = { cropTable: J("crops.json"), rotationTable: J("rotations.json"), nutrientTable: J("nutrients.json"), ruleTable: J("rotation_rules.json") };
const tagem = J("tagem_calendar.json");
const plist = J("provinces.json");
const run = (id, irrigation = "rainfed", scenario = null) => {
  const p = plist.find((x) => x.id === id);
  const raw = J(`cache/${id}/features.json`);
  const base = raw.features ?? raw;
  const current = defaultRotation({ ...tables, tagem }, p.region, withSowingCalendar(base, p, tagem, "rainfed"));
  return runScoring({
    features: withSowingCalendar(base, p, tagem, irrigation), ...tables, scenario,
    farmer: { region: p.region, irrigation, current_sequence: current, history: current, priorities: DEFAULT_INPUTS.priorities, never_grow: [] },
    dataStatus: { power: true },
  }).results;
};

test("every card carries its score under +2 °C and +2 °C drier, with a label", () => {
  for (const id of ["konya", "adana", "samsun"]) {
    for (const r of run(id)) {
      const s = r.resilience;
      assert.ok(s, `${id} ${r.label}`);
      assert.equal(s.today, r.score);
      assert.equal(s.drop, Math.max(0, s.today - Math.min(s.warm, s.warm_dry)));
      const want = s.drop <= RESILIENCE_HOLDS_UP ? "holds_up" : s.drop <= RESILIENCE_SOME_LOSS ? "some_loss" : "sensitive";
      assert.equal(s.label, want);
      assert.deepEqual(validateResult(r), []);
    }
  }
  // Hot Çukurova loses more under warming than the mild Black Sea coast.
  const adana = Math.max(...run("adana").map((r) => r.resilience.drop));
  const samsun = Math.max(...run("samsun").map((r) => r.resilience.drop));
  assert.ok(adana > samsun, `adana ${adana} vs samsun ${samsun}`);
});

test("resilience is measured from today's climate even while a what-if slider is on, and stays out of the AI facts", () => {
  const plain = run("adana");
  const slid = run("adana", "rainfed", { rainPct: -20, tempC: 1 });
  const byId = Object.fromEntries(plain.map((r) => [r.id, r]));
  for (const r of slid) if (byId[r.id]) assert.equal(r.resilience.today, byId[r.id].resilience.today);
  const facts = rotationFacts(plain[0], null, "x");
  assert.ok(!JSON.stringify(facts).includes("resilience"), "cached AI texts keep their keys");
});

test("NASA GRACE water-storage trend: evidence and a shrinking-supply warning on irrigated fields only", async () => {
  const { withWaterStorage } = await import("../web/src/data/loader.js");
  const { runCropCheck, validateCheck } = await import("../web/src/scoring/cropCheck.js");
  const { WATER_STORAGE_DECLINE_CM_YR } = await import("../web/src/scoring/waterSupply.js");
  const grace = J("water_storage.json");
  assert.equal(Object.keys(grace.provinces).length, 81);
  assert.match(grace._meta.source, /GRACE-FO/);
  assert.ok(grace.provinces.sanliurfa.trend_cm_yr <= WATER_STORAGE_DECLINE_CM_YR, "Harran basin is losing water");
  assert.ok(grace.provinces.samsun.trend_cm_yr > WATER_STORAGE_DECLINE_CM_YR);

  const cards = (id, irrigation) => {
    const p = plist.find((x) => x.id === id);
    const raw = J(`cache/${id}/features.json`);
    const f = withWaterStorage(withSowingCalendar(raw.features ?? raw, p, tagem, irrigation), p, grace);
    return runScoring({
      features: f, ...tables,
      farmer: { region: p.region, irrigation, current_sequence: ["wheat", "cotton"], history: ["wheat", "cotton"], priorities: DEFAULT_INPUTS.priorities, never_grow: [] },
      dataStatus: { power: true },
    }).results;
  };
  const urfa = cards("sanliurfa", "irrigated");
  for (const r of urfa) {
    assert.ok(r.reasons.some((x) => x.kind === "NASA observation" && x.evidence.includes("NASA GRACE")), r.label);
    assert.ok(r.risks.some((x) => x.includes("NASA GRACE")), r.label);
    assert.deepEqual(validateResult(r), []);
  }
  assert.ok(urfa[0].risks.some((x) => x.includes("water-hungry cotton")), urfa[0].risks.join(" | "));
  const samsun = cards("samsun", "irrigated");
  assert.ok(samsun.every((r) => !r.risks.some((x) => x.includes("NASA GRACE"))));
  // rain-fed fields: no GRACE line (the cached AI texts for the rain-fed demo stay valid)
  assert.ok(cards("sanliurfa", "rainfed").every((r) => !r.reasons.some((x) => x.evidence.includes("GRACE"))));

  // Crop check: irrigated cotton in Şanlıurfa gets a caution; it never blocks.
  const p = plist.find((x) => x.id === "sanliurfa");
  const raw = J("cache/sanliurfa/features.json");
  const f = withWaterStorage(withSowingCalendar(raw.features ?? raw, p, tagem, "irrigated"), p, grace);
  const c = runCropCheck({ cropId: "cotton", previous: ["wheat"], features: f, ...tables, farmer: { irrigation: "irrigated", never_grow: [] }, dataStatus: { power: true } });
  const g = c.reasons.find((x) => x.evidence.includes("NASA GRACE"));
  assert.ok(g && g.level === "caution" && g.kind === "NASA observation", JSON.stringify(g));
  assert.deepEqual(validateCheck(c), []);
});

test("GRACE: coastal cells with an out-of-range scale factor use the mascon's inland factor (Çukurova is not hidden)", () => {
  const g = J("water_storage.json").provinces;
  assert.ok(g.adana.trend_cm_yr <= -1.5, `Adana ${g.adana.trend_cm_yr}`);
  assert.match(g.adana.scale_from, /mascon median/);
  for (const v of Object.values(g)) assert.ok(v.scale >= 0.5 && v.scale <= 2, JSON.stringify(v));
});

test("recent climate shift: noise test on yearly values, province table, and the one-tap what-if", async () => {
  const { shiftOf, climateShift, shiftScenario } = await import("../web/src/features/shift.js");
  // 15 ordinary years then 5 clearly warmer ones
  const base = [10, 11, 9, 10.5, 9.5, 10, 11, 9, 10, 10.5, 9.5, 10, 11, 9, 10];
  assert.equal(shiftOf([...base, 13, 13.5, 12.5, 13, 13]).level, "clear");
  assert.equal(shiftOf([...base, 10, 11, 9, 10, 10.5]).level, "none");
  assert.equal(shiftOf([1, 2, 3]), null, "too few years");

  // synthetic daily record: 20 years, the last 5 hotter and wetter
  const daily = { date: [], T2M: [], T2M_MAX: [], T2M_MIN: [], PRECTOTCORR: [], GWETROOT: [] };
  for (let y = 2005; y <= 2024; y++) {
    const late = y >= 2020;
    for (let d = 0; d < 365; d++) {
      daily.date.push(new Date(Date.UTC(y, 0, 1 + d)).toISOString().slice(0, 10));
      const summer = d > 170 && d < 230;
      const wobble = (y % 3) * 0.2;
      daily.T2M.push((summer ? 25 : 8) + (late ? 1.5 : 0) + wobble);
      daily.T2M_MAX.push(summer ? 33 + (late ? 3 : 0) + wobble : 14);
      daily.T2M_MIN.push(d < 40 ? -2 : 6);
      daily.PRECTOTCORR.push(d % 7 === 0 ? (late ? 12 : 10) + (y % 2) : 0);
      daily.GWETROOT.push(0.5);
    }
  }
  const s = climateShift(daily);
  assert.deepEqual(s.years, [2005, 2024]);
  assert.equal(s.recent_from, 2020);
  assert.equal(s.measures.temp_c.level, "clear");
  assert.ok(s.measures.hot_days.diff > 30, "summer highs cross 35 °C only in the recent years");
  assert.ok(s.measures.rain_mm.pct > 0);
  assert.deepEqual(shiftScenario(s), { tempC: 1.5, rainPct: s.measures.rain_mm.pct });
  assert.deepEqual(shiftScenario({ measures: { temp_c: { diff: -0.4 }, rain_mm: { pct: -45 } } }), { tempC: 0, rainPct: -30 }, "clamped to the sliders");

  // built table: every province, and the national picture holds (more warmer than cooler)
  const t = J("climate_shift.json");
  assert.equal(Object.keys(t.provinces).length, 81);
  const warmer = Object.values(t.provinces).filter((p) => p.measures.temp_c.diff > 0).length;
  assert.ok(warmer > 70, `${warmer} provinces warmer`);
  assert.equal(t.provinces.zonguldak.measures.rain_mm.level, "clear");
});
