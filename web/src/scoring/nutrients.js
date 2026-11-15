// Nutrient balance of a rotation, per hectare and year (average over the cycle):
// what the harvests remove (yield × nutrient per tonne) and the nitrogen legumes fix.
// Only legumes add nitrogen; phosphorus and potassium can only come back through
// fertilizer or manure. Crop residues are assumed to stay in the field.
//
// Yield: the province's own TÜİK average for the farmer's water regime when known
// (scoring/yields.js), otherwise the national FAOSTAT average.

import { round } from "../features/stats.js";
import { localYield } from "./yields.js";

const P_TO_P2O5 = 2.291;
const K_TO_K2O = 1.205;

/** Yield used for one crop: { t_ha, source: "local" | "national" } or null. */
export function yieldFor(id, nutrientTable, local, asSecond = false) {
  const l = localYield(local, id, asSecond);
  if (l) return { t_ha: l.t_ha, source: "local", mixed: l.mixed };
  const c = nutrientTable?.crops?.[id];
  return c?.yield_t_ha ? { t_ha: c.yield_t_ha, source: "national" } : null;
}

export function nutrientBalance(sequence, secondCrops, nutrientTable, local = null) {
  if (!nutrientTable) return null;
  let n = 0, p = 0, k = 0, fixed = 0;
  const missing = [];
  const localIds = new Set();
  const mixedIds = new Set();
  const nationalIds = new Set();
  const perCrop = []; // one entry per planting, kg/ha for that harvest (not averaged per year)
  const add = (id, asSecond) => {
    if (id === "fallow") return;
    const c = nutrientTable.crops[id];
    const y = yieldFor(id, nutrientTable, local, asSecond);
    if (c?.product && y) {
      n += y.t_ha * c.product.N;
      p += y.t_ha * c.product.P;
      k += y.t_ha * c.product.K;
      (y.source === "local" ? localIds : nationalIds).add(id);
      if (y.mixed) mixedIds.add(id);
    } else missing.push(id);
    let fx = 0;
    if (c?.fixed_kg_n_ha) {
      // Herridge method is proportional to yield: scale the national figure to the local yield.
      const scale = y && c.yield_t_ha ? y.t_ha / c.yield_t_ha : 1;
      fx = c.fixation_method === "grain_legume" ? c.fixed_kg_n_ha * scale : c.fixed_kg_n_ha;
      fixed += fx;
    }
    if (c?.product && y) {
      perCrop.push({
        id,
        second: asSecond,
        yield_t_ha: round(y.t_ha, 1),
        yield_source: y.source,
        n: round(y.t_ha * c.product.N),
        p2o5: round(y.t_ha * c.product.P * P_TO_P2O5),
        k2o: round(y.t_ha * c.product.K * K_TO_K2O),
        n_fixed: round(fx),
      });
    }
  };
  sequence.forEach((id, i) => {
    add(id, false);
    const second = secondCrops?.[i] ?? secondCrops?.[String(i)];
    if (second) add(second, true);
  });
  const years = sequence.length;
  return {
    n_removed: round(n / years),
    n_fixed: round(fixed / years),
    n_net: round((fixed - n) / years),
    p2o5_removed: round((p * P_TO_P2O5) / years),
    k2o_removed: round((k * K_TO_K2O) / years),
    missing: [...new Set(missing)],
    yields_local: [...localIds],
    yields_national: [...nationalIds],
    yields_mixed: [...mixedIds], // subset of yields_local: TÜİK rain-fed and irrigated together
    per: "kg/ha per year",
    per_crop: perCrop, // kg/ha per harvest, for the crop calendar (not part of the AI facts)
  };
}
