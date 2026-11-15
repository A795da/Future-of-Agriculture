// Crop check ("Bu ürün mantıklı mı?" / "Would this crop work here?").
// The farmer names one crop and the seasons before it; code decides the verdict
// from the same modules as the Plan tab (hard filters, water balance, frost/heat
// history, sourced rotation rules, calendars, nutrient table). AI may later
// reword the explanation; it never picks the verdict.
//
// Verdict: any blocker → not_reasonable; any caution → possible_with_care;
// otherwise reasonable.

import { round } from "../features/stats.js";
import { climateHistory, dryYearCoverage, irrigationNeed } from "./agronomy.js";
import { phenology, sowingDoy, zoneCalendar } from "./calendar.js";
import { checkCrop } from "./filter.js";
import { heatUnits } from "./heat.js";
import { shortName } from "./names.js";
import { shortSource } from "./rules.js";
import { CONFIDENCE, EFFECTS, KINDS, REASON_TYPES } from "./contract.js";

// ---- FROZEN OUTPUT (like the rotation contract; change only by agreement)
export const VERDICTS = ["reasonable", "possible_with_care", "not_reasonable"];
export const CHECK_REASON_TYPES = [...REASON_TYPES, "timing", "farmer"];
export const LEVELS = ["blocker", "caution", "info"];

/**
 * @typedef {Object} CheckReason
 * @property {string} type      one of CHECK_REASON_TYPES
 * @property {string} evidence  plain-language fact, numbers included
 * @property {string} source    e.g. "NASA POWER", "NDSU Extension", "crop table"
 * @property {string} kind      one of KINDS (contract.js)
 * @property {string} effect    positive | negative | neutral
 * @property {string} level     blocker | caution | info (what it does to the verdict)
 *
 * @typedef {Object} CropCheckResult
 * @property {string}   crop          crop id
 * @property {string[]} previous      crop ids, last season first ("fallow" allowed)
 * @property {string}   verdict       one of VERDICTS
 * @property {CheckReason[]} reasons
 * @property {string[]} alternatives  up to 3 crop ids that fit better after the previous crop
 * @property {string[]} risks
 * @property {string[]} gaps
 * @property {string}   confidence    one of CONFIDENCE
 */

// ---- thresholds (named so an agronomist can tune them)
export const CLIMATE_CAUTION_SHARE = 0.25; // > 25% of years with damage at the sensitive stage
export const WATER_CAUTION_COVERAGE = 0.6; // rain-fed dry-year coverage below 60%
export const WATER_GOOD_COVERAGE = 0.8;
export const IRRIGATION_CAUTION_MM = 400; // irrigated: more than this to add in a normal year
export const TIMING_TIGHT_DAYS = 15; // harvest-to-sowing gap below this is tight
export const HEAVY_N_KG_HA = 60; // harvest removes more than this much N per hectare

const JUL1 = 182; // rotation year runs 1 July → 30 June (calendar.js)
const VERDICT_RANK = { reasonable: 0, possible_with_care: 1, not_reasonable: 2 };

const nameOf = (id, cropsById) => (id === "fallow" ? "fallow" : shortName(cropsById[id]));
const seasonsAgo = (k) => (k === 0 ? "last season" : `${k + 1} seasons ago`);
const matches = (key, id, cropsById) => key === id || (id !== "fallow" && cropsById[id]?.family === key);
const POWER = { source: "NASA POWER", kind: "NASA reanalysis" };

/** Offset (days from 1 July of the crop's rotation year) of sowing and harvest. */
function cropWindow(crop, f) {
  const ph = phenology(crop, f);
  const start = (ph.start - JUL1 + 365) % 365;
  return { start, end: start + (crop.season === "perennial" ? 365 : ph.season) };
}

function evaluate(crop, previous, ctx) {
  const { f, cropsById, farmer, ruleTable, nutrientTable } = ctx;
  const reasons = [];
  const risks = [];
  const gaps = [];
  const add = (r) => reasons.push(r);
  const name = shortName(crop);
  const last = previous[0];
  const lastCrop = last && last !== "fallow" ? cropsById[last] : null;

  // 1. Site suitability: the Plan tab's hard filters for this field.
  const site = checkCrop(crop, f, farmer);
  for (const d of site.details) add({ ...d, effect: "negative", level: "blocker" });

  // 2. Climate history at the sensitive stage, plus heat units for warm-season crops.
  const hist = climateHistory(crop, f);
  if (hist.n) {
    const parts = [];
    if (hist.frostYears) parts.push(`frost at flowering in ${hist.frostYears}`);
    if (hist.heatYears) parts.push(`heat at flowering in ${hist.heatYears}`);
    if (hist.winterYears) parts.push(`a too-cold winter in ${hist.winterYears}`);
    const share = hist.badYears / hist.n;
    const care = share > CLIMATE_CAUTION_SHARE;
    add({
      type: "climate",
      evidence: parts.length
        ? `${name}: ${parts.join(", ")} of the last ${hist.n} years`
        : `no damaging frost or heat at ${name}'s sensitive stage in the last ${hist.n} years`,
      ...POWER,
      effect: hist.badYears === 0 ? "positive" : care ? "negative" : "neutral",
      level: care ? "caution" : "info",
    });
    if (hist.badYears >= 3) risks.push(`${name}: ${parts.join(", ")} of the last ${hist.n} years`);
  }
  const heat = heatUnits(crop, f, sowingDoy(crop, f));
  if (heat && heat.ratio < 1 && site.ok) {
    const pct = round(heat.ratio * 100);
    add({
      type: "climate",
      evidence: `the summer gives about ${heat.available} heat units above ${heat.base} °C, ${pct}% of what a typical ${name} variety needs (${heat.required})`,
      source: "NASA POWER + FAO AquaCrop",
      kind: "NASA reanalysis",
      effect: "negative",
      level: "caution",
    });
    risks.push(`${name} may only mature in warm years or with a short-season variety`);
  }

  // 3. Water.
  const afterFallow = last === "fallow";
  if (farmer.irrigation === "irrigated") {
    const w = irrigationNeed(crop, f, afterFallow);
    const care = w.deficit > IRRIGATION_CAUTION_MM;
    add({
      type: "water",
      evidence:
        w.deficit < 20
          ? `in a normal year rain and stored soil water cover ${name}'s water need (~${round(w.need)} mm); little or no irrigation`
          : `${name} needs about ${round(w.deficit)} mm of irrigation in a normal year (crop uses ~${round(w.need)} mm)`,
      ...POWER,
      effect: w.deficit < 150 ? "positive" : care ? "negative" : "neutral",
      level: care ? "caution" : "info",
    });
    if (care) risks.push(`high irrigation need (~${round(w.deficit)} mm); check that your water source can supply it`);
  } else if (crop.rainfed_ok && !site.details.some((d) => d.type === "water")) {
    // (a dry-year failure is already a blocker from the site check above)
    const w = dryYearCoverage(crop, f, afterFallow);
    const pct = round(w.coverage * 100);
    const care = w.coverage < WATER_CAUTION_COVERAGE;
    add({
      type: "water",
      evidence: `in a dry year, rain and stored soil water cover ${Math.min(pct, 100)}% of ${name}'s water need (~${round(w.need)} mm)${afterFallow ? ", counting the water saved by last season's fallow" : ""}`,
      ...POWER,
      effect: w.coverage >= WATER_GOOD_COVERAGE ? "positive" : care ? "negative" : "neutral",
      level: care ? "caution" : "info",
    });
    const dryYear = f.annual_rain_dry_mm?.value;
    const min = crop.rain_abs_mm?.[0];
    if (dryYear != null && min != null && dryYear < min) {
      add({
        type: "water",
        evidence: `in a dry year about ${dryYear} mm of rain falls here, below the ${min} mm a year that rain-fed ${name} needs`,
        source: "NASA POWER + FAO EcoCrop",
        kind: "NASA reanalysis",
        effect: "negative",
        level: "caution",
      });
    }
  }

  // 4-6. Rotation: return interval, same crop again, same family.
  const rules = ruleTable?.rules ?? [];
  const gapRule = rules.find((r) => r.type === "min_gap" && r.target === crop.id);
  let rotationBlock = false;
  if (gapRule) {
    const k = previous.indexOf(crop.id);
    if (k >= 0 && k + 1 < gapRule.min_gap_years) {
      rotationBlock = true;
      add({
        type: "pest",
        evidence: `${name} was grown ${seasonsAgo(k)}; it needs at least ${gapRule.min_gap_years} years between crops: ${gapRule.reason}`,
        source: shortSource(gapRule.source),
        kind: "compiled rule",
        effect: "negative",
        level: "blocker",
      });
    } else if (k < 0 && previous.length < gapRule.min_gap_years - 1) {
      gaps.push(
        `${name} needs ${gapRule.min_gap_years} years between crops; you entered ${previous.length} past season${previous.length === 1 ? "" : "s"}, so check it was not grown in the ${gapRule.min_gap_years - 1} seasons before`
      );
    }
  }
  if (lastCrop) {
    const famRule = rules.find(
      (r) => r.type === "family_repeat" && matches(r.target, crop.id, cropsById) && matches(r.previous, last, cropsById)
    );
    const same = last === crop.id;
    if (same && !rotationBlock) {
      add({
        type: "pest",
        evidence: `${name} again after ${name}` + (famRule ? `: ${famRule.reason}` : ": pests and diseases of the crop build up"),
        source: famRule ? shortSource(famRule.source) : "crop table",
        kind: "compiled rule",
        effect: "negative",
        level: "caution",
      });
    } else if (!same && lastCrop.family === crop.family) {
      add({
        type: "pest",
        evidence:
          `${name} after ${shortName(lastCrop)}, a crop of the same family` +
          (famRule ? `: ${famRule.reason}` : "; they share some pests and diseases"),
        source: famRule ? shortSource(famRule.source) : "crop table",
        kind: "compiled rule",
        effect: "negative",
        level: "caution",
      });
    }

    // 7. Good preceding crops (e.g. legume before a cereal).
    for (const r of rules.filter((x) => x.type === "after")) {
      if (matches(r.previous, last, cropsById) && matches(r.target, crop.id, cropsById)) {
        add({
          type: "soil",
          evidence: `${shortName(lastCrop)} before ${name}: ${r.reason}`,
          source: shortSource(r.source),
          kind: "compiled rule",
          effect: "positive",
          level: "info",
        });
      }
    }
    const fixedBefore = nutrientTable?.crops?.[last]?.fixed_kg_n_ha;
    if (lastCrop.is_legume && fixedBefore && !crop.is_legume) {
      add({
        type: "soil",
        evidence: `${shortName(lastCrop)} fixes about ${fixedBefore} kg N per hectare, part of which is left for ${name}`,
        source: "Herridge 2008",
        kind: "compiled rule",
        effect: "positive",
        level: "info",
      });
    }
  }
  if (crop.is_legume) {
    const fixed = nutrientTable?.crops?.[crop.id]?.fixed_kg_n_ha;
    add({
      type: "soil",
      evidence: `${name} is a legume and adds nitrogen to the soil${fixed ? ` (about ${fixed} kg N per hectare)` : ""} for the crop after it`,
      source: fixed ? "Herridge 2008" : "crop table",
      kind: "compiled rule",
      effect: "positive",
      level: "info",
    });
  }

  // 8. Nutrient note: what last season's and this harvest remove (information only).
  const nut = (id) => {
    const c = nutrientTable?.crops?.[id];
    return c?.product && c.yield_t_ha ? { n: c.yield_t_ha * c.product.N, p: c.yield_t_ha * c.product.P * 2.291, k: c.yield_t_ha * c.product.K * 1.205 } : null;
  };
  const now = nut(crop.id);
  const before = lastCrop ? nut(last) : null;
  if (now) {
    const heavyPair = before && !crop.is_legume && !lastCrop.is_legume && now.n > HEAVY_N_KG_HA && before.n > HEAVY_N_KG_HA;
    const sum = (key) => round((now[key] ?? 0) + (before?.[key] ?? 0));
    add({
      type: "soil",
      evidence: before
        ? `${shortName(lastCrop)} and ${name} together remove about ${sum("n")} kg N, ${sum("p")} kg P2O5 and ${sum("k")} kg K2O per hectare at average yields${heavyPair ? "; both are heavy feeders" : ""}`
        : `a ${name} harvest removes about ${round(now.n)} kg N, ${round(now.p)} kg P2O5 and ${round(now.k)} kg K2O per hectare at average yields`,
      source: "FAOSTAT yields + Ludemann 2023",
      kind: "compiled rule",
      effect: heavyPair ? "negative" : "neutral",
      level: "info",
    });
  }

  // 9. Timing: last season's harvest against this crop's sowing.
  if (lastCrop) {
    if (lastCrop.season === "perennial") {
      add({
        type: "timing",
        evidence: `${shortName(lastCrop)} is a perennial: the stand must be broken up before ${name} is sown`,
        source: "crop table",
        kind: "compiled rule",
        effect: "neutral",
        level: "info",
      });
    } else if (crop.season !== "perennial") {
      const a = cropWindow(lastCrop, f);
      const b = cropWindow(crop, f);
      const gap = 365 + b.start - a.end; // days from last harvest to this sowing
      const cal = phenology(crop, f).calendar;
      if (gap < 0) {
        add({
          type: "timing",
          evidence: `${shortName(lastCrop)} is harvested about ${-gap} days after the usual ${name} sowing time here, so the two do not fit in consecutive seasons`,
          source: `${cal} + NASA POWER`,
          kind: "compiled rule",
          effect: "negative",
          level: "blocker",
        });
      } else if (gap < TIMING_TIGHT_DAYS) {
        add({
          type: "timing",
          evidence: `only about ${gap} days between the ${shortName(lastCrop)} harvest and ${name} sowing; a late harvest delays sowing`,
          source: `${cal} + NASA POWER`,
          kind: "compiled rule",
          effect: "negative",
          level: "caution",
        });
      }
    }
    if ((crop.season === "summer" || crop.season === "spring") && lastCrop.season === "winter") {
      gaps.push(`checked as next season's crop; sowing ${name} straight after the ${shortName(lastCrop)} harvest (a second crop) needs irrigation and is not checked here`);
    }
  }

  // Official calendar listing for this climate zone.
  const cal = f.sowing_calendar;
  const unlisted = Boolean(cal && cal.mapped?.includes(crop.id) && !cal.listed?.includes(crop.id));
  if (unlisted) risks.push(`${name} is not listed for this climate zone (${cal.zone_name}) in the TAGEM-DSİ guide; check that it is grown locally`);

  const verdict = reasons.some((r) => r.level === "blocker")
    ? "not_reasonable"
    : reasons.some((r) => r.level === "caution")
      ? "possible_with_care"
      : "reasonable";
  for (const r of reasons) if (r.level !== "info" && r.effect === "negative" && !risks.includes(r.evidence)) risks.push(r.evidence);
  return { verdict, reasons, risks: [...new Set(risks)], gaps, unlisted, hist, site };
}

/** Order candidates for "better after <previous crop>": fewest problems, then best water and climate. */
function rankKey(e) {
  const cautions = e.reasons.filter((r) => r.level === "caution").length;
  const pos = e.reasons.filter((r) => r.effect === "positive").length;
  const okShare = e.hist.n ? 1 - e.hist.badYears / e.hist.n : 1;
  return VERDICT_RANK[e.verdict] * 1000 + cautions * 50 - pos * 10 - okShare * 20;
}

/**
 * @param {Object} p
 * @param {string} p.cropId
 * @param {string[]} p.previous  last season first; "fallow" allowed; blanks removed
 * @returns {CropCheckResult}
 */
export function runCropCheck({ cropId, previous = [], features, cropTable, ruleTable = null, nutrientTable = null, farmer, dataStatus = {} }) {
  const crops = cropTable.crops;
  const cropsById = Object.fromEntries(crops.map((c) => [c.id, c]));
  const crop = cropsById[cropId];
  if (!crop) throw new Error(`unknown crop ${cropId}`);
  const prev = previous.filter((id) => id === "fallow" || cropsById[id]);
  const ctx = { f: features, cropsById, farmer, ruleTable, nutrientTable };

  const main = evaluate(crop, prev, ctx);

  // Alternatives: other crops that fit better after the same previous seasons, from
  // the same checks (a reasonable crop gets other reasonable ones). Only crops the
  // official guide lists for this zone (conservative, like generated rotations).
  const mainKey = main.verdict === "reasonable" ? 1000 : rankKey(main);
  const alternatives = crops
    .filter((c) => c.id !== crop.id && !farmer.never_grow?.includes(c.id))
    .map((c) => ({ c, e: evaluate(c, prev, ctx) }))
    .filter(({ e }) => e.verdict !== "not_reasonable" && !e.unlisted && rankKey(e) < mainKey)
    .sort((a, b) => rankKey(a.e) - rankKey(b.e))
    .slice(0, 3)
    .map(({ c }) => c.id);

  const gaps = [
    ...main.gaps,
    "crop table compiled from FAO sources, not yet checked by a local expert",
    "no local pest or disease history for your field",
  ];
  if (prev.length === 0) gaps.push("no previous seasons entered, so rotation rules were not checked");
  if (!farmer.soil_override?.ph && !dataStatus.soil) gaps.push("soil pH not checked (no soil test entered)");
  if (!zoneCalendar(crop.id, features)) gaps.push("sowing date from the crop table, not from the official regional calendar");
  gaps.push("weather data describes an area tens of km wide, not this field alone");

  let confidence = "medium"; // never "high" while the crop table is unverified
  if (!dataStatus.power || main.unlisted || prev.length === 0) confidence = "low";

  const result = {
    crop: crop.id,
    previous: prev,
    verdict: main.verdict,
    reasons: main.reasons.map(({ type, evidence, source, kind, effect, level }) => ({ type, evidence, source, kind, effect, level })),
    alternatives,
    risks: main.risks,
    gaps,
    confidence,
  };
  const errs = validateCheck(result);
  if (errs.length) throw new Error(`crop check broke its contract: ${errs.join("; ")}`);
  return result;
}

/** Returns a list of problems; an empty list means the result follows the contract. */
export function validateCheck(r) {
  const errs = [];
  const need = (cond, msg) => cond || errs.push(msg);
  need(typeof r?.crop === "string", "crop must be a string");
  need(Array.isArray(r?.previous), "previous must be an array");
  need(VERDICTS.includes(r?.verdict), "verdict invalid");
  need(Array.isArray(r?.reasons) && r.reasons.length > 0, "reasons must be a non-empty array");
  (r?.reasons ?? []).forEach((x, i) => {
    need(CHECK_REASON_TYPES.includes(x.type), `reasons[${i}].type invalid`);
    need(EFFECTS.includes(x.effect), `reasons[${i}].effect invalid`);
    need(KINDS.includes(x.kind), `reasons[${i}].kind invalid`);
    need(LEVELS.includes(x.level), `reasons[${i}].level invalid`);
    need(typeof x.evidence === "string" && x.evidence.length > 0, `reasons[${i}].evidence empty`);
    need(typeof x.source === "string" && x.source.length > 0, `reasons[${i}].source empty`);
  });
  need(Array.isArray(r?.alternatives) && r.alternatives.length <= 3, "alternatives must be an array of up to 3");
  need(Array.isArray(r?.risks), "risks must be an array");
  need(Array.isArray(r?.gaps), "gaps must be an array");
  need(CONFIDENCE.includes(r?.confidence), "confidence invalid");
  const blockers = (r?.reasons ?? []).some((x) => x.level === "blocker");
  const cautions = (r?.reasons ?? []).some((x) => x.level === "caution");
  need(blockers === (r?.verdict === "not_reasonable"), "verdict must be not_reasonable exactly when a blocker exists");
  need(blockers || cautions === (r?.verdict === "possible_with_care"), "verdict must follow the cautions");
  return errs;
}
