// Plain words for irrigation amounts: mm, the same amount per dekar and per
// hectare (1 mm of water = 1 m³ per dekar = 10 m³ per hectare), and the months
// that need most of it. Shared by the crop check and the rotation cards.

import { MONTH_NAMES } from "../features/stats.js";
import { monthlyIrrigation } from "./agronomy.js";

const round = (x) => Math.round(x);

/** "488 mm (488 m³ per dekar, 4,880 m³ per hectare)" */
export function amountText(mm) {
  const r = round(mm);
  return `${r} mm (${r.toLocaleString("en-US")} m³ per dekar, ${(r * 10).toLocaleString("en-US")} m³ per hectare)`;
}

/** The fewest months (at most 3) holding at least 60% of the total, in season order. */
export function peakMonths(months, total) {
  if (!months.length || !(total > 0)) return [];
  const byNeed = [...months].sort((a, b) => b.mm - a.mm);
  const out = [];
  let sum = 0;
  for (const m of byNeed) {
    if (out.length === 3 || sum >= 0.6 * total) break;
    out.push(m);
    sum += m.mm;
  }
  return months.filter((m) => out.includes(m));
}

/** Peak months as plain data: [{ month: 0-11, mm }]. */
export function peaksOf(crop, f, total, opts) {
  return peakMonths(monthlyIrrigation(crop, f, total, opts), total).map((m) => ({ month: m.month, mm: round(m.mm) }));
}

/** "most of it in Jul (~160 mm) and Aug (~150 mm)", or "" when nothing stands out. */
export function peakText(crop, f, total, opts) {
  return peaksWords(peaksOf(crop, f, total, opts));
}

export function peaksWords(peaks) {
  if (!peaks?.length) return "";
  const parts = peaks.map((m) => `${MONTH_NAMES[m.month]} (~${m.mm} mm)`);
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
  return `most of it in ${list}`;
}

/** Share of the crop's use that rain and stored soil water cover, 0-100. */
export const coveredPct = (w) => (w.need > 0 ? Math.min(100, round((w.supply / w.need) * 100)) : 100);

export const METHOD_NOTE = "field amounts depend on the irrigation method: drip loses less water than furrow or sprinkler";

/**
 * Numbers behind a water line, kept on the reason as `water` so the app can word it
 * in Turkish too (not sent to the AI). mode: "irrigate" (irrigated field),
 * "would_irrigate" (rain-fed field, crop needs irrigation), "dry_short" (rain-fed
 * crop short of water in a dry year).
 */
export function waterData(mode, crop, f, { need, mm, covered, dry = false, peaks = true }) {
  return {
    mode,
    crop_tr: crop ? crop.name_tr.split(" (")[0] : null,
    need: round(need),
    mm: round(mm),
    covered,
    peaks: peaks ? peaksOf(crop, f, mm, { dry }) : [],
  };
}
