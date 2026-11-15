// Build the app's TAGEM-DSİ calendar file and assign each province to a TAGEM
// climate zone (nearest TAGEM climate station in the same province).
//
// Usage: node scripts/build_tagem.mjs   (after python -E scripts/extract_tagem.py)
// Reads:  data/sources/tagem_{zones,stations,calendar,crop_map}.csv
// Writes: web/public/data/tagem_calendar.json
//         web/public/data/provinces.json  (adds tagem_zone, tagem_station)

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "data/sources");

function readCsv(file) {
  const text = fs.readFileSync(path.join(SRC, file), "utf8").replace(/^﻿/, "");
  const rows = [];
  let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { f += '"'; i++; }
      else if (c === '"') q = false;
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
    else if (c !== "\r") f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.length > 1);
  return body.map((r) => Object.fromEntries(head.map((k, i) => [k, r[i]])));
}

const trUpper = (s) => s.toLocaleUpperCase("tr-TR");
const zones = readCsv("tagem_zones.csv");
const stations = readCsv("tagem_stations.csv").map((s) => ({ ...s, lat: +s.lat, lon: +s.lon }));
const calendar = readCsv("tagem_calendar.csv");
const cropMap = readCsv("tagem_crop_map.csv").filter((m) => m.use_calendar !== "none" && m.tagem_crop);

// ---- calendars per zone, only for the crops we use
const out = {
  source: "TAGEM-DSİ 2017, Türkiye'de Sulanan Bitkilerin Bitki Su Tüketimleri, Section 8",
  kind: "compiled rule",
  note: "Sowing dekad (1 = days 1-10, 2 = 11-20, 3 = 21-end) and FAO-56 stage lengths per climate zone, for irrigated crops.",
  zones: Object.fromEntries(zones.map((z) => [z.code, z.name])),
  crops: Object.fromEntries(cropMap.map((m) => [m.crop_id, { tagem_crop: m.tagem_crop, use: m.use_calendar }])),
  calendars: {},
};
let found = 0, missing = 0;
for (const z of zones) {
  out.calendars[z.code] = {};
  for (const m of cropMap) {
    // several guide names may be listed, best first, separated by "|"
    const r = m.tagem_crop.split("|").map((name) => calendar.find((c) => c.zone === z.code && c.crop_tr === name)).find(Boolean);
    if (!r) { missing++; continue; }
    found++;
    out.calendars[z.code][m.crop_id] = {
      sow_month: +r.sowing_month,
      sow_dekad: +r.sowing_dekad,
      stages: [+r.stage1_days, +r.stage2_days, +r.stage3_days, +r.stage4_days],
      season: +r.season_days,
      use: m.use_calendar,
      tagem_crop: r.crop_tr,
      page: +r.pdf_page,
    };
  }
}
fs.writeFileSync(path.join(ROOT, "web/public/data/tagem_calendar.json"), JSON.stringify(out));

// ---- province -> nearest TAGEM station in the same province (fallback: nearest overall)
const km = (a, b) => {
  const r = Math.PI / 180;
  const x = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return 6371 * Math.hypot(x, y);
};
const provFile = path.join(ROOT, "web/public/data/provinces.json");
const provinces = JSON.parse(fs.readFileSync(provFile, "utf8"));
const report = [];
for (const p of provinces) {
  const same = stations.filter((s) => trUpper(s.province) === trUpper(p.name) || (p.id === "afyonkarahisar" && s.province === "AFYON"));
  const pool = same.length ? same : stations;
  const best = pool.reduce((a, s) => (km(p, s) < km(p, a) ? s : a));
  p.tagem_zone = best.zone;
  p.tagem_station = `${best.station} (${best.wmo_id})`;
  report.push(`${p.name}: ${best.zone} ${out.zones[best.zone]} via ${best.station}, ${km(p, best).toFixed(0)} km${same.length ? "" : " (no station in province)"}`);
}
fs.writeFileSync(provFile, "[\n" + provinces.map((x) => "  " + JSON.stringify(x)).join(",\n") + "\n]\n");

console.log(`calendar entries: ${found} found, ${missing} zone/crop pairs not in the guide`);
console.log(report.filter((l) => /konya|Şanlıurfa|Edirne|Erzurum|Adana|Samsun|no station/i.test(l)).join("\n"));
