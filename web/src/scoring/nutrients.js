// Nutrient balance of a rotation, per hectare and year (average over the cycle):
// what the harvests remove (yield × nutrient per tonne) and the nitrogen legumes fix.
// Only legumes add nitrogen; phosphorus and potassium can only come back through
// fertilizer or manure. Crop residues are assumed to stay in the field.

import { round } from "../features/stats.js";

const P_TO_P2O5 = 2.291;
const K_TO_K2O = 1.205;

export function nutrientBalance(sequence, secondCrops, nutrientTable) {
  if (!nutrientTable) return null;
  let n = 0, p = 0, k = 0, fixed = 0;
  const missing = [];
  const add = (id) => {
    if (id === "fallow") return;
    const c = nutrientTable.crops[id];
    if (c?.product && c.yield_t_ha) {
      n += c.yield_t_ha * c.product.N;
      p += c.yield_t_ha * c.product.P;
      k += c.yield_t_ha * c.product.K;
    } else missing.push(id);
    if (c?.fixed_kg_n_ha) fixed += c.fixed_kg_n_ha;
  };
  sequence.forEach((id, i) => {
    add(id);
    const second = secondCrops?.[i] ?? secondCrops?.[String(i)];
    if (second) add(second);
  });
  const years = sequence.length;
  return {
    n_removed: round(n / years),
    n_fixed: round(fixed / years),
    n_net: round((fixed - n) / years),
    p2o5_removed: round((p * P_TO_P2O5) / years),
    k2o_removed: round((k * K_TO_K2O) / years),
    missing: [...new Set(missing)],
    per: "kg/ha per year",
  };
}
