// Recent climate shift: the last RECENT_YEARS years against the earlier years of the
// same NASA POWER daily record, one value per year for each measure. A shift counts
// as "clear" when it is at least twice the uncertainty expected from ordinary
// year-to-year variation (z >= 2), "possible" from z >= 1, otherwise "none".
// Used by scripts/build_climate_shift.mjs (Node) and its tests; the app reads the result.

export const RECENT_YEARS = 5;
export const Z_CLEAR = 2;
export const Z_POSSIBLE = 1;

const sum = (a) => a.reduce((s, x) => s + (x ?? 0), 0);
const mean = (a) => (a.length ? sum(a) / a.length : null);
const month = (iso) => +iso.slice(5, 7);
const dayOfYear = (iso) => Math.round((Date.parse(iso) - Date.parse(`${iso.slice(0, 4)}-01-01`)) / 864e5) + 1;

/** Per-year values of each measure from POWER daily data ({date[], T2M[], ...}). */
export function yearlyMeasures(daily) {
  const by = {};
  daily.date.forEach((iso, i) => {
    const y = iso.slice(0, 4);
    const m = month(iso);
    const d = (by[y] ??= { t: [], hot: 0, frost: 0, heavy: 0, rain: 0, lastFrost: 0, wet: [], run: 0, dry: 0 });
    const tmax = daily.T2M_MAX[i];
    const tmin = daily.T2M_MIN[i];
    const rain = daily.PRECTOTCORR[i] ?? 0;
    if (daily.T2M[i] != null) d.t.push(daily.T2M[i]);
    if (tmax != null && tmax >= 35) d.hot++;
    if (tmin != null && tmin < 0) {
      d.frost++;
      if (m <= 6) d.lastFrost = Math.max(d.lastFrost, dayOfYear(iso));
    }
    if (rain >= 20) d.heavy++;
    d.rain += rain;
    if ((m === 4 || m === 5) && daily.GWETROOT?.[i] != null) d.wet.push(daily.GWETROOT[i]);
    if (m >= 3 && m <= 6) {
      d.run = rain < 1 ? d.run + 1 : 0;
      d.dry = Math.max(d.dry, d.run);
    }
  });
  // only complete years
  const years = Object.keys(by).sort().filter((y) => daily.date.filter((x) => x.startsWith(y)).length >= 360);
  const pick = (f) => years.map((y) => f(by[y]));
  return {
    years: years.map(Number),
    rain_mm: pick((d) => d.rain),
    temp_c: pick((d) => mean(d.t)),
    hot_days: pick((d) => d.hot),
    frost_nights: pick((d) => d.frost),
    heavy_rain_days: pick((d) => d.heavy),
    last_spring_frost_doy: pick((d) => d.lastFrost || null),
    dry_spell_days: pick((d) => d.dry),
    spring_soil_wetness: pick((d) => mean(d.wet)),
  };
}

/** Recent vs earlier mean, difference and z-score against year-to-year spread. */
export function shiftOf(values, recentYears = RECENT_YEARS) {
  const v = values.filter((x) => x != null && Number.isFinite(x));
  if (v.length < recentYears + 5) return null;
  const recent = v.slice(-recentYears);
  const early = v.slice(0, -recentYears);
  const m = mean(v);
  const sd = Math.sqrt(sum(v.map((x) => (x - m) ** 2)) / (v.length - 1));
  const diff = mean(recent) - mean(early);
  const se = sd * Math.sqrt(1 / recent.length + 1 / early.length);
  const z = se > 0 ? diff / se : 0;
  const level = Math.abs(z) >= Z_CLEAR ? "clear" : Math.abs(z) >= Z_POSSIBLE ? "possible" : "none";
  return { early: mean(early), recent: mean(recent), diff, z, level };
}

export const MEASURES = [
  { key: "temp_c", unit: "°C", digits: 1 },
  { key: "hot_days", unit: "days", digits: 1 },
  { key: "rain_mm", unit: "mm", digits: 0, pct: true },
  { key: "heavy_rain_days", unit: "days", digits: 1 },
  { key: "dry_spell_days", unit: "days", digits: 0 },
  { key: "frost_nights", unit: "nights", digits: 0 },
  { key: "last_spring_frost_doy", unit: "day of year", digits: 0 },
  { key: "spring_soil_wetness", unit: "0-1", digits: 2 },
];

/** All measures for one province, rounded for the app. */
export function climateShift(daily) {
  const y = yearlyMeasures(daily);
  const r = (x, d) => Math.round(x * 10 ** d) / 10 ** d;
  const out = {};
  for (const m of MEASURES) {
    const s = shiftOf(y[m.key]);
    if (!s) continue;
    out[m.key] = {
      early: r(s.early, m.digits),
      recent: r(s.recent, m.digits),
      diff: r(s.diff, Math.max(m.digits, 1)),
      ...(m.pct ? { pct: Math.round((s.diff / s.early) * 100) } : {}),
      z: r(s.z, 1),
      level: s.level,
    };
  }
  return { years: [y.years[0], y.years.at(-1)], recent_from: y.years.at(-RECENT_YEARS), measures: out };
}

/** What-if values from a province's measured shift (sliders: rain -30..+20 %, temperature 0..+3 °C). */
export function shiftScenario(shift) {
  const t = shift?.measures?.temp_c?.diff ?? 0;
  const r = shift?.measures?.rain_mm?.pct ?? 0;
  return { tempC: Math.min(3, Math.max(0, Math.round(t * 10) / 10)), rainPct: Math.min(20, Math.max(-30, r)) };
}
