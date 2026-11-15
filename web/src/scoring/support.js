// Ministry support rule on crop rotation (münavebe). Tarım ve Orman Bakanlığı,
// Tebliğ No. 2024/39 on 2025-2027 crop production support (Resmî Gazete
// 31.12.2024, issue 32769, 5th repeat): Article 13(1)(c), the same crop may be
// sown on the same parcel at most twice in a row; rice, perennial crops and
// greenhouse production are exempt. Article 17(2)(ı): parcels that break the
// rule get no basic support (diesel and fertiliser), planned-production or
// production-development payments. Information only: it never removes a crop.

export const SUPPORT_RULE_SOURCE = "Tarım ve Orman Bakanlığı, Tebliğ 2024/39 (Art. 13, 17)";
export const SUPPORT_MAX_IN_A_ROW = 2;

// Spring and winter types are the same product (buğday, arpa) in the farmer registry.
const PRODUCT = { spring_wheat: "wheat", spring_barley: "barley" };

/** Product group for the rule, or null when the rule does not apply (fallow, rice, perennials). */
export function supportProduct(id, cropsById) {
  if (!id || id === "fallow") return null;
  const c = cropsById[id];
  if (!c || c.paddy || c.id === "rice" || c.season === "perennial") return null;
  return PRODUCT[id] ?? id;
}

/** The crop the repeating rotation grows more than twice in a row, or null.
 * The sequence repeats, so ["wheat"] or ["wheat", "wheat"] means wheat every year. */
export function supportRuleBreach(sequence, cropsById) {
  const n = sequence.length;
  const g = sequence.map((id) => supportProduct(id, cropsById));
  for (let i = 0; i < n; i++) {
    if (!g[i]) continue;
    let k = 1;
    while (k <= SUPPORT_MAX_IN_A_ROW && g[(i + k) % n] === g[i]) k++;
    if (k > SUPPORT_MAX_IN_A_ROW) return sequence[i];
  }
  return null;
}
