// Save one Open-Meteo forecast per demo province, as the Today tab's offline
// fallback (labelled with its save date in the app; never shown as current).
//
// Usage: node scripts/fetch_forecast_snapshot.mjs [provinceId ...]
// Output: web/public/data/cache/<id>/forecast_snapshot.json

import fs from "node:fs";
import path from "node:path";
import { forecastUrl, parseForecast } from "../web/src/data/forecast.js";

const DEMO = ["konya", "edirne", "adana", "sanliurfa", "erzurum"];
const ROOT = path.resolve(import.meta.dirname, "..");
const provinces = JSON.parse(fs.readFileSync(path.join(ROOT, "web/public/data/provinces.json"), "utf8"));
const list = provinces.provinces ?? provinces;
const ids = process.argv.slice(2).length ? process.argv.slice(2) : DEMO;

for (const id of ids) {
  const p = list.find((x) => x.id === id);
  if (!p) {
    console.error(`unknown province ${id}`);
    continue;
  }
  const res = await fetch(forecastUrl(p.lat, p.lon));
  if (!res.ok) {
    console.error(`${id}: HTTP ${res.status}`);
    continue;
  }
  const response = await res.json();
  parseForecast(response); // throws if the shape changed
  const out = path.join(ROOT, "web/public/data/cache", id, "forecast_snapshot.json");
  fs.writeFileSync(out, JSON.stringify({ saved: new Date().toISOString().slice(0, 10), source: "Open-Meteo (not NASA)", response }));
  console.log(`${id}: saved ${response.daily.time[0]} to ${response.daily.time.at(-1)}`);
}
