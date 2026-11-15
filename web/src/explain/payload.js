// What the AI is allowed to see: the computed result only, trimmed to the
// facts worth explaining. No coordinates, place names or farmer identity.
// Same function in the app and in scripts/build_explain_cache.mjs, so cached
// demo texts match the app's requests byte for byte.

export const KINDS = ["rotation", "check", "today", "season"];
export const LANGS = ["en", "tr"];

const ev = (r) => ({ evidence: r.evidence, effect: r.effect, source: r.source, ...(r.level ? { level: r.level } : {}) });

/** Rotation card. `baseline` is the farmer's current rotation result (or null). */
export function rotationFacts(result, baseline, template) {
  return {
    rotation: result.label,
    is_current_rotation: result.is_baseline,
    score_out_of_100: result.score,
    current_rotation_score: baseline && !result.is_baseline ? baseline.score : null,
    dimension_scores: result.dimensions,
    evidence: result.reasons.map(ev),
    risks: result.risks.slice(0, 4),
    confidence: result.confidence,
    what_if_scenario: result.what_if,
    template_text: template,
  };
}

/** Crop check. `nameOf(id)` gives the plain crop name. */
export function checkFacts(result, nameOf, template) {
  return {
    crop: nameOf(result.crop),
    previous_seasons_last_first: result.previous.map(nameOf),
    verdict: result.verdict,
    evidence: result.reasons.map(ev),
    better_choices: result.alternatives.map(nameOf),
    risks: result.risks.slice(0, 4),
    confidence: result.confidence,
    template_text: template,
  };
}

/** Today tab (next 7 days). */
export function todayFacts(result, nameOf, template) {
  return {
    crop_in_field: nameOf(result.crop),
    stage: result.stage.label,
    status: result.status,
    days: result.days.map((d) => ({ date: d.date, low_c: d.tmin, high_c: d.tmax, rain_mm: d.rain, status: d.status })),
    alerts: result.alerts.map((a) => ({ type: a.type, level: a.level, evidence: a.evidence, action: a.action, source: a.source })),
    template_text: template,
  };
}

/** Overview water-balance chart: 20-year monthly means of ET0 (water the air pulls)
 * and rain, rounded to whole mm so the same chart always gives the same cache key.
 * Month names stay English: the facts (and the cache key) do not depend on the language. */
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** Longest run of months where the air pulls more than rain gives (wrapping Dec→Jan). */
function dryStretch(gap) {
  const dry = gap.map((g) => g > 0);
  if (dry.every(Boolean)) return { dry_all_year: true };
  if (!dry.some(Boolean)) return { dry_all_year: false, dry_stretch_from: null, dry_stretch_to: null };
  let best = { start: 0, len: 0 };
  for (let s = 0; s < 12; s++) {
    if (!dry[s] || dry[(s + 11) % 12]) continue; // a run starts after a wet month
    let len = 0;
    while (len < 12 && dry[(s + len) % 12]) len++;
    if (len > best.len) best = { start: s, len };
  }
  return { dry_all_year: false, dry_stretch_from: MONTHS[best.start], dry_stretch_to: MONTHS[(best.start + best.len - 1) % 12] };
}

/** What the dry stretch means for this farmer: rule-based takeaways from the crop
 * calendars (when each crop is in the field and flowers) and the water supply.
 * The AI only words these; it adds no advice of its own.
 * farm = { water: "rainfed" | "irrigated", crops: [{ name, field_months, flowering_months }] }
 * with months as 0-11 in calendar order through the season. */
function farmTakeaways(farm, dryMonths, from, to) {
  if (!farm) return {};
  const dry = new Set(dryMonths);
  const M = (i) => MONTHS[i];
  const rainfed = farm.water !== "irrigated";
  const crops = (farm.crops ?? []).slice(0, 3).map((c) => {
    const inDry = c.field_months.filter((m) => dry.has(m));
    const flowerDry = c.flowering_months.filter((m) => dry.has(m));
    let takeaway;
    if (flowerDry.length) {
      takeaway = rainfed
        ? `${c.name} flowers in ${M(flowerDry[0])}, inside the dry stretch: in a dry year this is when its yield is most at risk.`
        : `${c.name} flowers in ${M(flowerDry[0])}, inside the dry stretch: that is the time it must not run short of water.`;
    } else if (!inDry.length) {
      takeaway = `${c.name} grows in the months when rain covers the demand, so it lives mostly on rain.`;
    } else if (inDry.length * 2 <= c.field_months.length) {
      takeaway = `${c.name} grows mostly in the wetter months; only the end of its season reaches the dry stretch.`;
    } else {
      takeaway = rainfed
        ? `${c.name} grows mostly inside the dry stretch, so on a rain-fed field it depends on water stored in the soil.`
        : `${c.name} grows mostly inside the dry stretch, so most of its irrigation falls in these months.`;
    }
    return {
      crop: c.name,
      in_field_from: M(c.field_months[0]),
      in_field_to: M(c.field_months.at(-1)),
      flowering: c.flowering_months.map(M),
      takeaway,
    };
  });
  const general =
    from && rainfed
      ? `From ${from} to ${to} rain does not keep up with what the air pulls, so a rain-fed field lives on water stored in the soil during the wet months.`
      : from
        ? `From ${from} to ${to} rain does not keep up with what the air pulls, so this is when irrigation water matters most.`
        : null;
  return { water_supply: rainfed ? "rain-fed" : "irrigated", your_crops: crops, general_takeaway: general };
}

export function seasonFacts(et0, rain, template, farm = null) {
  const r = (v) => Math.round(v);
  const months = MONTHS.map((m, i) => ({ month: m, water_air_pulls_mm: r(et0[i]), rain_mm: r(rain[i]) }));
  const gap = months.map((m) => m.water_air_pulls_mm - m.rain_mm);
  const peak = gap.indexOf(Math.max(...gap));
  const stretch = dryStretch(gap);
  const dryMonths = gap.map((g, i) => (g > 0 ? i : -1)).filter((i) => i >= 0);
  return {
    style: "chart-then-so-this-means", // part of the cache key: a new wording style is a new text
    years: "2005-2024",
    months,
    biggest_gap_month: MONTHS[peak],
    ...stretch,
    ...farmTakeaways(farm, dryMonths, stretch.dry_stretch_from, stretch.dry_stretch_to),
    months_rain_covers_demand: months.filter((m) => m.rain_mm >= m.water_air_pulls_mm).map((m) => m.month),
    yearly_water_air_pulls_mm: months.reduce((a, m) => a + m.water_air_pulls_mm, 0),
    yearly_rain_mm: months.reduce((a, m) => a + m.rain_mm, 0),
    template_text: template,
  };
}

/** Stable JSON (sorted keys) so the same facts always give the same cache key. */
export function stableJson(v) {
  if (Array.isArray(v)) return `[${v.map(stableJson).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableJson(v[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

/** FNV-1a 32-bit hash, hex: cache key that works the same in Node and the browser. */
export function cacheKey(kind, lang, facts) {
  const s = `${kind}|${lang}|${stableJson(facts)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
