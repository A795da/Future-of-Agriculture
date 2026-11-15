// Crop calendars: when each crop is in the field, its daily crop coefficient,
// and which days of a rotation leave the soil bare.
// A rotation year runs 1 July -> 30 June, so a winter crop sown in October and
// a spring crop sown the following March belong to consecutive years.
//
// Winter crops use thermal time (growing degree days): their flowering and
// harvest dates move with local temperature, so wheat flowers in April in
// Şanlıurfa and in late May in Konya. Other crops use the fixed season length
// from the crop table.

import { MONTH_DAYS, MONTH_START, dekadOfDoy, monthOfDoy } from "../features/stats.js";

const JUL1 = 182;
export const SENSITIVE_DAYS = 20;
const MIN_GRAIN_FILL_DAYS = 25;

const doyAfter = (startDoy, d) => ((startDoy - 1 + d) % 365) + 1;

/** Official TAGEM-DSİ calendar entry for this crop in the field's climate zone, if any. */
export function zoneCalendar(cropId, f) {
  return f?.sowing_calendar?.value?.[cropId] ?? null;
}

const dekadStartDoy = (month, dekad) => MONTH_START[month - 1] + (dekad - 1) * 10 + 5; // middle of the dekad

/** Sowing day of year. TAGEM-DSİ zone calendar when available; otherwise winter crops
 * sow on the 15th of the first sowing month and frost-sensitive spring/summer crops
 * wait for the last spring frost. */
export function sowingDoy(crop, f) {
  const cal = zoneCalendar(crop.id, f);
  if (cal) return dekadStartDoy(cal.sow_month, cal.sow_dekad);
  const first = crop.sowing_months[0];
  const last = crop.sowing_months.at(-1);
  if (crop.phenology) return MONTH_START[first - 1] + 15;
  let doy = MONTH_START[first - 1] + 1;
  if ((crop.season === "spring" || crop.season === "summer") && crop.frost_tolerance === "low") {
    const lsf = f?.last_spring_frost_doy?.value;
    const latest = MONTH_START[last - 1] + MONTH_DAYS[last - 1];
    if (lsf != null && lsf + 7 > doy) doy = Math.min(lsf + 7, latest);
  }
  return doy;
}

function scaleStages(stages, total) {
  const sum = stages.reduce((a, b) => a + b, 0);
  const out = stages.map((s) => Math.max(1, Math.round((s * total) / sum)));
  out[1] += total - out.reduce((a, b) => a + b, 0); // keep the exact total
  return out;
}

const cache = new WeakMap();

/** Season for this crop at this location: { start, season, sensitiveDas, stages }. */
export function phenology(crop, f) {
  let byCrop = f ? cache.get(f) : null;
  if (f && !byCrop) cache.set(f, (byCrop = new Map()));
  if (byCrop?.has(crop.id)) return byCrop.get(crop.id);

  const start = sowingDoy(crop, f);
  const cal = zoneCalendar(crop.id, f);
  let res = {
    start,
    season: crop.season_days,
    sensitiveDas: crop.sensitive_das,
    stages: crop.stages_days,
    thermal: false,
    calendar: cal ? "TAGEM-DSİ 2017" : "crop table",
  };
  if (cal?.use === "full" && crop.season !== "perennial") {
    // Season and FAO-56 stages straight from the guide; the sensitive stage keeps
    // its place in the season.
    const season = cal.season;
    const sensitiveDas =
      crop.sensitive_das == null
        ? null
        : Math.max(0, Math.min(Math.round((crop.sensitive_das * season) / crop.season_days), season - SENSITIVE_DAYS));
    res = { ...res, season, sensitiveDas, stages: scaleStages(cal.stages, season) };
  }
  // Note: FAO AquaCrop heat units are used only to check that the summer is warm
  // enough (heat.js), not for season length. AquaCrop's default varieties are
  // long-season (sunflower 2,400 GDD ≈ 160 days vs ~120 days for Thrace hybrids),
  // which inflated water need and wrongly removed rain-fed sunflower in Edirne.
  const p = crop.phenology;
  const tmin = f?.monthly_tmin_c?.value;
  const tmax = f?.monthly_tmax_c?.value;
  if (p && tmin && tmax) {
    const gddOn = (d) => {
      const m = monthOfDoy(doyAfter(start, d));
      return Math.max(0, (tmin[m] + tmax[m]) / 2 - p.base_c);
    };
    let gdd = 0;
    let d = 0;
    while (gdd < p.sensitive_gdd && d < 330) gdd += gddOn(d++);
    const sensitiveDas = Math.max(d, (p.earliest_sensitive_doy - start + 365) % 365);
    let post = 0;
    let e = sensitiveDas;
    while (post < p.post_gdd && e < 360) post += gddOn(e++);
    const season = Math.max(e, sensitiveDas + MIN_GRAIN_FILL_DAYS);
    res = { ...res, start, season, sensitiveDas, stages: scaleStages(crop.stages_days, season), thermal: true };
  }
  byCrop?.set(crop.id, res);
  return res;
}

/** FAO-56 crop coefficient on day d after sowing (piecewise linear between stages). */
export function kcOnDay(crop, d, stages = crop.stages_days) {
  const [a, b, c, e] = stages;
  const { ini, mid, end } = crop.kc;
  if (d < a) return ini;
  if (d < a + b) return ini + ((mid - ini) * (d - a)) / b;
  if (d < a + b + c) return mid;
  return mid + ((end - mid) * (d - a - b - c)) / Math.max(1, e);
}

/** Dekads (0-35) covered by the crop's sensitive stage. */
export function sensitiveDekads(crop, f) {
  const ph = phenology(crop, f);
  if (ph.sensitiveDas == null) return [];
  const dekads = new Set();
  for (let d = ph.sensitiveDas; d < ph.sensitiveDas + SENSITIVE_DAYS; d++) dekads.add(dekadOfDoy(doyAfter(ph.start, d)));
  return [...dekads];
}

/** Calendar months (0-11) covered by the crop's sensitive stage. */
export function sensitiveMonths(crop, f) {
  const ph = phenology(crop, f);
  if (ph.sensitiveDas == null) return [];
  const months = new Set();
  for (let d = ph.sensitiveDas; d < ph.sensitiveDas + SENSITIVE_DAYS; d++) months.add(monthOfDoy(doyAfter(ph.start, d)));
  return [...months];
}

/** Iterate the crop's season day by day. */
export function* seasonDays(crop, f) {
  const ph = phenology(crop, f);
  const len = crop.season === "perennial" ? 365 : ph.season;
  for (let d = 0; d < len; d++) {
    const doy = doyAfter(ph.start, d);
    yield { d, doy, month: monthOfDoy(doy), kc: kcOnDay(crop, Math.min(d, ph.season - 1), ph.stages) };
  }
}

/**
 * Lay a rotation on a cyclic day timeline (365 x years).
 * sequence: crop ids per year ("fallow" allowed); secondCrops: { yearIndex: cropId }.
 */
export function rotationTimeline(sequence, secondCrops, cropsById, f) {
  const years = sequence.length;
  const total = 365 * years;
  const covered = new Uint8Array(total);
  const plantings = [];

  const place = (crop, year, startDoy, len) => {
    const offset = year * 365 + ((startDoy - JUL1 + 365) % 365);
    for (let d = 0; d < len; d++) covered[(offset + d) % total] = 1;
    plantings.push({ year, crop, startDoy, offset, end: offset + len });
    return offset + len;
  };

  sequence.forEach((id, year) => {
    if (id === "fallow") return;
    const crop = cropsById[id];
    const ph = phenology(crop, f);
    const end = place(crop, year, ph.start, crop.season === "perennial" ? 365 : ph.season);
    const second = secondCrops?.[year] ?? secondCrops?.[String(year)];
    if (second) {
      const sc = cropsById[second];
      const official = zoneCalendar(`${second}_second`, f); // e.g. TAGEM "mısır (dane, 2. ürün)"
      if (official) {
        place(sc, year, dekadStartDoy(official.sow_month, official.sow_dekad), official.season);
      } else {
        // Sown right after the main harvest (or at its own sowing date, whichever is later).
        const harvestDoy = ((JUL1 - 1 + (end % 365)) % 365) + 1;
        const own = sowingDoy(sc, f);
        const start = (own - harvestDoy + 365) % 365 < 60 ? own : harvestDoy + 7;
        place(sc, year, Math.min(365, start), phenology(sc, f).season);
      }
    }
  });
  return { years, total, covered, plantings };
}

/** Bare-soil statistics for a timeline, weighted by when the rain falls. */
export function bareStats(timeline, f) {
  const { total, covered, years } = timeline;
  const rain = f.monthly_rain_mm.value;
  const annual = rain.reduce((s, v) => s + (v ?? 0), 0);
  let bareDays = 0;
  let rainOnBare = 0;
  for (let t = 0; t < total; t++) {
    if (covered[t]) continue;
    bareDays++;
    const m = monthOfDoy(((JUL1 - 1 + t) % 365) + 1);
    rainOnBare += (rain[m] ?? 0) / MONTH_DAYS[m];
  }

  // Contiguous bare runs on the cyclic timeline.
  let longGaps = 0;
  let longest = 0;
  const startIdx = covered.indexOf(1);
  if (startIdx === -1) {
    longest = total;
    longGaps = years;
  } else {
    let run = 0;
    for (let k = 1; k <= total; k++) {
      const t = (startIdx + k) % total;
      if (!covered[t]) run++;
      else {
        if (run > 180) longGaps++;
        longest = Math.max(longest, run);
        run = 0;
      }
    }
  }

  return {
    bareMonthsPerYear: bareDays / 30.44 / years,
    rainOnBareShare: annual > 0 ? rainOnBare / (annual * years) : 0,
    longGaps,
    longestGapDays: longest,
  };
}

/**
 * Does a summer second crop fit between the main harvest and the first autumn
 * frost? Only checked for frost-sensitive (spring/summer) second crops; an
 * official TAGEM-DSİ second-crop calendar for the zone counts as fitting.
 * Returns null when not applicable.
 */
export function secondCropFit(mainId, secondId, cropsById, f) {
  const main = cropsById[mainId];
  const sc = cropsById[secondId];
  if (!main || !sc || main.season === "perennial" || sc.season === "winter" || sc.season === "perennial") return null;
  const frost = f.first_autumn_frost_doy?.value;
  if (frost == null) return null;
  if (zoneCalendar(`${secondId}_second`, f)) return { official: true, fits: true };
  const ph = phenology(main, f);
  const harvestDoy = ((ph.start - 1 + ph.season) % 365) + 1;
  // Same sowing rule as rotationTimeline: its own date if close after the harvest, else harvest + 7 days.
  const own = sowingDoy(sc, f);
  const start = (own - harvestDoy + 365) % 365 < 60 ? own : harvestDoy + 7;
  const need = phenology(sc, f).season;
  const window = frost - start;
  return { official: false, harvestDoy, start, need, window, frost, fits: window >= need };
}

/**
 * Crop calendar for a rotation, for display: every planting (main and second
 * crops) with sowing, flowering and harvest day of year and days in the field,
 * plus the bare gaps between them. Same placement as rotationTimeline, so it
 * matches the bare-soil and erosion scores. Offsets count days from 1 July of
 * rotation year 1 (the rotation year runs July to June).
 */
export function rotationCalendar(sequence, secondCrops, cropsById, f) {
  const tl = rotationTimeline(sequence, secondCrops, cropsById, f);
  const plantings = tl.plantings
    .map((p) => {
      const crop = p.crop;
      const len = p.end - p.offset;
      const ph = phenology(crop, f);
      const perennial = crop.season === "perennial";
      const flowerDas = ph.sensitiveDas == null || perennial ? null : Math.round((ph.sensitiveDas * len) / Math.max(1, ph.season));
      const second = Boolean(secondCrops?.[p.year] === crop.id || secondCrops?.[String(p.year)] === crop.id) && sequence[p.year] !== crop.id;
      return {
        id: crop.id,
        year: p.year,
        second,
        offset: p.offset,
        days: len,
        sowDoy: p.startDoy,
        flowerDoy: flowerDas == null ? null : doyAfter(p.startDoy, flowerDas),
        harvestDoy: perennial ? null : doyAfter(p.startDoy, len),
        perennial,
        calendar: second && zoneCalendar(`${crop.id}_second`, f) ? "TAGEM-DSİ 2017" : ph.calendar,
        thermal: ph.thermal,
      };
    })
    .sort((a, b) => a.offset - b.offset);

  // Bare runs of 20+ days on the cyclic timeline (where nothing grows).
  const gaps = [];
  const { total, covered } = tl;
  const first = covered.indexOf(1);
  if (first >= 0) {
    let run = 0;
    let runStart = 0;
    for (let k = 1; k <= total; k++) {
      const i = (first + k) % total;
      if (!covered[i]) {
        if (run === 0) runStart = i;
        run++;
      } else if (run) {
        if (run >= 20) gaps.push({ offset: runStart, days: run, fromDoy: ((JUL1 - 1 + runStart) % 365) + 1, toDoy: ((JUL1 - 1 + runStart + run - 1) % 365) + 1 });
        run = 0;
      }
    }
  }
  return { years: tl.years, total, plantings, gaps };
}
