// Today tab: the next 7 days of forecast against the crop's own limits.
// Code decides every colour. Green = nothing to act on; yellow = watch / adjust
// plans; red = damage likely or act now. Reminders are qualitative: no doses.
//
// The crop's stage is estimated from the typical sowing date at this place
// (TAGEM-DSİ zone calendar or crop table, thermal time for winter crops), because
// the farmer's own planting date is not an input yet.

import { MONTH_NAMES, MONTH_START, monthOfDoy, round, sum } from "../features/stats.js";
import { SNOW_MARGIN_C } from "./agronomy.js";
import { SENSITIVE_DAYS, kcOnDay, phenology } from "./calendar.js";
import { shortName } from "./names.js";

// ---- thresholds (named so an agronomist can tune them)
export const HEAVY_RAIN_MM = 20; // same as the heavy-rain days feature (features/climate.js)
export const VERY_HEAVY_RAIN_MM = 40;
export const FROST_WATCH_MARGIN_C = 2; // yellow when the low is within 2 °C of the damage limit
export const HEAT_WATCH_MARGIN_C = 2;
export const WINTER_WATCH_MARGIN_C = 3;
export const DRY_WEEK_RAIN_MM = 5; // less than this in 7 days counts as a dry week
export const DRY_WEEK_USE_MM = 15; // ...when the crop would use at least this much
export const DRY_WEEK_RED_USE_MM = 25; // at flowering, this much use with no rain is red
export const SOWING_SOON_DAYS = 30;

export const LEVELS = ["green", "yellow", "red"];
const RANK = { green: 0, info: 0, yellow: 1, red: 2 };
const worst = (a, b) => (RANK[b] > RANK[a] ? b : a);

export const STAGE_LABELS = {
  not_in_field: "not in the field now",
  before_sowing: "sowing time is near",
  establishment: "young plants",
  winter_rest: "winter rest",
  growing: "growing",
  flowering: "flowering (most sensitive)",
  ripening: "ripening",
};

const SOURCES = {
  forecast: { source: "Open-Meteo forecast", kind: "model estimate" },
  fertilizer: {
    source: "Univ. of Kentucky Grain Crops; UNL CropWatch",
    kind: "compiled rule",
  },
  team: { source: "FieldShift rule (compiled, unverified)", kind: "compiled rule" },
};

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** "2026-11-18" → "Wed 18 Nov" */
export function shortDate(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DAY[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]}`;
}

/** Day of year 1-365 (29 Feb folded onto 28 Feb, like the climate features). */
export function doyOf(iso) {
  const [, m, d] = iso.split("-").map(Number);
  return MONTH_START[m - 1] + Math.min(d, m === 2 ? 28 : 31);
}

/** Where the crop is in its season on this date, from the typical calendar here. */
export function cropStage(crop, f, iso) {
  const doy = doyOf(iso);
  const ph = phenology(crop, f);
  const month = monthOfDoy(doy);
  const winterMonth = month === 11 || month <= 1;
  const base = { estimated: true, calendar: ph.calendar, sowing_doy: ph.start };
  if (crop.season === "perennial") {
    return { ...base, key: winterMonth ? "winter_rest" : "growing", das: null };
  }
  const das = (doy - ph.start + 365) % 365;
  if (das >= ph.season) {
    const toSow = (ph.start - doy + 365) % 365;
    return { ...base, key: toSow <= SOWING_SOON_DAYS ? "before_sowing" : "not_in_field", das: null, days_to_sowing: toSow };
  }
  const [a, b, c] = ph.stages;
  let key = "growing";
  if (ph.sensitiveDas != null && das >= ph.sensitiveDas && das < ph.sensitiveDas + SENSITIVE_DAYS) key = "flowering";
  else if (das >= a + b + c) key = "ripening";
  else if (crop.season === "winter" && winterMonth) key = "winter_rest";
  else if (das < a) key = "establishment";
  return { ...base, key, das, stages: ph.stages };
}

const inField = (stage) => !["not_in_field", "before_sowing"].includes(stage.key);

/** Frost limit for this stage: [red below, yellow below, what the limit means]. */
function frostLimit(crop, stage, month) {
  const k = stage.key;
  // Autumn and winter (Oct-Feb), before flowering: a winter crop is judged by its
  // winter hardiness, not by the flowering frost limit.
  const coldSeason = month >= 9 || month <= 1;
  if (crop.winter_hardiness_c != null && k !== "flowering" && k !== "ripening" && (k === "winter_rest" || coldSeason)) {
    const red = crop.winter_hardiness_c - SNOW_MARGIN_C;
    return [red, crop.winter_hardiness_c + WINTER_WATCH_MARGIN_C, `hardened ${shortName(crop)} survives about ${crop.winter_hardiness_c} °C; snow cover protects it by a few degrees`, "hardiness", crop.winter_hardiness_c];
  }
  if (k === "flowering") {
    return [crop.frost_damage_c, crop.frost_damage_c + FROST_WATCH_MARGIN_C, `${shortName(crop)} is damaged below ${crop.frost_damage_c} °C at flowering`, "flowering", crop.frost_damage_c];
  }
  if (crop.frost_tolerance === "low") {
    return [0, FROST_WATCH_MARGIN_C, `${shortName(crop)} is frost-sensitive: any frost can damage it`, "sensitive", 0];
  }
  return [crop.frost_damage_c, crop.frost_damage_c + FROST_WATCH_MARGIN_C, `${shortName(crop)} is damaged below about ${crop.frost_damage_c} °C`, "general", crop.frost_damage_c];
}

/**
 * @param {Object} p
 * @param {string} p.cropId   crop in the field now, or "fallow"
 * @param {Object} p.forecast data/forecast.js output
 * @param {Object} p.features climate features (for the calendar)
 * @param {Object} p.cropsById
 * @param {string} p.irrigation "rainfed" | "irrigated"
 */
export function runToday({ cropId, forecast, features, cropsById, irrigation }) {
  const days = forecast.days;
  const today = days[0].date;
  const crop = cropId === "fallow" ? null : cropsById[cropId];
  const stage = crop ? cropStage(crop, features, today) : { key: "fallow", estimated: false };
  const name = crop ? shortName(crop) : "fallow";
  const growing = crop && inField(stage);
  const bare = !crop || !growing || stage.key === "establishment";
  const alerts = [];
  const dayStatus = days.map(() => "green");
  const flag = (i, level) => (dayStatus[i] = worst(dayStatus[i], level));
  const push = (a) => {
    a.dates.forEach((d) => flag(days.findIndex((x) => x.date === d), a.level));
    alerts.push(a);
  };

  // ---- frost and winter cold
  if (growing) {
    const [red, yellow, meaning, mode, limit] = frostLimit(crop, stage, monthOfDoy(doyOf(today)));
    const hardiness = meaning.startsWith("hardened");
    const hits = days.filter((d) => d.tmin != null && d.tmin < yellow);
    if (hits.length) {
      const low = hits.reduce((a, b) => (b.tmin < a.tmin ? b : a));
      const level = low.tmin < red ? "red" : "yellow";
      push({
        type: "frost",
        level,
        evidence: `lows down to ${low.tmin} °C (${shortDate(low.date)}); ${meaning}`,
        action:
          hardiness
            ? "check snow cover and plant damage after the cold nights; ask a local agronomist before replanting"
            : level === "red"
              ? "frost damage is likely: plan protection where possible (irrigation the evening before can reduce frost on some crops) and check flowers afterwards"
              : "watch the forecast; the low is close to the damage limit",
        dates: hits.map((d) => d.date),
        ...SOURCES.forecast,
        source: "Open-Meteo forecast + crop table",
        // structured values so the interface can say the same thing in Turkish
        data: { value: low.tmin, date: low.date, mode, limit, action: hardiness ? "snow" : level === "red" ? "protect" : "watch" },
      });
    }
  }

  // ---- heat
  if (growing && (stage.key === "flowering" || stage.key === "growing")) {
    const redAt = stage.key === "flowering" ? crop.heat_stress_c : Infinity;
    const yellowAt = stage.key === "flowering" ? crop.heat_stress_c - HEAT_WATCH_MARGIN_C : crop.heat_stress_c + HEAT_WATCH_MARGIN_C;
    const hits = days.filter((d) => d.tmax != null && d.tmax > yellowAt);
    if (hits.length) {
      const hot = hits.reduce((a, b) => (b.tmax > a.tmax ? b : a));
      const level = hot.tmax > redAt ? "red" : "yellow";
      push({
        type: "heat",
        level,
        evidence: `highs up to ${hot.tmax} °C (${shortDate(hot.date)}); ${name} is stressed above ${crop.heat_stress_c} °C${stage.key === "flowering" ? " at flowering" : ""}`,
        action:
          irrigation === "irrigated"
            ? "irrigate before the hot days rather than during the midday heat"
            : "heat at flowering can cut yield; nothing to add on a rain-fed field, but note it for next year's variety choice",
        dates: hits.map((d) => d.date),
        source: "Open-Meteo forecast + crop table",
        kind: "model estimate",
        data: { value: hot.tmax, date: hot.date, limit: crop.heat_stress_c, flowering: stage.key === "flowering", action: irrigation === "irrigated" ? "irrigate" : "note" },
      });
    }
  }

  // ---- heavy rain
  const wet = days.filter((d) => d.rain >= HEAVY_RAIN_MM);
  if (wet.length) {
    const top = wet.reduce((a, b) => (b.rain > a.rain ? b : a));
    const level = top.rain >= VERY_HEAVY_RAIN_MM ? "red" : "yellow";
    const actions = [];
    const actionKeys = [];
    if (growing) actionKeys.push("fertilizer");
    if (stage.key === "before_sowing") actionKeys.push("drain");
    if (stage.key === "ripening") actionKeys.push("harvest");
    if (bare) actionKeys.push("topsoil");
    if (growing) actions.push("do not spread nitrogen fertilizer in the 2-3 days before it: heavy rain can wash surface fertilizer off the field or down past the roots");
    if (stage.key === "before_sowing") actions.push("wait for the soil to drain before sowing or driving machinery on it");
    if (stage.key === "ripening") actions.push("if the crop is ready, harvest before the rain");
    if (bare) actions.push("the soil is bare or barely covered, so heavy rain can wash topsoil away; avoid tilling just before it");
    push({
      type: "rain",
      level,
      evidence: `${round(top.rain)} mm of rain forecast on ${shortDate(top.date)}${wet.length > 1 ? ` (${wet.length} days with ${HEAVY_RAIN_MM} mm or more)` : ""}`,
      action: actions.join("; ") || "check drainage",
      dates: wet.map((d) => d.date),
      ...(growing ? SOURCES.fertilizer : SOURCES.team),
      data: { value: round(top.rain), date: top.date, days: wet.length, actions: actionKeys.length ? actionKeys : ["drainage"] },
    });
  }

  // ---- dry week: crop water use vs forecast rain
  const weekRain = sum(days.map((d) => d.rain ?? 0));
  if (growing && stage.key !== "winter_rest" && stage.key !== "ripening") {
    const use = sum(
      days.map((d, i) => {
        const das = stage.das == null ? 60 : stage.das + i;
        return (d.et0 ?? 0) * kcOnDay(crop, das, stage.stages);
      })
    );
    if (irrigation === "irrigated") {
      push({
        type: "water",
        level: "info",
        evidence: `${name} will use about ${round(use)} mm of water this week; about ${round(weekRain)} mm of rain is forecast`,
        action: use - weekRain > 10 ? `plan about ${round(use - weekRain)} mm of irrigation over the week` : "rain should cover this week's need",
        dates: [],
        source: "Open-Meteo forecast + FAO-56",
        kind: "model estimate",
        data: { use: round(use), rain: round(weekRain), need: round(use - weekRain), action: use - weekRain > 10 ? "plan" : "covered" },
      });
    } else if (weekRain < DRY_WEEK_RAIN_MM && use >= DRY_WEEK_USE_MM) {
      push({
        type: "water",
        level: stage.key === "flowering" && use >= DRY_WEEK_RED_USE_MM ? "red" : "yellow",
        evidence: `only ${round(weekRain)} mm of rain in the next 7 days while ${name} uses about ${round(use)} mm`,
        action: "the crop lives on stored soil water this week; avoid extra tillage that dries the topsoil",
        dates: days.map((d) => d.date),
        source: "Open-Meteo forecast + FAO-56",
        kind: "model estimate",
        data: { use: round(use), rain: round(weekRain), action: "stored" },
      });
    }
  }

  const status = alerts.reduce((s, a) => worst(s, a.level), "green");
  const gaps = [
    "forecast from Open-Meteo weather models (not NASA); it describes an area a few km wide",
    crop ? `${name}'s stage is estimated from the typical sowing date here (${stage.calendar}); your own planting date is not an input yet` : null,
    "crop limits compiled from FAO sources, not yet checked by a local expert",
    "no local pest or disease warnings",
  ].filter(Boolean);
  if (forecast.snapshot) gaps.unshift(`live forecast unavailable: showing a forecast saved on ${forecast.snapshot}, not today's`);

  return {
    crop: cropId,
    stage: { ...stage, label: crop ? STAGE_LABELS[stage.key] : "fallow (no crop)" },
    status,
    days: days.map((d, i) => ({ ...d, status: dayStatus[i] })),
    alerts: alerts.sort((a, b) => RANK[b.level] - RANK[a.level]),
    week_rain_mm: round(weekRain, 1),
    gaps,
    confidence: forecast.snapshot ? "low" : "medium",
  };
}

/** The crop most likely in the field today among the rotation's crops (else fallow). */
export function guessCropNow(sequence, cropsById, f, iso) {
  const ids = [...new Set(sequence.filter((id) => id !== "fallow" && cropsById[id]))];
  const growing = ids.find((id) => inField(cropStage(cropsById[id], f, iso)));
  if (growing) return growing;
  const soon = ids.find((id) => cropStage(cropsById[id], f, iso).key === "before_sowing");
  return soon ?? "fallow";
}

/** Template summary of the week, from the result only. */
export function todaySummary(r, nameOf) {
  const n = nameOf(r.crop);
  const top = r.alerts.find((a) => a.level !== "info");
  const sowMonth = r.stage.sowing_doy ? MONTH_NAMES[monthOfDoy(r.stage.sowing_doy)] : null;
  if (r.stage.key === "not_in_field" && !top) return `${n.charAt(0).toUpperCase() + n.slice(1)} is not in the field now (usually sown in ${sowMonth}).`;
  if (r.stage.key === "before_sowing" && !top) return `Sowing time for ${n} is near (about ${r.stage.days_to_sowing} days). No heavy rain in the next 7 days.`;
  if (!top) {
    return r.crop === "fallow"
      ? "No heavy rain in the next 7 days, so little erosion risk on the bare field."
      : `No frost, heat, heavy rain or dry-week risk for ${n} in the next 7 days.`;
  }
  const word = { frost: "Frost", heat: "Heat", rain: "Heavy rain", water: "Dry week" }[top.type];
  return `${word} ${top.level === "red" ? "warning" : "watch"} for ${r.crop === "fallow" ? "your field" : n}: ${top.evidence}.${r.alerts.length > 1 ? ` ${r.alerts.length - 1} more note${r.alerts.length > 2 ? "s" : ""} below.` : ""}`;
}
