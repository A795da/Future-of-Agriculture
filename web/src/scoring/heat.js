// Heat units (growing degree days) for warm-season crops, with the crop's base
// and upper temperatures from the FAO AquaCrop default crop files. Daily maximum
// and minimum are clipped to [base, upper] before averaging (the AquaCrop way),
// so a cool day adds little and a very hot day adds no more than the upper limit.
//
// Temperatures come from the monthly median minimum and maximum (NASA POWER),
// so this describes a typical year; the 15% margin below covers that smoothing
// and local short-season varieties.

import { monthOfDoy } from "../features/stats.js";

export const HEAT_FAIL_RATIO = 0.85; // below this share of the need, the crop is ruled out
const MAX_SEASON_DAYS = 330;

export function gddOn(f, doy, base, upper) {
  const m = monthOfDoy(doy);
  const clip = (v) => Math.min(upper, Math.max(base, v));
  return (clip(f.monthly_tmax_c.value[m]) + clip(f.monthly_tmin_c.value[m])) / 2 - base;
}

/** Days from startDoy until `target` heat units are reached, or null within the cap. */
export function daysToGdd(f, startDoy, target, base, upper, cap = MAX_SEASON_DAYS) {
  let sum = 0;
  for (let d = 0; d < cap; d++) {
    sum += gddOn(f, ((startDoy - 1 + d) % 365) + 1, base, upper);
    if (sum >= target) return d + 1;
  }
  return null;
}

/**
 * Heat units available between sowing and the end of the season. For crops that
 * are not frost-hardy the season ends at the median first autumn frost.
 */
export function heatUnits(crop, f, startDoy) {
  const h = crop.heat_units;
  if (!h || !f?.monthly_tmax_c) return null;
  const faf = f.first_autumn_frost_doy?.value ?? 366;
  const stopAtFrost = crop.frost_tolerance !== "high" && faf > startDoy && faf <= 365;
  const lastDay = stopAtFrost ? faf - startDoy : MAX_SEASON_DAYS;
  let available = 0;
  for (let d = 0; d < lastDay; d++) available += gddOn(f, ((startDoy - 1 + d) % 365) + 1, h.base_c, h.upper_c);
  return {
    available: Math.round(available),
    required: h.maturity_gdd,
    ratio: available / h.maturity_gdd,
    base: h.base_c,
    endsAtFrost: stopAtFrost,
    source: h.source,
  };
}
