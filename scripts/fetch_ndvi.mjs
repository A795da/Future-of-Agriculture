// Fetch the MODIS MOD13Q1 16-day NDVI series (250 m) for demo points from the
// ORNL DAAC MODIS web service and cache it as JSON.
// The service is slow (~10 s per date), so this runs once, in the background,
// and resumes from where it stopped.
//
// Usage: node scripts/fetch_ndvi.mjs [pointId ...] [--from 2005]
// Output: web/public/data/cache/<pointId>/ndvi.json

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const POINTS = JSON.parse(
  fs.readFileSync(path.join(ROOT, "web/public/data/demo_points.json"), "utf8")
);
const API = "https://modis.ornl.gov/rst/api/v1/MOD13Q1";
const BAND = "250m_16_days_NDVI";
const CHUNK = 10; // the service limits dates per request

const args = process.argv.slice(2);
const fromIdx = args.indexOf("--from");
const fromYear = fromIdx >= 0 ? Number(args[fromIdx + 1]) : 2005;
const ids = args.filter((a, i) => !a.startsWith("--") && i !== fromIdx + 1);
const points = ids.length ? POINTS.filter((p) => ids.includes(p.id)) : POINTS;

async function getJson(url, tries = 4) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(180000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.log(`  try ${i}/${tries} failed: ${e.message}`);
      if (i === tries) throw e;
      await new Promise((r) => setTimeout(r, 5000 * i));
    }
  }
}

for (const p of points) {
  const outDir = path.join(ROOT, "web/public/data/cache", p.id);
  const outFile = path.join(outDir, "ndvi.json");
  fs.mkdirSync(outDir, { recursive: true });

  const cached = fs.existsSync(outFile)
    ? JSON.parse(fs.readFileSync(outFile, "utf8"))
    : null;
  const have = new Set((cached?.series ?? []).map((s) => s.modis_date));
  const series = cached?.series ?? [];

  console.log(`\n${p.id}: listing available dates...`);
  const { dates } = await getJson(`${API}/dates?latitude=${p.lat}&longitude=${p.lon}`);
  const wanted = dates
    .map((d) => d.modis_date)
    .filter((d) => Number(d.slice(1, 5)) >= fromYear && !have.has(d));
  console.log(`${p.id}: ${have.size} cached, ${wanted.length} to fetch`);

  for (let i = 0; i < wanted.length; i += CHUNK) {
    const chunk = wanted.slice(i, i + CHUNK);
    const url =
      `${API}/subset?latitude=${p.lat}&longitude=${p.lon}` +
      `&startDate=${chunk[0]}&endDate=${chunk.at(-1)}` +
      `&kmAboveBelow=0&kmLeftRight=0&band=${BAND}`;
    const t0 = Date.now();
    const j = await getJson(url);
    for (const s of j.subset) {
      if (have.has(s.modis_date)) continue;
      const raw = s.data[0];
      // MOD13Q1 fill value is -3000; scale factor 0.0001
      series.push({
        modis_date: s.modis_date,
        date: s.calendar_date,
        ndvi: raw <= -2000 ? null : Math.round(raw) / 10000,
      });
      have.add(s.modis_date);
    }
    series.sort((a, b) => a.date.localeCompare(b.date));
    fs.writeFileSync(
      outFile,
      JSON.stringify(
        {
          source: "NASA MODIS MOD13Q1 v061 via ORNL DAAC MODIS Web Service",
          kind: "NASA observation",
          resolution: "250 m, 16-day composite",
          point: { lat: p.lat, lon: p.lon },
          fetched: new Date().toISOString(),
          series,
        },
        null,
        0
      )
    );
    console.log(
      `${p.id}: ${series.length} dates saved (${chunk[0]}..${chunk.at(-1)}, ${Math.round(
        (Date.now() - t0) / 1000
      )} s)`
    );
  }
  console.log(`${p.id}: done, ${series.length} dates`);
}
