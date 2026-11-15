// What the AI is allowed to see: the computed result only, trimmed to the
// facts worth explaining. No coordinates, place names or farmer identity.
// Same function in the app and in scripts/build_explain_cache.mjs, so cached
// demo texts match the app's requests byte for byte.

export const KINDS = ["rotation", "check", "today"];
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
