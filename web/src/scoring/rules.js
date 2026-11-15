// Rotation rules with a source per rule (data/sources/rotation_rules.csv):
//   min_gap        a crop should come back no more often than every N years
//   family_repeat  the same family in consecutive years (shared pests and diseases)
//   after          a beneficial preceding crop (e.g. legume before a cereal)
// Applied to the rotation as a repeating cycle, so the last year is followed by the first.

import { shortName } from "./names.js";

/** Short source label for evidence chips: "Rothamsted Research (Annals ..., ...); ..." → "Rothamsted Research". */
export const shortSource = (s) => s.split(/ \(|;|,/)[0].trim();

const matches = (key, id, cropsById) => key === id || (id !== "fallow" && cropsById[id]?.family === key);

/** Years until the crop comes back, on the repeating cycle (1 = every year). */
function returnInterval(seq, target) {
  const pos = seq.map((id, i) => (id === target ? i : -1)).filter((i) => i >= 0);
  if (pos.length === 0) return null;
  if (pos.length === 1) return seq.length;
  let min = Infinity;
  for (let k = 0; k < pos.length; k++) {
    const next = pos[(k + 1) % pos.length] + (k + 1 === pos.length ? seq.length : 0);
    min = Math.min(min, next - pos[k]);
  }
  return min;
}

/** Adjacent pairs on the cycle (a 1-year rotation pairs with itself). */
const pairs = (seq) => seq.map((id, i) => [id, seq[(i + 1) % seq.length]]);

export function applyRotationRules(seq, cropsById, ruleTable) {
  const hits = [];
  const familiesWithRule = new Set();
  for (const rule of ruleTable.rules) {
    if (rule.type === "min_gap") {
      const every = returnInterval(seq, rule.target);
      if (every != null && every < rule.min_gap_years) {
        const name = shortName(cropsById[rule.target]);
        hits.push({
          rule,
          points: rule.points,
          type: "pest",
          text: `${name} comes back every ${every === 1 ? "year" : `${every} years`}; it needs at least ${rule.min_gap_years} years between crops: ${rule.reason}`,
        });
      }
    } else if (rule.type === "family_repeat") {
      familiesWithRule.add(rule.target);
      const n = pairs(seq).filter(([a, b]) => matches(rule.target, a, cropsById) && matches(rule.previous, b, cropsById)).length;
      if (n > 0) {
        hits.push({
          rule,
          points: rule.points * n,
          type: "pest",
          text: `${n === 1 ? "one crop follows" : `${n} crops follow`} a crop of the same family: ${rule.reason}`,
        });
      }
    } else if (rule.type === "after") {
      const found = pairs(seq).filter(([a, b]) => matches(rule.previous, a, cropsById) && matches(rule.target, b, cropsById));
      if (found.length > 0) {
        const [a, b] = found[0];
        hits.push({
          rule,
          points: rule.points * found.length,
          type: "soil",
          text: `${shortName(cropsById[a])} before ${shortName(cropsById[b])}: ${rule.reason}`,
        });
      }
    }
  }
  // Same family back to back where no specific rule covers it (e.g. two legumes).
  const generic = pairs(seq).filter(
    ([a, b]) => a !== "fallow" && b !== "fallow" && cropsById[a].family === cropsById[b].family && !familiesWithRule.has(cropsById[a].family)
  ).length;
  const adjustment = hits.reduce((s, h) => s + h.points, 0) - 5 * generic;
  return { hits, adjustment, genericSameFamily: generic };
}
