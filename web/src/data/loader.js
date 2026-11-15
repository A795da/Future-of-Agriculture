// Data loader: one place that turns "a province" or "a drawn field" into the
// features the scoring reads. Cached province features load instantly and work
// offline; a drawn field fetches NASA POWER live and computes the same features.

import { fetchPowerDaily } from "./power.js";
import { computeClimateFeatures } from "../features/climate.js";
import { computeVegetationFeatures } from "../features/vegetation.js";
import { computeTerrainFeatures, gridAroundPin } from "../features/terrain.js";

const HISTORY_START = new Date("2005-01-01");
const HISTORY_END = new Date("2024-12-31");
// Our own endpoint: dev proxy in vite.config.js, serverless function in web/api/elevation.js
// (OpenTopoData does not allow direct browser calls).
const ELEVATION_API = "/api/elevation";

async function getJson(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

export async function loadTables() {
  const [cropTable, rotationTable, provinces, tagem, nutrientTable, ruleTable] = await Promise.all([
    getJson("/data/crops.json"),
    getJson("/data/rotations.json"),
    getJson("/data/provinces.json"),
    getJson("/data/tagem_calendar.json"),
    getJson("/data/nutrients.json"),
    getJson("/data/rotation_rules.json"),
  ]);
  return { cropTable, rotationTable, provinces, tagem, nutrientTable, ruleTable };
}

/** Add the TAGEM-DSİ sowing calendar of the province's climate zone as a feature.
 * The guide is written for irrigated crops. On rain-fed fields only winter-crop
 * sowing dates and spring cereals are taken from it: rain-fed spring and summer
 * crops are sown earlier to use the soil moisture left by winter, so they keep the
 * crop table's defaults. */
export function withSowingCalendar(features, province, tagem, irrigation = "irrigated") {
  const zone = province?.tagem_zone;
  if (!features || !tagem || !zone || !tagem.calendars[zone]) return features;
  const all = tagem.calendars[zone];
  const value =
    irrigation === "rainfed"
      ? Object.fromEntries(Object.entries(all).filter(([id, c]) => c.use === "sowing_only" || id.startsWith("spring_")))
      : all;
  return {
    ...features,
    sowing_calendar: {
      value,
      unit: "",
      source: `TAGEM-DSİ 2017, zone ${zone} (${tagem.zones[zone]})`,
      kind: "compiled rule",
      period: "2017 guide",
      zone,
      zone_name: tagem.zones[zone],
      listed: Object.keys(all), // our crops the guide lists for this zone
      mapped: Object.keys(tagem.crops), // our crops that have a TAGEM name at all
    },
  };
}

const memo = new Map();
const remember = (key, make) => {
  if (!memo.has(key)) memo.set(key, make().catch((e) => { memo.delete(key); throw e; }));
  return memo.get(key);
};

/** Cached climate features (+ NDVI if cached) for a province point. */
export function loadProvinceData(p) {
  return remember(`province:${p.id}`, async () => {
    const { features } = await getJson(`/data/cache/${p.id}/features.json`);
    let vegetation = null;
    try {
      vegetation = computeVegetationFeatures(await getJson(`/data/cache/${p.id}/ndvi.json`));
    } catch {
      /* no NDVI cached for this province yet */
    }
    return { features, vegetation };
  });
}

/** Live NASA POWER history (2005-2024) for any point, turned into features. */
export function loadPointFeatures(lat, lon) {
  const la = +lat.toFixed(2);
  const lo = +lon.toFixed(2);
  return remember(`point:${la},${lo}`, async () => {
    const conditions = await fetchPowerDaily({ lat: la, lon: lo, start: HISTORY_START, end: HISTORY_END });
    return computeClimateFeatures(conditions, la);
  });
}

/** Field slope from SRTM elevations at the field's sample points. Returns null if unavailable. */
export function loadTerrain(field) {
  const points = (field.kind === "pin" ? gridAroundPin(field.centroid) : field.sample_points).slice(0, 100);
  if (points.length < 3) return Promise.resolve(null);
  const key = `terrain:${points.map((p) => p.join(",")).join("|")}`;
  return remember(key, async () => {
    const locations = points.map(([lon, lat]) => `${lat.toFixed(5)},${lon.toFixed(5)}`).join("|");
    const j = await getJson(`${ELEVATION_API}?locations=${locations}`, { signal: AbortSignal.timeout(15000) });
    const elevations = (j.results ?? []).map((r) => r.elevation);
    return computeTerrainFeatures(points, elevations);
  });
}
