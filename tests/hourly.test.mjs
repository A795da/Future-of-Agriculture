// Hourly forecast parsing and spray hours.
import test from "node:test";
import assert from "node:assert/strict";
import { parseForecast, parseHourly, skyOf } from "../web/src/data/forecast.js";
import { sprayDay, sprayHour } from "../web/src/scoring/spray.js";

/** 48 hours from 2026-11-15 00:00 with per-hour overrides by index. */
function hourly(over = {}) {
  const h = { time: [], temperature_2m: [], precipitation: [], precipitation_probability: [], weather_code: [], wind_speed_10m: [], wind_gusts_10m: [], is_day: [] };
  for (let i = 0; i < 48; i++) {
    const o = over[i] ?? {};
    const day = i < 24 ? "2026-11-15" : "2026-11-16";
    const hr = i % 24;
    h.time.push(`${day}T${String(hr).padStart(2, "0")}:00`);
    h.temperature_2m.push(o.temp ?? 12);
    h.precipitation.push(o.rain ?? 0);
    h.precipitation_probability.push(o.prob ?? 0);
    h.weather_code.push(o.code ?? 0);
    h.wind_speed_10m.push(o.wind ?? 8);
    h.wind_gusts_10m.push(o.gust ?? 15);
    h.is_day.push(hr >= 7 && hr < 17 ? 1 : 0);
  }
  return h;
}

test("weather codes map to sky words; no code falls back to rain amount", () => {
  assert.equal(skyOf(0), "clear");
  assert.equal(skyOf(2), "partly");
  assert.equal(skyOf(63), "rain");
  assert.equal(skyOf(81), "showers");
  assert.equal(skyOf(95), "storm");
  assert.equal(skyOf(null, 8), "rain");
  assert.equal(skyOf(null, 0, 10), null); // never claims sunny without data
});

test("hourly block is split onto its days; snapshots without it give null", () => {
  const fc = parseForecast({
    daily: { time: ["2026-11-15", "2026-11-16"], temperature_2m_max: [15, 16], temperature_2m_min: [5, 6], precipitation_sum: [0, 0] },
    hourly: hourly(),
  });
  assert.equal(fc.days[0].hours.length, 24);
  assert.equal(fc.days[1].hours[0].time, "2026-11-16T00:00");
  assert.equal(fc.days[0].hours[10].is_day, true);
  assert.equal(parseHourly(undefined), null);
  const snap = parseForecast({ daily: { time: ["2026-11-15"], temperature_2m_max: [15], temperature_2m_min: [5], precipitation_sum: [0] } });
  assert.equal(snap.days[0].hours, null);
});

test("calm daylight with light wind is one spray window; night is never one", () => {
  const all = parseHourly(hourly());
  const { windows } = sprayDay(all, "2026-11-15");
  assert.deepEqual(windows, [{ from: 7, to: 17 }]);
  assert.equal(sprayHour(all, 2), "night");
});

test("wind over 15 km/h, still air and rain within 3 hours each block spraying", () => {
  const all = parseHourly(hourly({ 9: { wind: 22 }, 12: { wind: 1 }, 16: { rain: 0.4 } }));
  const d = sprayDay(all, "2026-11-15");
  assert.equal(d.verdicts[9], "windy");
  assert.equal(d.verdicts[12], "calm");
  assert.equal(d.verdicts[13], "rain"); // rain at 16:00 is within 3 hours
  assert.deepEqual(d.windows, [{ from: 7, to: 9 }, { from: 10, to: 12 }]);
});

test("a rainy day has no window and says why; look-ahead past the forecast end is unknown", () => {
  const over = {};
  for (let i = 0; i < 24; i++) over[i] = { prob: 80 };
  const d = sprayDay(parseHourly(hourly(over)), "2026-11-15");
  assert.equal(d.windows.length, 0);
  assert.equal(d.reason, "rain");
  const all = parseHourly(hourly());
  assert.equal(sprayHour(all, 46), "night");
  all[46].is_day = true;
  assert.equal(sprayHour(all, 46), "unknown");
});
