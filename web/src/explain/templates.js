// Template explanations built only from the reasons JSON. These are the
// fallback that always works; the AI layer will later swap in friendlier text
// behind the same function, and must not add facts or numbers.

export const DIMENSION_LABELS = {
  water: "Water fit",
  climate: "Climate fit",
  soil: "Soil health",
  erosion: "Erosion protection",
  pest: "Pest-cycle break",
  income: "Income (your ratings)",
  simplicity: "Simplicity",
};

// Lowercase the first letter, but keep acronyms and names that start with two capitals (TÜİK, NASA).
const lower = (s) => (/^\p{Lu}\p{Lu}/u.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

export function cardSummary(result, baseline) {
  const pos = result.reasons.filter((r) => r.effect === "positive");
  const neg = result.reasons.filter((r) => r.effect === "negative");
  const parts = [];

  if (result.is_baseline) parts.push(`Your current rotation scores ${result.score} out of 100.`);
  else if (baseline) {
    const d = result.score - baseline.score;
    parts.push(
      `This option scores ${result.score} out of 100, ${d === 0 ? "the same as" : `${Math.abs(d)} points ${d > 0 ? "above" : "below"}`} your current rotation.`
    );
  } else parts.push(`This option scores ${result.score} out of 100.`);

  if (pos.length) parts.push(`In its favour: ${lower(pos[0].evidence)}.`);
  if (neg.length) parts.push(`Watch out: ${lower(neg[0].evidence)}.`);
  if (result.what_if) parts.push("These numbers are a what-if scenario, not a forecast.");
  return parts.join(" ");
}

export const VERDICT_LABELS = {
  reasonable: { en: "Reasonable", tr: "Mantıklı" },
  possible_with_care: { en: "Possible with care", tr: "Dikkatle olabilir" },
  not_reasonable: { en: "Not reasonable", tr: "Mantıklı değil" },
};

/** Template explanation of a crop check, from the result JSON only (names passed in). */
export function checkSummary(result, nameOf) {
  const name = nameOf(result.crop);
  const crop = name.charAt(0).toUpperCase() + name.slice(1);
  const after = result.previous.length ? ` after ${nameOf(result.previous[0])}` : "";
  const blockers = result.reasons.filter((r) => r.level === "blocker");
  const cautions = result.reasons.filter((r) => r.level === "caution");
  const good = result.reasons.filter((r) => r.effect === "positive");
  const parts = [];
  if (result.verdict === "not_reasonable") {
    parts.push(`${crop}${after} is not a reasonable choice here: ${lower(blockers[0].evidence)}.`);
    if (blockers.length > 1) parts.push(`There ${blockers.length === 2 ? "is 1 more blocking reason" : `are ${blockers.length - 1} more blocking reasons`} below.`);
  } else if (result.verdict === "possible_with_care") {
    parts.push(`${crop}${after} is possible, but with care: ${lower(cautions[0].evidence)}.`);
    if (good.length) parts.push(`In its favour: ${lower(good[0].evidence)}.`);
  } else {
    parts.push(`${crop}${after} looks reasonable for this place.`);
    if (good.length) parts.push(`In its favour: ${lower(good[0].evidence)}.`);
  }
  return parts.join(" ");
}
