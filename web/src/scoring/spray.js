// Spray hours: daylight hours when wind and rain are fit for spraying.
// No doses or products; only the weather window. The product label always wins.

/** Wind limits for spraying, km/h at 10 m. Source: Agriculture Victoria, "Managing spray drift". */
export const SPRAY_WIND_MIN_KMH = 3; // below this, still air: drift can hang and travel (inversion risk)
export const SPRAY_WIND_MAX_KMH = 15;
/** Our own cautious choice: no rain forecast this hour or the next few, so the spray can dry. */
export const SPRAY_DRY_HOURS = 3;
export const SPRAY_RAIN_MM = 0.1; // an hour with this much or more counts as rain
export const SPRAY_RAIN_PROB = 40; // %, or this chance of rain or higher

const wet = (h) => h.rain >= SPRAY_RAIN_MM || (h.rain_prob != null && h.rain_prob >= SPRAY_RAIN_PROB);

/**
 * Why one hour is or is not fit for spraying.
 * @param {object[]} hours flat hourly list (forecast.js parseHourly), in time order
 * @param {number} i index of the hour to judge
 * @returns {"ok"|"night"|"calm"|"windy"|"rain"|"unknown"}
 */
export function sprayHour(hours, i) {
  const h = hours[i];
  if (h.is_day === false) return "night";
  if (h.wind == null) return "unknown";
  for (let k = 0; k <= SPRAY_DRY_HOURS; k++) {
    const n = hours[i + k];
    if (!n) return "unknown"; // end of the forecast: cannot see the rain after it
    if (wet(n)) return "rain";
  }
  if (h.wind > SPRAY_WIND_MAX_KMH) return "windy";
  if (h.wind < SPRAY_WIND_MIN_KMH) return "calm";
  return "ok";
}

/**
 * Spray windows for one day: runs of consecutive "ok" hours.
 * @param {object[]} all flat hourly list for the whole forecast (look-ahead crosses midnight)
 * @param {string} date "YYYY-MM-DD"
 * @returns {{ windows: {from: number, to: number}[], reason: string|null, verdicts: Record<number,string> }}
 *   `to` is the hour the window ends (exclusive), `reason` is the most common blocker when there is no window.
 */
export function sprayDay(all, date) {
  const verdicts = {};
  const windows = [];
  let open = null;
  all.forEach((h, i) => {
    if (h.date !== date) return;
    const v = sprayHour(all, i);
    verdicts[h.hour] = v;
    if (v === "ok") {
      if (open && open.to === h.hour) open.to = h.hour + 1;
      else windows.push((open = { from: h.hour, to: h.hour + 1 }));
    } else open = null;
  });
  let reason = null;
  if (!windows.length) {
    const tally = {};
    Object.values(verdicts).forEach((v) => v !== "night" && (tally[v] = (tally[v] ?? 0) + 1));
    reason = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "night";
  }
  return { windows, reason, verdicts };
}
