// Interface language: every key in both languages, Turkish crop names, dates,
// Turkish summaries and Today alerts built from the computed results.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { STR, translate, cropLabel, rotationLabel, dayLabel, shortNameTr } from "../web/src/i18n/strings.js";
import { cardSummaryTr, checkSummaryTr, todaySummaryTr, alertEvidenceTr, alertActionTr } from "../web/src/i18n/summaries.js";
import { GLOSSARY } from "../web/src/explain/glossary.js";
import { runToday } from "../web/src/scoring/today.js";
import { parseForecast } from "../web/src/data/forecast.js";
import { withSowingCalendar } from "../web/src/data/loader.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, "web/public/data", p), "utf8"));
const crops = J("crops.json").crops;
const byId = Object.fromEntries(crops.map((c) => [c.id, c]));

test("every interface key exists in English and Turkish, with the same placeholders", () => {
  const en = Object.keys(STR.en), tr = Object.keys(STR.tr);
  assert.deepEqual(en.filter((k) => !tr.includes(k)), [], "missing in Turkish");
  assert.deepEqual(tr.filter((k) => !en.includes(k)), [], "extra in Turkish");
  const vars = (s) => (s.match(/\{\w+\}/g) ?? []).sort().join();
  for (const k of en) assert.equal(vars(STR.tr[k]), vars(STR.en[k]), k);
  assert.equal(translate("tr", "year_n", { n: 2 }), "2. yıl");
  assert.equal(translate("tr", "no_such_key"), "no_such_key");
  for (const g of GLOSSARY) assert.ok(g.tr?.term && g.tr?.text.length > 40, `glossary ${g.id} has Turkish`);
});

test("Turkish crop names are short and keep spring/silage apart", () => {
  assert.equal(shortNameTr(byId.wheat), "Buğday");
  assert.equal(shortNameTr(byId.spring_wheat), "Yazlık buğday");
  assert.equal(shortNameTr(byId.silage_maize), "Silajlık mısır");
  assert.equal(shortNameTr(byId.chickpea), "Nohut");
  assert.equal(cropLabel("fallow", byId, "tr"), "Nadas");
  assert.equal(cropLabel("spring_wheat", byId, "en"), "Spring wheat");
  assert.equal(rotationLabel(["wheat", "chickpea", "fallow"], byId, "tr"), "Buğday > Nohut > Nadas");
  // every Turkish short name is unique, so options never look the same
  const names = crops.map((c) => shortNameTr(c));
  assert.equal(new Set(names).size, names.length, names.join(", "));
  assert.deepEqual(dayLabel("2026-11-18", "tr"), { day: "Çar", date: "18 Kas" });
  assert.deepEqual(dayLabel("2026-11-18", "en"), { day: "Wed", date: "18 Nov" });
});

test("Turkish summaries come from the result, with no English evidence inside", () => {
  const result = { is_baseline: false, score: 71, what_if: true, reasons: [{ effect: "positive" }, { effect: "negative" }, { effect: "negative" }] };
  const s = cardSummaryTr(result, { score: 58 });
  assert.match(s, /71 puan/);
  assert.match(s, /13 puan yüksek/);
  assert.match(s, /1 olumlu ve 2 olumsuz/);
  assert.match(s, /senaryodur/);
  const name = (id) => cropLabel(id, byId, "tr");
  const check = checkSummaryTr({ crop: "sunflower", previous: ["wheat"], verdict: "not_reasonable", reasons: [{ level: "blocker" }, { level: "blocker" }] }, name);
  assert.equal(check, "Ayçiçeği (buğday sonrası) burada mantıklı bir seçim değil: 2 engelleyici neden var.");
});

test("Today alerts read in Turkish from their numbers, actions included", () => {
  const point = (J("provinces.json").provinces ?? J("provinces.json")).find((p) => p.id === "konya");
  const raw = J("cache/konya/features.json");
  const f = withSowingCalendar(raw.features ?? raw, point, J("tagem_calendar.json"), "rainfed");
  const time = ["2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21"];
  const fc = parseForecast({
    daily: { time, temperature_2m_max: time.map(() => 15), temperature_2m_min: time.map(() => 5), precipitation_sum: [0, 0, 0, 32, 0, 0, 0], et0_fao_evapotranspiration: time.map(() => 1) },
  });
  const r = runToday({ cropId: "wheat", forecast: fc, features: f, cropsById: byId, irrigation: "rainfed" });
  const rain = r.alerts.find((a) => a.type === "rain");
  assert.equal(alertEvidenceTr(rain, "buğday"), "18 Kas Çar günü 32 mm yağış bekleniyor");
  assert.match(alertActionTr(rain), /azotlu gübre atmayın/);
  assert.match(todaySummaryTr(r, (id) => cropLabel(id, byId, "tr")), /^Şiddetli yağış riski: 18 Kas Çar günü 32 mm/);
  const calm = runToday({ cropId: "chickpea", forecast: parseForecast({ daily: { ...fc_daily(time) } }), features: f, cropsById: byId, irrigation: "rainfed" });
  assert.match(todaySummaryTr(calm, (id) => cropLabel(id, byId, "tr")), /Nohut şu an tarlada değil/);
});

function fc_daily(time) {
  return { time, temperature_2m_max: time.map(() => 15), temperature_2m_min: time.map(() => 5), precipitation_sum: time.map(() => 1), et0_fao_evapotranspiration: time.map(() => 1) };
}
