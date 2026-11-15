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
  "weather_code",
];
// Hourly values for the day strip and spray hours. Wind is in km/h (Open-Meteo default).
const HOURLY = [
  "temperature_2m",
  "precipitation",
  "precipitation_probability",
  "weather_code",
  "wind_speed_10m",
  "wind_gusts_10m",
  "is_day",
];

/**
 * Sky for one day, from the WMO weather code Open-Meteo gives (most severe
 * weather of the day). Old saved snapshots have no code, so fall back to rain.
 * Keys: clear, partly, cloudy, fog, drizzle, rain, showers, snow, storm.
 */
export function skyOf(code, rain = 0, rainProb = null) {
  if (code == null) {
    if (rain >= 5) return "rain";
    if (rain >= 0.5) return "drizzle";
    return rainProb != null && rainProb >= 50 ? "cloudy" : null;
  }
  if (code <= 1) return "clear";
  if (code === 2) return "partly";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code >= 61 && code <= 67) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 80 && code <= 82) return "showers";
  if (code >= 95) return "storm";
  return null;
}

export const forecastUrl = (lat, lon) =>
  `${BASE}?latitude=${lat}&longitude=${lon}&daily=${DAILY.join(",")}&hourly=${HOURLY.join(",")}&timezone=Europe%2FIstanbul&forecast_days=${FORECAST_DAYS}`;

/**
 * Open-Meteo hourly block → flat list of hours (local time, Europe/Istanbul), or
 * null when there is none (saved snapshots only have daily values).
 */
export function parseHourly(h) {
  if (!h?.time?.length || !h.temperature_2m) return null;
  return h.time.map((t, i) => {
    const rain = h.precipitation?.[i] ?? 0;
    const prob = h.precipitation_probability?.[i] ?? null;
    const code = h.weather_code?.[i] ?? null;
    return {
      time: t, // "2026-11-15T14:00"
      date: t.slice(0, 10),
      hour: Number(t.slice(11, 13)),
      temp: h.temperature_2m[i],
      rain,
      rain_prob: prob,
      code,
      sky: skyOf(code, rain, prob),
      wind: h.wind_speed_10m?.[i] ?? null,
      gust: h.wind_gusts_10m?.[i] ?? null,
      is_day: h.is_day ? h.is_day[i] === 1 : null,
    };
  });
}

/** Open-Meteo JSON → { days: [{ date, tmax, tmin, rain, rain_prob, et0, code, sky, hours }], source, kind, ... }. */
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
    code: d.weather_code?.[i] ?? null,
  }));
  days.forEach((x) => (x.sky = skyOf(x.code, x.rain, x.rain_prob)));
  const hours = parseHourly(json?.hourly);
  days.forEach((x) => (x.hours = hours ? hours.filter((h) => h.date === x.date) : null));
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
