// What-if scenarios: shift features before scoring. Results are labeled
// "what-if", never as a forecast. Rules of thumb used:
//  - rain scales every rainfall feature by (1 + rainPct/100)
//  - temperature adds tempC to every temperature feature
//  - Hargreaves ET0 is proportional to (Tmean + 17.8), so it scales with that factor
//  - each +1 °C moves the last spring frost ~5 days earlier and the first autumn frost ~5 days later

const FROST_DAYS_PER_DEGREE = 5;

export function applyScenario(features, { rainPct = 0, tempC = 0 } = {}) {
  if (!rainPct && !tempC) return features;
  const f = structuredClone(features);
  const k = 1 + rainPct / 100;
  const scaleRain = (name) => {
    if (!f[name]) return;
    const v = f[name].value;
    f[name].value = Array.isArray(v) ? v.map((x) => (x == null ? x : Math.round(x * k))) : Math.round(v * k);
  };
  ["monthly_rain_mm", "monthly_rain_dry_mm", "annual_rain_mm", "annual_rain_dry_mm"].forEach(scaleRain);
  if (f.heavy_rain_days_per_year) f.heavy_rain_days_per_year.value = +(f.heavy_rain_days_per_year.value * k).toFixed(1);

  if (tempC) {
    const tmin = f.monthly_tmin_c.value;
    const tmax = f.monthly_tmax_c.value;
    f.monthly_et0_mm.value = f.monthly_et0_mm.value.map((e, m) => {
      const tmean = (tmin[m] + tmax[m]) / 2;
      return Math.round((e * (tmean + 17.8 + tempC)) / Math.max(1, tmean + 17.8));
    });
    const shift = (a) => a.map((x) => (x == null ? x : +(x + tempC).toFixed(1)));
    f.monthly_tmin_c.value = shift(tmin);
    f.monthly_tmax_c.value = shift(tmax);
    f.yearly_min_temp_c.value = +(f.yearly_min_temp_c.value + tempC).toFixed(1);
    f.dekad_extremes_by_year.value = f.dekad_extremes_by_year.value.map((y) => ({
      ...y,
      tmin_abs: shift(y.tmin_abs),
      tmax_abs: shift(y.tmax_abs),
    }));
    const dd = Math.round(FROST_DAYS_PER_DEGREE * tempC);
    f.last_spring_frost_doy.value = Math.max(0, f.last_spring_frost_doy.value - dd);
    f.first_autumn_frost_doy.value = Math.min(366, f.first_autumn_frost_doy.value + dd);
    f.frost_free_days.value = f.first_autumn_frost_doy.value - f.last_spring_frost_doy.value;
  }

  for (const v of Object.values(f)) v.what_if = true;
  return f;
}
