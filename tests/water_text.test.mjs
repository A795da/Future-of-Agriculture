// Irrigation amounts in the crop check: mm, per dekar and hectare, share covered, peak months.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { monthlyIrrigation, irrigationNeed } from "../web/src/scoring/agronomy.js";
import { amountText, peakMonths } from "../web/src/scoring/waterText.js";
import { runCropCheck } from "../web/src/scoring/cropCheck.js";
import { withSowingCalendar } from "../web/src/data/loader.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, "web/public/data", p), "utf8"));
const cropTable = J("crops.json");
const byId = Object.fromEntries(cropTable.crops.map((c) => [c.id, c]));
const tables = { cropTable, ruleTable: J("rotation_rules.json"), nutrientTable: J("nutrients.json") };
const tagem = J("tagem_calendar.json");
const plist = J("provinces.json").provinces ?? J("provinces.json");
const features = (id, irrigation) => {
  const raw = J(`cache/${id}/features.json`);
  return withSowingCalendar(raw.features ?? raw, plist.find((p) => p.id === id), tagem, irrigation);
};
const water = (province, cropId, irrigation) =>
  runCropCheck({ cropId, previous: ["wheat"], features: features(province, irrigation), ...tables, farmer: { irrigation, never_grow: [] }, dataStatus: { power: true } })
    .reasons.filter((r) => r.type === "water");

test("1 mm = 1 m³ per dekar = 10 m³ per hectare", () => {
  assert.equal(amountText(488.4), "488 mm (488 m³ per dekar, 4,880 m³ per hectare)");
});

test("monthly split adds up to the season total; peaks are the fewest months holding 60%", () => {
  const f = features("konya", "irrigated");
  const w = irrigationNeed(byId.carrot, f);
  const months = monthlyIrrigation(byId.carrot, f, w.deficit);
  assert.ok(Math.abs(months.reduce((a, m) => a + m.mm, 0) - w.deficit) < 5);
  const peaks = peakMonths(months, w.deficit);
  assert.ok(peaks.length >= 1 && peaks.length <= 3);
  assert.ok(peaks.reduce((a, m) => a + m.mm, 0) >= 0.6 * w.deficit || peaks.length === 3);
  assert.deepEqual(peakMonths([], 0), []);
});

test("rain-fed field, crop that needs irrigation: blocked, and told how much water it would take", () => {
  const ws = water("konya", "carrot", "rainfed");
  assert.ok(ws.some((r) => r.level === "blocker"));
  const info = ws.find((r) => r.level === "info");
  assert.match(info.evidence, /would need to irrigate/);
  assert.match(info.evidence, /m³ per dekar/);
  assert.match(info.evidence, /cover about \d+%/);
  assert.match(info.evidence, /most of it in (Jun|Jul|Aug)/);
});

test("rain-fed crop failing the dry-year check gets its shortfall; irrigated crop gets per-dekar amounts", () => {
  const sun = water("konya", "sunflower", "rainfed");
  assert.ok(sun.some((r) => /short/.test(r.evidence) && /m³ per dekar/.test(r.evidence)), JSON.stringify(sun));
  const cot = water("adana", "cotton", "irrigated");
  assert.ok(cot.some((r) => /m³ per hectare/.test(r.evidence) && /drip/.test(r.evidence)));
});

test("Turkish water line from the attached numbers", async () => {
  const { waterEvidenceTr } = await import("../web/src/i18n/summaries.js");
  const r = water("konya", "carrot", "rainfed").find((x) => x.water);
  assert.equal(r.water.mode, "would_irrigate");
  const tr = waterEvidenceTr(r.water);
  assert.match(tr, /^Havuç için sulama gerekir/);
  assert.match(tr, new RegExp(`dekara ${r.water.mm} m³`));
  assert.match(tr, /(Haziran|Temmuz|Ağustos)/);
  assert.match(tr, /damla sulama/);
});
