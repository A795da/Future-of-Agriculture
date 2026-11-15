// Scoring entry point: the only module that decides.
// Inputs are features (never raw series), the crop and rotation tables and the
// farmer's input. Output is one RotationResult per card (scoring/contract.js):
// the farmer's current rotation first, then the two best alternatives.

import { applyScenario } from "../features/scenario.js";
import { validateResult } from "./contract.js";
import { filterCrops } from "./filter.js";
import { labelOf, scoreRotation } from "./score.js";

const sameSeq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const MAX_GENERATOR_CROPS = 8; // above this, only 2-year rotations are generated
const MAX_GENERATOR_CROPS_2Y = 16; // keeps the 2-year search under ~300 sequences

/** Same cycle, any starting year (wheat>chickpea equals chickpea>wheat). */
function sameCycle(a, b) {
  if (a.length !== b.length) return false;
  return a.some((_, k) => sameSeq(a, [...b.slice(k), ...b.slice(0, k)]));
}

/** 2- and 3-year rotations from crops that passed the filters, plus fallow. */
function generateRotations(okIds, existing) {
  if (okIds.length === 0 || okIds.length > MAX_GENERATOR_CROPS_2Y) return [];
  const threeYear = okIds.length <= MAX_GENERATOR_CROPS;
  const pool = [...okIds, "fallow"];
  const out = [];
  const add = (seq) => {
    if (seq.every((x) => x === "fallow")) return;
    if (seq.some((x, i) => x === "fallow" && seq[(i + 1) % seq.length] === "fallow")) return;
    if ([...existing, ...out.map((r) => r.sequence)].some((s) => sameCycle(s, seq))) return;
    out.push({ id: `generated-${seq.join("-")}`, sequence: seq, notes: null, generated: true });
  };
  for (const a of pool) for (const b of pool) add([a, b]);
  if (threeYear) for (const a of pool) for (const b of pool) for (const c of pool) add([a, b, c]);
  return out;
}

export function runScoring({ features, terrain = null, vegetation = null, cropTable, rotationTable, nutrientTable = null, ruleTable = null, farmer, scenario = null, dataStatus = {} }) {
  const whatIf = Boolean(scenario && (scenario.rainPct || scenario.tempC));
  const f = whatIf ? applyScenario(features, scenario) : features;
  const crops = cropTable.crops;
  const cropsById = Object.fromEntries(crops.map((c) => [c.id, c]));

  // 1. hard filters use today's climate: a what-if scenario re-ranks the options
  // (scores, risks) but does not delete them.
  const checks = filterCrops(crops, features, farmer);
  const okCrop = new Set(checks.filter((c) => c.ok).map((c) => c.id));
  const removed = checks.filter((c) => !c.ok);

  // candidate templates
  const baselineSeq = (farmer.current_sequence ?? []).filter((id) => id === "fallow" || cropsById[id]);
  const irrigationOk = (r) =>
    r.irrigation === "either" || r.irrigation === farmer.irrigation || (farmer.irrigation === "irrigated" && r.irrigation === "rainfed");
  const usable = (r) =>
    irrigationOk(r) &&
    r.sequence.every((id) => id === "fallow" || okCrop.has(id)) &&
    Object.values(r.second_crops ?? {}).every((id) => okCrop.has(id)) &&
    !sameSeq(r.sequence, baselineSeq);

  let candidates = rotationTable.rotations.filter((r) => usable(r) && r.regions.includes(farmer.region));
  const regional = candidates.length >= 2;
  if (!regional) {
    const extra = rotationTable.rotations.filter((r) => usable(r) && !candidates.includes(r));
    candidates = [...candidates, ...extra.map((r) => ({ ...r, fromOtherRegion: true }))];
  }
  // Crops the official TAGEM-DSİ guide does not list for this climate zone.
  const cal = features.sowing_calendar;
  const unlisted = (id) => Boolean(cal && cal.mapped?.includes(id) && !cal.listed?.includes(id));

  // Still fewer than two? Build rotations from the crops that passed the checks,
  // using only crops the guide lists for this zone (generated options stay conservative).
  if (candidates.length < 2) {
    const have = [baselineSeq, ...candidates.map((r) => r.sequence)];
    const pool = [...okCrop].filter((id) => !unlisted(id));
    candidates = [...candidates, ...generateRotations(pool, have)];
  }

  const ctx = { f, cropsById, farmer, terrain, nutrientTable, ruleTable };
  const finish = (rot, scored, isBaseline) => {
    const gaps = [
      "crop table compiled from FAO sources, not yet checked by a local expert",
      "no local pest or disease history",
      "no market prices; income uses your own ratings",
    ];
    if (!dataStatus.soil) gaps.push("soil data unavailable (SoilGrids did not respond); soil pH not checked unless you enter a soil test");
    if (!vegetation) gaps.push("no satellite vegetation history cached for this location yet");
    if (!terrain) gaps.push("field slope unknown; erosion uses rainfall and bare periods only");
    if (scored.nutrients) {
      gaps.push("nutrient numbers use Türkiye average yields (FAOSTAT 2020-2024, irrigated and rain-fed mixed) and assume straw and residues stay in the field");
      if (scored.nutrients.missing.length) {
        gaps.push(`no nutrient removal data for ${scored.nutrients.missing.map((id) => labelOf([id], cropsById)).join(", ")}`);
      }
    }
    const noHeat = [...new Set(rot.sequence)].filter((id) => {
      const c = cropsById[id];
      return c && (c.season === "spring" || c.season === "summer") && c.family !== "poaceae" && !c.heat_units;
    });
    if (noHeat.length) {
      gaps.push(`no heat-unit check for ${noHeat.map((id) => labelOf([id], cropsById)).join(", ")} (no FAO AquaCrop parameters); only frost-free days are checked`);
    }
    if (features.sowing_calendar) {
      if (farmer.irrigation === "rainfed") {
        gaps.push("winter-crop sowing dates come from the TAGEM-DSİ guide (written for irrigated crops); rain-fed spring crops use earlier crop-table dates");
      }
    } else gaps.push("sowing dates from the crop table, not from an official regional calendar");
    gaps.push("weather data describes an area tens of km wide, not this field alone");

    const risks = [...scored.risks];
    if (isBaseline) {
      for (const id of rot.sequence) {
        const c = removed.find((x) => x.id === id);
        if (c) risks.unshift(`${c.name} did not pass the checks: ${c.reasons.join("; ")}`);
      }
    }
    if (rot.fromOtherRegion) risks.push("this rotation is common in another region of Turkey; check it with a local agronomist");
    if (rot.generated) {
      risks.push("built by FieldShift from the crops that passed the checks; not a known local rotation, so check it with a local agronomist");
    }

    const notInZone = [...new Set(rot.sequence.filter(unlisted))];
    for (const id of notInZone) {
      risks.push(`${labelOf([id], cropsById)} is not listed for this climate zone (${cal.zone_name}) in the TAGEM-DSİ guide; check that it is grown locally`);
    }

    let confidence = "medium"; // never "high" while the crop table is unverified
    if (!dataStatus.power || rot.fromOtherRegion || rot.generated || notInZone.length) confidence = "low";

    const result = {
      id: isBaseline ? "current" : rot.id,
      sequence: rot.sequence,
      label: labelOf(rot.sequence, cropsById, rot.second_crops),
      is_baseline: isBaseline,
      score: scored.score,
      dimensions: scored.dimensions,
      sequence_adjustment: scored.sequence_adjustment,
      reasons: scored.reasons,
      risks: [...new Set(risks)],
      gaps,
      confidence,
      what_if: whatIf,
      notes: rot.notes ?? null,
      nutrients: scored.nutrients ?? null,
    };
    const errs = validateResult(result);
    if (errs.length) throw new Error(`scoring broke the contract for ${result.id}: ${errs.join("; ")}`);
    return result;
  };

  const ranked = candidates
    .map((r) => ({ r, s: scoreRotation(r, ctx) }))
    .sort((a, b) => b.s.score - a.s.score)
    .slice(0, 2)
    .map(({ r, s }) => finish(r, s, false));

  const results = [];
  if (baselineSeq.length) {
    const base = { id: "current", sequence: baselineSeq };
    results.push(finish(base, scoreRotation(base, ctx), true));
  }
  results.push(...ranked);

  return { results, removed, what_if: whatIf, regional };
}
