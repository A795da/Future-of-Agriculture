// NASA POWER daily point API (AG community).
// Returns a "conditions" block: raw daily series plus source, kind and resolution
// labels, the same shape whether it comes from the live API or the cache.

const BASE = "https://power.larc.nasa.gov/api/temporal/daily/point";

export const POWER_PARAMS = {
  T2M: { label: "Mean temperature", unit: "°C", kind: "NASA reanalysis" },
  T2M_MAX: { label: "Max temperature", unit: "°C", kind: "NASA reanalysis" },
  T2M_MIN: { label: "Min temperature", unit: "°C", kind: "NASA reanalysis" },
  PRECTOTCORR: { label: "Precipitation", unit: "mm/day", kind: "NASA reanalysis" },
  RH2M: { label: "Relative humidity", unit: "%", kind: "NASA reanalysis" },
  ALLSKY_SFC_SW_DWN: { label: "Solar radiation", unit: "MJ/m²/day", kind: "NASA observation" },
  WS2M: { label: "Wind speed at 2 m", unit: "m/s", kind: "NASA reanalysis" },
  GWETTOP: { label: "Surface soil wetness", unit: "0-1", kind: "NASA model estimate" },
  GWETROOT: { label: "Root-zone soil wetness", unit: "0-1", kind: "NASA model estimate" },
};

const ymd = (d) => d.toISOString().slice(0, 10).replaceAll("-", "");

// In-memory cache for this session: same point and period, no second call.
const cache = new Map();

export async function fetchPowerDaily({ lat, lon, start, end, signal }) {
  const key = `${lat},${lon},${ymd(start)},${ymd(end)}`;
  if (cache.has(key)) return cache.get(key);
  const result = await fetchPowerDailyLive({ lat, lon, start, end, signal });
  cache.set(key, result);
  return result;
}

async function fetchPowerDailyLive({ lat, lon, start, end, signal }) {
  const url =
    `${BASE}?parameters=${Object.keys(POWER_PARAMS).join(",")}` +
    `&community=AG&longitude=${lon}&latitude=${lat}` +
    `&start=${ymd(start)}&end=${ymd(end)}&format=JSON`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`NASA POWER: HTTP ${res.status}`);
  const json = await res.json();
  const params = json?.properties?.parameter;
  if (!params) throw new Error("NASA POWER: unexpected response");

  const fill = json?.header?.fill_value ?? -999;
  const dates = Object.keys(params.T2M);
  const daily = { date: dates.map((k) => `${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6, 8)}`) };
  for (const p of Object.keys(POWER_PARAMS)) {
    daily[p] = dates.map((k) => {
      const v = params[p]?.[k];
      return v == null || v === fill ? null : v;
    });
  }

  // POWER lags real time by a few days; trailing fill values are dropped.
  let last = daily.date.length - 1;
  while (last >= 0 && daily.T2M[last] == null) last--;
  for (const k of Object.keys(daily)) daily[k] = daily[k].slice(0, last + 1);

  return {
    source: "NASA POWER",
    resolution: "about 0.5° × 0.625° grid (tens of km); nearby fields share values",
    period: { start: daily.date[0], end: daily.date.at(-1) },
    params: POWER_PARAMS,
    daily,
  };
}
