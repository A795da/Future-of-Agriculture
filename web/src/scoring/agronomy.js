// Per-crop calculations shared by the filter and the dimension scores:
// water balance over the crop's season and frost/heat history at its
// sensitive stage. Simple, documented rules; tune with an agronomist.

import { MONTH_DAYS, monthOfDoy } from "../features/stats.js";
import { phenology, seasonDays, sensitiveDekads } from "./calendar.js";

export const EFFECTIVE_RAIN = 0.75; // share of rain that reaches the root zone (simple FAO-style factor)
export const BASE_STORED_MM = 30; // soil water left at sowing even after a dry spell
export const RECHARGE_SHARE = 0.6; // share of the 4 months of rain before sowing still stored at sowing
export const AVAILABLE_WATER_MM_PER_M = 150; // typical plant-available water per metre of loam soil
export const FALLOW_BONUS_MM = 60; // extra stored water after a fallow year
// The yearly minimum is a 2 m air temperature; snow cover and hardening usually
// protect winter crops by a few degrees.
export const SNOW_MARGIN_C = 3;
// A heat year needs a clear exceedance: the check uses the single hottest day of
// each 10-day period on a coarse grid, so one day just above the limit is not
// counted as damaging.
export const HEAT_MARGIN_C = 2;

/** Soil water available at sowing: recharge from the rain of the previous 4 months, capped by the root zone. */
export function storedWater(crop, f, startDoy, { dry = false, afterFallow = false } = {}) {
  const rain = (dry ? f.monthly_rain_dry_mm : f.monthly_rain_mm).value;
  const m0 = monthOfDoy(startDoy);
  let before = 0;
  for (let k = 1; k <= 4; k++) before += rain[(m0 - k + 12) % 12] ?? 0;
  const cap = AVAILABLE_WATER_MM_PER_M * crop.root_depth_m[1];
  return Math.min(cap, BASE_STORED_MM + RECHARGE_SHARE * before + (afterFallow ? FALLOW_BONUS_MM : 0));
}

/** Crop water need (ETc) and rain over its season, in mm. */
export function cropWater(crop, f) {
  const { start } = phenology(crop, f);
  const et0 = f.monthly_et0_mm.value;
  const rain = f.monthly_rain_mm.value;
  const dry = f.monthly_rain_dry_mm.value;
  let need = 0;
  let rainMed = 0;
  let rainDry = 0;
  for (const { month, kc } of seasonDays(crop, f)) {
    const days = MONTH_DAYS[month];
    need += (kc * (et0[month] ?? 0)) / days;
    rainMed += (rain[month] ?? 0) / days;
    rainDry += (dry[month] ?? 0) / days;
  }
  return { need, rainMed, rainDry, start };
}

/** Rain-fed: share of need covered in a dry year (0-1+). */
export function dryYearCoverage(crop, f, afterFallow = false) {
  const w = cropWater(crop, f);
  const stored = storedWater(crop, f, w.start, { dry: true, afterFallow });
  const supply = EFFECTIVE_RAIN * w.rainDry + stored;
  return { ...w, stored, supply, coverage: w.need > 0 ? supply / w.need : 1 };
}

/** Irrigated: water the farmer must add in a normal year, mm. */
export function irrigationNeed(crop, f, afterFallow = false) {
  const w = cropWater(crop, f);
  const stored = storedWater(crop, f, w.start, { afterFallow });
  const supply = EFFECTIVE_RAIN * w.rainMed + stored;
  return { ...w, stored, supply, deficit: Math.max(0, w.need - supply) };
}

/** Count past years with damaging frost or heat at the sensitive stage, or a winter colder than the crop survives. */
export function climateHistory(crop, f) {
  const years = f.dekad_extremes_by_year.value;
  const months = sensitiveDekads(crop, f); // dekad indices 0-35
  // December to February, as dekads
  const winterMonths = crop.winter_hardiness_c != null ? [33, 34, 35, 0, 1, 2, 3, 4, 5] : [];
  let frostYears = 0;
  let heatYears = 0;
  let winterYears = 0;
  let badYears = 0;
  for (const y of years) {
    const frost = months.some((m) => y.tmin_abs[m] != null && y.tmin_abs[m] < crop.frost_damage_c);
    const heat = months.some((m) => y.tmax_abs[m] != null && y.tmax_abs[m] > crop.heat_stress_c + HEAT_MARGIN_C);
    const winter = winterMonths.some(
      (m) => y.tmin_abs[m] != null && y.tmin_abs[m] < crop.winter_hardiness_c - SNOW_MARGIN_C
    );
    frostYears += frost;
    heatYears += heat;
    winterYears += winter;
    badYears += frost || heat || winter;
  }
  return { n: years.length, frostYears, heatYears, winterYears, badYears, okShare: 1 - badYears / years.length, months };
}
