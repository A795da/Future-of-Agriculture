// Today tab tests: synthetic 7-day forecasts on real cached climate features.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { cropStage, doyOf, guessCropNow, runToday, todaySummary } from "../web/src/scoring/today.js";
import { parseForecast } from "../web/src/data/forecast.js";
import { withSowingCalendar } from "../web/src/data/loader.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, "web/public/data", p), "utf8"));
const crops = J("crops.json").crops;
const cropsById = Object.fromEntries(crops.map((c) => [c.id, c]));
const tagem = J("tagem_calendar.json");
const provinces = J("provinces.json");
const plist = provinces.provinces ?? provinces;
const features = (id, irrigation = "rainfed") => {
  const raw = J(`cache/${id}/features.json`);
  return withSowingCalendar(raw.features ?? raw, plist.find((p) => p.id === id), tagem, irrigation);
};

/** 7 days from `start`, with per-day overrides. */
function forecast(start, over = {}) {
  const t0 = new Date(`${start}T12:00:00Z`);
  const time = [], tmax = [], tmin = [], rain = [], et0 = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(t0.getTime() + i * 86400000).toISOString().slice(0, 10);
    const o = over[i] ?? {};
    time.push(d);
    tmax.push(o.tmax ?? 18);
    tmin.push(o.tmin ?? 8);
    rain.push(o.rain ?? 0);
    et0.push(o.et0 ?? 3);
  }
  return parseForecast({
    daily: { time, temperature_2m_max: tmax, temperature_2m_min: tmin, precipitation_sum: rain, et0_fao_evapotranspiration: et0 },
  });
}

const today = (cropId, fc, province = "konya", irrigation = "rainfed") =>
  runToday({ cropId, forecast: fc, features: features(province, irrigation), cropsById, irrigation });

test("day of year folds leap days like the climate features", () => {
  assert.equal(doyOf("2026-01-01"), 1);
  assert.equal(doyOf("2026-03-01"), 60);
  assert.equal(doyOf("2028-02-29"), 59);
});

test("stages follow the local calendar: Konya wheat in the field in November, chickpea not", () => {
  const f = features("konya");
  assert.notEqual(cropStage(cropsById.wheat, f, "2026-11-15").key, "not_in_field");
  assert.equal(cropStage(cropsById.chickpea, f, "2026-11-15").key, "not_in_field");
  assert.equal(cropStage(cropsById.wheat, f, "2027-01-15").key, "winter_rest");
  assert.equal(guessCropNow(["wheat", "fallow"], cropsById, f, "2026-11-15"), "wheat");
  assert.equal(guessCropNow(["chickpea", "fallow"], cropsById, f, "2026-11-15"), "fallow");
});

test("calm week is green; a crop not in the field says so", () => {
  const r = today("wheat", forecast("2026-11-15"));
  assert.equal(r.status, "green");
  assert.equal(r.alerts.length, 0);
  const c = today("chickpea", forecast("2026-11-15"));
  assert.match(todaySummary(c, (id) => id), /not in the field now/);
});

test("winter wheat in autumn uses winter hardiness, not the flowering frost limit", () => {
  assert.equal(today("wheat", forecast("2026-11-15", { 2: { tmin: -6 } })).status, "green");
  const cold = today("wheat", forecast("2027-01-10", { 3: { tmin: -25 } }));
  assert.equal(cold.status, "red");
  assert.ok(cold.alerts[0].type === "frost" && cold.alerts[0].action.includes("snow cover"));
});

test("frost at flowering is red, and only the frosty day is marked", () => {
  const f = features("konya");
  const ph = cropStage(cropsById.wheat, f, "2027-05-01");
  // find a date in wheat's flowering window at Konya
  let date = null;
  for (let d = 100; d < 200 && !date; d++) {
    const iso = new Date(Date.UTC(2027, 0, d)).toISOString().slice(0, 10);
    if (cropStage(cropsById.wheat, f, iso).key === "flowering") date = iso;
  }
  assert.ok(date, `no flowering date found (May 1 stage ${ph.key})`);
  const wet = (o = {}) => Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((i) => [i, { rain: 2, ...(o[i] ?? {}) }])); // no dry-week alert
  const r = today("wheat", forecast(date, wet({ 1: { tmin: -4 } })));
  assert.equal(r.status, "red");
  assert.equal(r.alerts[0].type, "frost");
  assert.deepEqual(r.days.map((d) => d.status), ["green", "red", "green", "green", "green", "green", "green"]);
  const heat = today("wheat", forecast(date, wet({ 4: { tmax: 36 } })));
  assert.ok(heat.alerts.some((a) => a.type === "heat" && a.level === "red"));
});

test("heavy rain: fertilizer reminder on a crop with a source, erosion note on bare soil, no doses", () => {
  const r = today("wheat", forecast("2026-11-15", { 3: { rain: 28 } }));
  const a = r.alerts.find((x) => x.type === "rain");
  assert.equal(a.level, "yellow");
  assert.match(a.action, /nitrogen fertilizer/);
  assert.match(a.source, /Kentucky/);
  assert.ok(!/kg|dose/i.test(a.action), "no doses");
  const bare = today("fallow", forecast("2026-11-15", { 3: { rain: 45 } }));
  assert.equal(bare.status, "red");
  assert.match(bare.alerts[0].action, /topsoil/);
});

test("dry week warns rain-fed crops; irrigated fields get an irrigation plan instead", () => {
  const f = features("adana", "irrigated");
  let date = null;
  for (let d = 60; d < 200 && !date; d++) {
    const iso = new Date(Date.UTC(2027, 0, d)).toISOString().slice(0, 10);
    if (cropStage(cropsById.wheat, f, iso).key === "growing") date = iso;
  }
  const hot = { et0: 5 };
  const fc = forecast(date, Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((i) => [i, hot])));
  const dry = today("wheat", fc, "adana", "rainfed");
  assert.ok(dry.alerts.some((a) => a.type === "water" && a.level !== "info"), JSON.stringify(dry.alerts));
  const irr = today("wheat", fc, "adana", "irrigated");
  const plan = irr.alerts.find((a) => a.type === "water");
  assert.equal(plan.level, "info");
  assert.equal(irr.status, "green", "a plan note does not turn the day yellow");
});

test("a saved snapshot lowers confidence and says so", () => {
  const fc = { ...forecast("2026-11-15"), snapshot: "2026-11-15" };
  const r = runToday({ cropId: "wheat", forecast: fc, features: features("konya"), cropsById, irrigation: "rainfed" });
  assert.equal(r.confidence, "low");
  assert.match(r.gaps[0], /saved on 2026-11-15/);
});

test("demo snapshots parse", () => {
  for (const id of ["konya", "edirne", "adana", "sanliurfa", "erzurum"]) {
    const s = J(`cache/${id}/forecast_snapshot.json`);
    assert.equal(parseForecast(s.response).days.length, 7, id);
  }
});
