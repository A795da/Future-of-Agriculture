// Step 1: hard filters. A crop that fails is removed from the alternatives,
// and the reason is kept for the "why not" list.

import { MONTH_NAMES, round } from "../features/stats.js";
import { SNOW_MARGIN_C, dryYearCoverage } from "./agronomy.js";
import { phenology, seasonDays, sensitiveMonths, sowingDoy, zoneCalendar } from "./calendar.js";
import { HEAT_FAIL_RATIO, heatUnits } from "./heat.js";

export const MIN_RAINFED_COVERAGE = 0.35; // below this, a rain-fed crop fails in most dry years
// Crops that tolerate light frost can start before the last frost or finish after
// the first one, so they need fewer frost-free days than their full season.
export const FROST_SEASON_ALLOWANCE = { low: 0, medium: 30, high: 60 };

import { shortName } from "./names.js";
import { localYield } from "./yields.js";

// Observed farming beats the model: where TÜİK reports the crop in this province
// and water regime (in at least this many of the last 5 years), a failed water or
// warmth check becomes a risk instead of a removal, like the TAGEM official-calendar
// override. Winter cold, soil pH and the flowering heat limit stay hard checks.
// TÜİK numbers are for the whole province, so a few hectares (garden plots, a wetter
// valley) are not proof: where TÜİK gives the planted area, it must reach
// OBSERVED_MIN_HA a year. Where it gives no area (sunflower; irrigated land), the
// years alone count and the evidence says the area is unknown.
export const OBSERVED_MIN_YEARS = 3;
export const OBSERVED_MIN_HA = 1000;
const SOFT_CHECKS = new Set(["season", "warmth", "heat_units", "dry_year"]);

const POWER = ["NASA POWER", "NASA reanalysis"];

/**
 * @param local  TÜİK local yields for this province and water regime (yields.js), optional
 * @returns {{ id, name, ok, reasons: string[], details: object[], cautions: object[] }}
 *   `cautions`: soft-check failures kept as risks because TÜİK shows the crop grown here.
 */
export function checkCrop(crop, f, farmer, local = null) {
  const reasons = [];
  // Same order as `reasons`: what kind of evidence each failure rests on (crop check tab).
  const details = [];
  const cautions = [];
  const seen = localYield(local, crop.id);
  const observed =
    seen && !seen.mixed && seen.years >= OBSERVED_MIN_YEARS && (seen.planted_ha == null || seen.planted_ha >= OBSERVED_MIN_HA) ? seen : null;
  const water = farmer.irrigation === "irrigated" ? "irrigated" : "rain-fed";
  const add = (text, type, source, kind, check = null) => {
    if (observed && SOFT_CHECKS.has(check)) {
      cautions.push({
        type, source, kind, check,
        evidence: `${text}; but TÜİK reports ${water} ${shortName(crop)} in this province in ${observed.years} of the last 5 years (${observed.planted_ha != null ? `about ${observed.planted_ha} ha a year` : "area not reported"}), so local varieties and practice manage it somewhere in the province; check that your field is like those`,
      });
      return;
    }
    reasons.push(text);
    details.push({ type, evidence: text, source, kind, check });
  };
  if (farmer.never_grow?.includes(crop.id)) add("on your never-grow list", "farmer", "farmer", "farmer input");

  if (farmer.irrigation === "rainfed" && !crop.rainfed_ok) {
    add("usually needs irrigation, and your field is rain-fed", "water", "crop table", "compiled rule");
  }

  // Flooded paddy rice needs basins that hold standing water and a large, reliable
  // river or canal supply (about 16,000-22,000 m³ per hectare a season). Where TÜİK
  // reports irrigated rice on at least OBSERVED_MIN_HA, that supply exists in the
  // province; elsewhere rice is removed. Without TÜİK rice data it cannot be confirmed.
  if (crop.paddy && farmer.irrigation === "irrigated") {
    const rice = localYield(local, crop.id);
    const ok = rice && !rice.mixed && rice.years >= OBSERVED_MIN_YEARS && (rice.planted_ha == null || rice.planted_ha >= OBSERVED_MIN_HA);
    if (!ok) {
      const what = !(local?.coveredAll ?? local?.covered)?.has(crop.id)
        ? "no TÜİK rice statistics are loaded, so a paddy area with river or canal water cannot be confirmed here"
        : rice
          ? `TÜİK reports only about ${rice.planted_ha} ha of irrigated rice in this province (2020-2024); flooded rice needs paddy basins and a large, reliable river or canal supply, found where rice is already grown`
          : "TÜİK reports no irrigated rice in this province (2020-2024); flooded rice needs paddy basins and a large, reliable river or canal supply, found where rice is already grown";
      add(what, "water", "TÜİK MEDAS 2020-2024", "official statistics", "paddy_area");
    }
  }

  if (crop.winter_hardiness_c != null) {
    const ymin = f.yearly_min_temp_c.value;
    if (ymin < crop.winter_hardiness_c - SNOW_MARGIN_C) {
      add(`winters here reach ${ymin} °C in a typical year, colder than the ${crop.winter_hardiness_c} °C it survives`, "climate", ...POWER);
    }
  }

  // Season length at this place: official TAGEM calendar, heat units, or crop table.
  // With an official calendar for this crop and zone, local varieties fit the season.
  const official = zoneCalendar(crop.id, f)?.use === "full";
  if ((crop.season === "spring" || crop.season === "summer") && !official) {
    const ff = f.frost_free_days.value;
    const season = phenology(crop, f).season;
    const needed = season - (FROST_SEASON_ALLOWANCE[crop.frost_tolerance] ?? 0);
    if (ff < needed) {
      add(`the frost-free season is about ${ff} days, shorter than the ${season} days it needs`, "climate", ...POWER, "season");
    }
  }

  // temp_abs_c follows FAO EcoCrop, whose limits are for mean temperature, so the
  // check uses the monthly mean ((min + max) / 2), not the daily high. Damage from
  // single hot days at flowering is handled by heat_stress_c in the climate score.
  const months = sensitiveMonths(crop, f);
  for (const m of months) {
    const lo = f.monthly_tmin_c.value[m];
    const hi = f.monthly_tmax_c.value[m];
    if (lo == null || hi == null) continue;
    const mean = Math.round(((lo + hi) / 2) * 10) / 10;
    if (mean > crop.temp_abs_c[1]) {
      add(`the typical ${MONTH_NAMES[m]} mean temperature of ${mean} °C at flowering is above its ${crop.temp_abs_c[1]} °C limit`, "climate", "NASA POWER + FAO EcoCrop", "NASA reanalysis");
      break;
    }
  }

  // Warmth check for summer crops without FAO AquaCrop heat units (sesame, groundnut,
  // melons, ...): if even the warmest month of the season stays below the mean
  // temperature at which the crop starts to grow well (FAO EcoCrop TOPMN), the summer
  // is too cool. Skipped where the official calendar lists the crop for this zone.
  if (crop.season === "summer" && !crop.heat_units && !official) {
    const tmin = f.monthly_tmin_c.value;
    const tmax = f.monthly_tmax_c.value;
    const months = [...new Set([...seasonDays(crop, f)].map((d) => d.month))].filter((m) => tmin[m] != null && tmax[m] != null);
    if (months.length) {
      const warmest = months.reduce((a, m) => ((tmin[m] + tmax[m]) / 2 > (tmin[a] + tmax[a]) / 2 ? m : a));
      const mean = Math.round(((tmin[warmest] + tmax[warmest]) / 2) * 10) / 10;
      if (mean < crop.temp_opt_c[0]) {
        add(
          `the summer is too cool: even ${MONTH_NAMES[warmest]}, the warmest month of its season, averages ${mean} °C, below the ${crop.temp_opt_c[0]} °C it needs to grow well (FAO EcoCrop)`,
          "climate", "NASA POWER + FAO EcoCrop", "NASA reanalysis", "warmth"
        );
      }
    }
  }

  // An official TAGEM-DSİ calendar for this crop in this zone means local varieties
  // do mature here; the generic AquaCrop variety then only adds a risk note (score).
  const heat = heatUnits(crop, f, sowingDoy(crop, f));
  if (heat && heat.ratio < HEAT_FAIL_RATIO && !official) {
    add(
      `the summer is too cool: about ${heat.available} heat units above ${heat.base} °C between sowing and ${heat.endsAtFrost ? "the first autumn frost" : "the end of the season"}, but a typical variety needs ${heat.required} (FAO AquaCrop)`,
      "climate", "NASA POWER + FAO AquaCrop", "NASA reanalysis", "heat_units"
    );
  }

  const ph = farmer.soil_override?.ph ?? f.soil_ph?.value;
  if (ph != null && (ph < crop.soil_ph[0] || ph > crop.soil_ph[1])) {
    add(`soil pH ${ph} is outside its range ${crop.soil_ph[0]}-${crop.soil_ph[1]}`, "soil", farmer.soil_override?.ph != null ? "farmer soil test" : "SoilGrids", farmer.soil_override?.ph != null ? "farmer input" : "model estimate");
  }

  if (farmer.irrigation === "rainfed" && crop.rainfed_ok) {
    const w = dryYearCoverage(crop, f);
    if (w.coverage < MIN_RAINFED_COVERAGE) {
      add(`in a dry year rain covers only ${round(w.coverage * 100)}% of its water need`, "water", ...POWER, "dry_year");
    }
  }

  return { id: crop.id, name: shortName(crop), ok: reasons.length === 0, reasons, details, cautions };
}

export function filterCrops(crops, f, farmer, local = null) {
  return crops.map((c) => checkCrop(c, f, farmer, local));
}
