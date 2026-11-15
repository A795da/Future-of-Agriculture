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

/**
 * Extra water a flooded paddy loses beyond crop water use, mm (FAO Training Manual 3,
 * section 4.4): soaking the root zone before planting, building the standing water
 * layer, and seepage and percolation every day the basin is flooded. The TAGEM-DSİ
 * guide's rice figures leave these out (its Note 2), so they are added here.
 * `percolationMmDay` lets a soil test or a what-if pick 4 (heavy clay) to 8 (sandy).
 */
export function paddyLosses(crop, f, percolationMmDay = null) {
  const p = crop.paddy;
  if (!p) return null;
  const days = phenology(crop, f).season;
  // Seepage by topsoil texture: FAO gives 4 mm/day for heavy clay, 8 for sandy
  // soil and 6 as the average; texture from the farmer or NASA HWSD (loader.js).
  const [lo, hi] = p.percolation_range_mm_day ?? [p.percolation_mm_day, p.percolation_mm_day];
  const tex = f.soil_texture;
  const byClass = { clay: lo, loam: p.percolation_mm_day, sandy: hi };
  const perc = percolationMmDay ?? byClass[tex?.value?.class] ?? p.percolation_mm_day;
  const fixed = p.saturation_mm + p.water_layer_mm;
  return {
    days,
    saturation: p.saturation_mm,
    water_layer: p.water_layer_mm,
    perc_mm_day: perc,
    soil: tex ? { class: tex.value.class, clay: tex.value.clay ?? null, sand: tex.value.sand ?? null, source: tex.source } : null,
    percolation: perc * days,
    total: fixed + perc * days,
    range: [fixed + lo * days, fixed + hi * days], // heavy clay .. sandy soil
  };
}

/** Plain-language seepage basis for rice evidence, and the source label to cite. */
export function describePaddySoil(w) {
  const p = w.paddy;
  const r = (x) => Math.round(x);
  const range = `; ${r(w.deficitRange[0])} mm on heavy clay to ${r(w.deficitRange[1])} mm on sandy soil`;
  if (!p.soil) return { text: `seepage at the average ${p.perc_mm_day} mm a day (soil type unknown)${range}`, source: "NASA POWER + FAO Training Manual 3" };
  if (p.soil.source === "farmer") return { text: `seepage ${p.perc_mm_day} mm a day for your ${p.soil.class} soil`, source: "NASA POWER + FAO Training Manual 3 + farmer soil type" };
  return {
    text: `seepage ${p.perc_mm_day} mm a day for ${p.soil.class} topsoil (NASA HWSD: ${p.soil.clay}% clay, ${p.soil.sand}% sand on a ~5 km grid; set your soil type if your field differs)${range}`,
    source: "NASA POWER + NASA HWSD + FAO Training Manual 3",
  };
}

/** Irrigated: water the farmer must add in a normal year, mm. */
export function irrigationNeed(crop, f, afterFallow = false) {
  const w = cropWater(crop, f);
  const paddy = paddyLosses(crop, f);
  if (paddy) {
    // FAO paddy method: no stored-soil-water credit (soaking the soil is counted in
    // the saturation term); rain falling on the flooded basin still counts.
    const supply = EFFECTIVE_RAIN * w.rainMed;
    const gross = w.need + paddy.total;
    return {
      ...w, stored: 0, supply, paddy,
      deficit: Math.max(0, gross - supply),
      deficitRange: paddy.range.map((x) => Math.max(0, w.need + x - supply)),
    };
  }
  const stored = storedWater(crop, f, w.start, { afterFallow });
  const supply = EFFECTIVE_RAIN * w.rainMed + stored;
  return { ...w, stored, supply, deficit: Math.max(0, w.need - supply) };
}

/**
 * Split a season's irrigation total by calendar month, in the crop's season order.
 * Each month's share follows its gap between crop use (kc × ET0) and effective rain,
 * so the months add up to `total` (the stored-soil-water credit is spread with them).
 * @returns {{ month: number, mm: number }[]} month is 0-11
 */
export function monthlyIrrigation(crop, f, total, { dry = false } = {}) {
  if (!(total > 0)) return [];
  const et0 = f.monthly_et0_mm.value;
  const rain = (dry ? f.monthly_rain_dry_mm : f.monthly_rain_mm).value;
  const gap = new Map();
  for (const { month, kc } of seasonDays(crop, f)) {
    const d = MONTH_DAYS[month];
    gap.set(month, (gap.get(month) ?? 0) + (kc * (et0[month] ?? 0) - EFFECTIVE_RAIN * (rain[month] ?? 0)) / d);
  }
  const pos = [...gap].map(([month, g]) => [month, Math.max(0, g)]);
  const sum = pos.reduce((a, [, g]) => a + g, 0);
  if (!sum) return [];
  return pos.map(([month, g]) => ({ month, mm: (total * g) / sum })).filter((x) => x.mm >= 1);
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
