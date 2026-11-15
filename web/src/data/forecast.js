// Open-Meteo daily forecast (NOT NASA) for the Today tab.
// Same output whether live or from a saved snapshot; the snapshot is only a demo
// fallback and is labelled with the date it was saved.

const BASE = "https://api.open-meteo.com/v1/forecast";
export const FORECAST_DAYS = 7;
const DAILY = [
  "temperature_2m_max",
  "temperature_2m_min",
  "precipitation_sum",
  "precipitation_probability_max",
  "et0_fao_evapotranspiration",
];

export const forecastUrl = (lat, lon) =>
  `${BASE}?latitude=${lat}&longitude=${lon}&daily=${DAILY.join(",")}&timezone=Europe%2FIstanbul&forecast_days=${FORECAST_DAYS}`;

/** Open-Meteo JSON → { days: [{ date, tmax, tmin, rain, rain_prob, et0 }], source, kind, ... }. */
export function parseForecast(json, { snapshot = null } = {}) {
  const d = json?.daily;
  if (!d?.time?.length) throw new Error("Open-Meteo: no daily data");
  const days = d.time.map((date, i) => ({
    date,
    tmax: d.temperature_2m_max[i],
    tmin: d.temperature_2m_min[i],
    rain: d.precipitation_sum[i] ?? 0,
    rain_prob: d.precipitation_probability_max?.[i] ?? null,
    et0: d.et0_fao_evapotranspiration?.[i] ?? null,
  }));
  return {
    days,
    source: "Open-Meteo forecast",
    kind: "model estimate",
    note: "weather forecast, not NASA data",
    resolution: "about 2-11 km weather models",
    snapshot, // null when live; the save date when it comes from a saved file
  };
}

const cache = new Map();

export async function fetchForecast({ lat, lon, signal }) {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  if (cache.has(key)) return cache.get(key);
  const res = await fetch(forecastUrl(lat.toFixed(3), lon.toFixed(3)), { signal });
  if (!res.ok) throw new Error(`Open-Meteo: HTTP ${res.status}`);
  const out = parseForecast(await res.json());
  cache.set(key, out);
  return out;
}

/** Live forecast, or the saved demo snapshot for a province when the live call fails. */
export async function loadForecast({ lat, lon, provinceId, signal }) {
  try {
    return await fetchForecast({ lat, lon, signal });
  } catch (e) {
    if (e.name === "AbortError" || !provinceId) throw e;
    const res = await fetch(`/data/cache/${provinceId}/forecast_snapshot.json`, { signal });
    if (!res.ok) throw e;
    const saved = await res.json();
    return parseForecast(saved.response, { snapshot: saved.saved });
  }
}
