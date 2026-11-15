// Vegetation features from the cached MODIS NDVI series (16-day, 250 m).
// NDVI is low both on bare soil and on dormant winter crops, so "low-green
// months" describes what the satellite saw, not proof of a bare field.

import { median, round } from "./stats.js";

export const LOW_GREEN_NDVI = 0.2;

export function computeVegetationFeatures(ndviCache) {
  const series = (ndviCache?.series ?? []).filter((s) => s.ndvi != null);
  if (series.length < 46) return null; // less than ~2 years of composites
  const byMonth = Array.from({ length: 12 }, () => []);
  for (const s of series) byMonth[+s.date.slice(5, 7) - 1].push(s.ndvi);
  const ndviByMonth = byMonth.map((v) => round(median(v), 2));
  const years = new Set(series.map((s) => s.date.slice(0, 4)));
  const period = `${series[0].date.slice(0, 4)}-${series.at(-1).date.slice(0, 4)} (${years.size} years)`;
  const F = (value, unit) => ({ value, unit, source: "MODIS NDVI (MOD13Q1)", kind: "NASA observation", period });
  return {
    ndvi_by_month: F(ndviByMonth, "NDVI"),
    bare_months: F(ndviByMonth.filter((v) => v != null && v < LOW_GREEN_NDVI).length, "months"),
    peak_ndvi_month: F(ndviByMonth.indexOf(Math.max(...ndviByMonth.filter((v) => v != null))), "month index"),
  };
}
