// FROZEN CONTRACT: the scoring module writes this shape; the interface and the
// AI layer only read it. Change it only by agreement, and update the validator
// and the example together.

/** Kinds of evidence a reason can point to. */
export const REASON_TYPES = ["water", "climate", "soil", "erosion", "pest", "income", "simplicity"];

/** How a reason affects the rotation. */
export const EFFECTS = ["positive", "negative", "neutral"];

/** What kind of value the evidence is (shown as a label on every chip). */
// "NASA reanalysis" = NASA POWER weather (MERRA-2 model constrained by observations).
export const KINDS = [
  "NASA observation",
  "NASA reanalysis",
  "NASA model estimate",
  "model estimate",
  "farmer input",
  "compiled rule",
];

export const CONFIDENCE = ["high", "medium", "low"];

/** The scored dimensions; each is 0-100, higher is better (erosion: higher = lower risk). */
export const DIMENSIONS = ["water", "climate", "soil", "erosion", "pest", "income", "simplicity"];

/**
 * @typedef {Object} Reason
 * @property {string} type      one of REASON_TYPES
 * @property {string} evidence  short plain-language fact, numbers included
 * @property {string} source    e.g. "NASA POWER", "MODIS NDVI", "crop table", "farmer"
 * @property {string} kind      one of KINDS
 * @property {string} effect    one of EFFECTS
 *
 * @typedef {Object} RotationResult
 * @property {string}   id          rotation template id, or "current"
 * @property {string[]} sequence    crop ids by year ("fallow" allowed)
 * @property {string}   label       e.g. "wheat > chickpea > barley"
 * @property {boolean}  is_baseline true for the farmer's current rotation
 * @property {number}   score       0-100 after priority weights and sequence adjustment
 * @property {Object<string, number>} dimensions  0-100 per DIMENSIONS entry
 * @property {number}   sequence_adjustment  points added or removed by rotation rules
 * @property {Reason[]} reasons
 * @property {string[]} risks       things that could go wrong, for local review
 * @property {string[]} gaps        information the tool does not have
 * @property {string}   confidence  one of CONFIDENCE
 * @property {boolean}  what_if     true when a scenario (rain/temperature change) was applied
 * @property {Object|null} [nutrients] optional: kg/ha per year { n_removed, n_fixed, n_net,
 *                                  p2o5_removed, k2o_removed, missing[] } (information, not scored)
 */

export const EXAMPLE = {
  id: "wheat-chickpea-barley",
  sequence: ["wheat", "chickpea", "barley"],
  label: "wheat > chickpea > barley",
  is_baseline: false,
  score: 78,
  dimensions: { water: 72, climate: 81, soil: 85, erosion: 70, pest: 80, income: 60, simplicity: 75 },
  sequence_adjustment: 5,
  reasons: [
    {
      type: "water",
      evidence: "median Apr-Jun rain minus evaporation -41 mm, 2005-2025",
      source: "NASA POWER",
      kind: "NASA reanalysis",
      effect: "positive",
    },
    {
      type: "soil",
      evidence: "chickpea is a legume and adds nitrogen for the barley after it",
      source: "crop table",
      kind: "compiled rule",
      effect: "positive",
    },
  ],
  risks: ["late frost in 3 of last 20 springs"],
  gaps: ["no local disease history", "market price not available"],
  confidence: "medium",
  what_if: false,
};

/** Returns a list of problems; an empty list means the result follows the contract. */
export function validateResult(r) {
  const errs = [];
  const need = (cond, msg) => cond || errs.push(msg);
  need(typeof r?.id === "string", "id must be a string");
  need(Array.isArray(r?.sequence) && r.sequence.length > 0, "sequence must be a non-empty array");
  need(typeof r?.label === "string", "label must be a string");
  need(typeof r?.is_baseline === "boolean", "is_baseline must be boolean");
  need(Number.isFinite(r?.score) && r.score >= 0 && r.score <= 100, "score must be 0-100");
  for (const d of DIMENSIONS) {
    const v = r?.dimensions?.[d];
    need(Number.isFinite(v) && v >= 0 && v <= 100, `dimensions.${d} must be 0-100`);
  }
  need(Number.isFinite(r?.sequence_adjustment), "sequence_adjustment must be a number");
  need(Array.isArray(r?.reasons), "reasons must be an array");
  (r?.reasons ?? []).forEach((x, i) => {
    need(REASON_TYPES.includes(x.type), `reasons[${i}].type invalid`);
    need(EFFECTS.includes(x.effect), `reasons[${i}].effect invalid`);
    need(KINDS.includes(x.kind), `reasons[${i}].kind invalid`);
    need(typeof x.evidence === "string" && x.evidence.length > 0, `reasons[${i}].evidence empty`);
    need(typeof x.source === "string" && x.source.length > 0, `reasons[${i}].source empty`);
  });
  need(Array.isArray(r?.risks), "risks must be an array");
  need(Array.isArray(r?.gaps), "gaps must be an array");
  need(CONFIDENCE.includes(r?.confidence), "confidence invalid");
  need(typeof r?.what_if === "boolean", "what_if must be boolean");
  return errs;
}
