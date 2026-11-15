// Water-supply warning from NASA GRACE/GRACE-FO: where total water stored on land
// and underground (groundwater, soil, lakes, snow) has been falling for two decades,
// wells and reservoirs may become less reliable. Irrigated fields only; it never
// removes a crop. GRACE mascons are ~300 km, so this describes the basin, not the farm.

import { round } from "../features/stats.js";

export const WATER_STORAGE_DECLINE_CM_YR = -1.0; // team-compiled: falling faster than 1 cm of water a year

/** Plain facts for the evidence line, or null without GRACE data. */
export function waterSupply(f) {
  const w = f?.water_storage;
  if (!w) return null;
  const { trend_cm_yr: trend, change_cm: change } = w.value;
  const falling = trend <= WATER_STORAGE_DECLINE_CM_YR;
  const since = (w.period ?? "").slice(0, 4) || "2002";
  const text =
    trend < -0.2
      ? `NASA GRACE satellites show water stored on land and underground in this area (a ~300 km region) falling about ${Math.abs(trend)} cm a year since ${since}, about ${Math.abs(round(change))} cm of water in total`
      : `NASA GRACE satellites show water stored on land and underground in this area (a ~300 km region) roughly stable since ${since} (${trend >= 0 ? "+" : ""}${trend} cm a year)`;
  return { trend, change, falling, text, source: w.source, kind: w.kind };
}
