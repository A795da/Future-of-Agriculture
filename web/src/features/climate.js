// Climate features from a NASA POWER daily conditions block (several years).
// Output follows features/contract.js: each feature is
// { value, unit, source, kind, period }.

import { MONTH_START, dekadOfDoy, mean, median, quantile, round } from "./stats.js";

const SOURCE = "NASA POWER";
const REANALYSIS = "NASA reanalysis";
const MODEL = "NASA model estimate";
const SPRING_END_DOY = 196; // ~15 July: frosts before this are "spring", after are "autumn"
const HEAVY_RAIN_MM = 20;

/** Extraterrestrial radiation Ra (MJ/m²/day), FAO-56 eq. 21. */
export function extraterrestrialRadiation(doy, latDeg) {
  const phi = (latDeg * Math.PI) / 180;
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * doy) / 365);
  const delta = 0.409 * Math.sin((2 * Math.PI * doy) / 365 - 1.39);
  const ws = Math.acos(Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(delta))));
  return (
    ((24 * 60) / Math.PI) *
    0.082 *
    dr *
    (ws * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(ws))
  );
}

/** Reference evapotranspiration (mm/day), Hargreaves (FAO-56 eq. 52). Needs only temperature. */
export function et0Hargreaves(tmin, tmax, tmean, doy, latDeg) {
  const ra = extraterrestrialRadiation(doy, latDeg) * 0.408; // MJ -> mm water equivalent
  return Math.max(0, 0.0023 * (tmean + 17.8) * Math.sqrt(Math.max(0, tmax - tmin)) * ra);
}

const emptyMonth = () => ({
  days: 0, rain: 0, tminSum: 0, tmaxSum: 0, tminAbs: Infinity, tmaxAbs: -Infinity,
  frost: 0, et0: 0, wetSum: 0, wetN: 0, heavy: 0,
});

export function computeClimateFeatures(conditions, latDeg) {
  const d = conditions.daily;
  const years = new Map();

  for (let i = 0; i < d.date.length; i++) {
    const tmin = d.T2M_MIN[i];
    const tmax = d.T2M_MAX[i];
    const tmean = d.T2M[i];
    const rain = d.PRECTOTCORR[i];
    if (![tmin, tmax, tmean, rain].every(Number.isFinite)) continue;

    const y = +d.date[i].slice(0, 4);
    const m = +d.date[i].slice(5, 7) - 1;
    const doy = Math.min(365, MONTH_START[m] + +d.date[i].slice(8, 10));
    if (!years.has(y)) {
      years.set(y, {
        days: 0,
        months: Array.from({ length: 12 }, emptyMonth),
        dekMin: new Array(36).fill(Infinity),
        dekMax: new Array(36).fill(-Infinity),
        lastSpringFrost: 0,
        firstAutumnFrost: 366,
        min: Infinity,
        heavy: 0,
      });
    }
    const Y = years.get(y);
    const M = Y.months[m];
    const k = dekadOfDoy(doy);
    Y.dekMin[k] = Math.min(Y.dekMin[k], tmin);
    Y.dekMax[k] = Math.max(Y.dekMax[k], tmax);
    Y.days++;
    M.days++;
    M.rain += rain;
    M.tminSum += tmin;
    M.tmaxSum += tmax;
    M.tminAbs = Math.min(M.tminAbs, tmin);
    M.tmaxAbs = Math.max(M.tmaxAbs, tmax);
    M.et0 += et0Hargreaves(tmin, tmax, tmean, doy, latDeg);
    if (Number.isFinite(d.GWETROOT?.[i])) {
      M.wetSum += d.GWETROOT[i];
      M.wetN++;
    }
    if (rain > HEAVY_RAIN_MM) {
      M.heavy++;
      Y.heavy++;
    }
    if (tmin < 0) {
      M.frost++;
      if (doy <= SPRING_END_DOY) Y.lastSpringFrost = Math.max(Y.lastSpringFrost, doy);
      else Y.firstAutumnFrost = Math.min(Y.firstAutumnFrost, doy);
    }
    Y.min = Math.min(Y.min, tmin);
  }

  const complete = [...years.entries()].filter(([, Y]) => Y.days >= 360).sort((a, b) => a[0] - b[0]);
  if (complete.length < 5) throw new Error(`need at least 5 complete years of NASA POWER data, got ${complete.length}`);
  const period = `${complete[0][0]}-${complete.at(-1)[0]} (${complete.length} years)`;
  const F = (value, unit, kind = REANALYSIS) => ({ value, unit, source: SOURCE, kind, period });

  const byMonth = (fn) =>
    Array.from({ length: 12 }, (_, m) =>
      complete.map(([, Y]) => Y.months[m]).filter((M) => M.days >= 25).map(fn)
    );
  const med = (fn, d = 1) => byMonth(fn).map((v) => round(median(v), d));

  const rainByMonth = byMonth((M) => M.rain);
  const annualRain = complete.map(([, Y]) => Y.months.reduce((s, M) => s + M.rain, 0));

  return {
    monthly_tmin_c: F(med((M) => M.tminSum / M.days), "°C"),
    monthly_tmax_c: F(med((M) => M.tmaxSum / M.days), "°C"),
    monthly_rain_mm: F(rainByMonth.map((v) => round(median(v), 0)), "mm"),
    monthly_rain_dry_mm: F(rainByMonth.map((v) => round(quantile(v, 0.25), 0)), "mm"),
    monthly_et0_mm: F(med((M) => M.et0, 0), "mm"),
    frost_days_by_month: F(byMonth((M) => M.frost).map((v) => round(mean(v), 1)), "days"),
    root_zone_wetness_by_month: F(med((M) => (M.wetN ? M.wetSum / M.wetN : null), 2), "0-1", MODEL),
    annual_rain_mm: F(round(median(annualRain), 0), "mm"),
    annual_rain_dry_mm: F(round(quantile(annualRain, 0.25), 0), "mm"),
    last_spring_frost_doy: F(round(median(complete.map(([, Y]) => Y.lastSpringFrost)), 0), "day of year"),
    first_autumn_frost_doy: F(round(median(complete.map(([, Y]) => Y.firstAutumnFrost)), 0), "day of year"),
    frost_free_days: F(round(median(complete.map(([, Y]) => Y.firstAutumnFrost - Y.lastSpringFrost)), 0), "days"),
    yearly_min_temp_c: F(round(median(complete.map(([, Y]) => Y.min)), 1), "°C"),
    heavy_rain_days_per_year: F(round(mean(complete.map(([, Y]) => Y.heavy)), 1), "days"),
    dekad_extremes_by_year: F(
      complete.map(([year, Y]) => ({
        year,
        tmin_abs: Y.dekMin.map((v) => (Number.isFinite(v) ? round(v, 1) : null)),
        tmax_abs: Y.dekMax.map((v) => (Number.isFinite(v) ? round(v, 1) : null)),
      })),
      "°C"
    ),
  };
}
