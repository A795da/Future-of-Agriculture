// Defaults the app starts from (shared with scripts/build_explain_cache.mjs, so
// the cached demo explanations match what a first-time visitor sees).

import { filterCrops } from "./filter.js";

export const DEFAULT_INPUTS = {
  irrigation: "rainfed",
  current: ["wheat", "fallow"],
  priorities: { water: 50, soil: 50, income: 50, simplicity: 50 },
  never: [],
  ratings: {}, // farmer's own income rating per crop, 1-5 (unrated = 3)
  touched: false,
};

/** A typical rotation for the region whose crops pass the checks at this place,
 * used until the farmer edits their own. */
export function defaultRotation(tables, region, features) {
  const regional = tables.rotationTable.rotations.filter(
    (x) => x.regions.includes(region) && (x.irrigation === "rainfed" || x.irrigation === "either")
  );
  if (features) {
    const ok = new Set(
      filterCrops(tables.cropTable.crops, features, { irrigation: "rainfed", never_grow: [] })
        .filter((c) => c.ok)
        .map((c) => c.id)
    );
    const fits = regional.find((r) => r.sequence.every((id) => id === "fallow" || ok.has(id)));
    if (fits) return [...fits.sequence];
  }
  return regional[0] ? [...regional[0].sequence] : ["wheat", "fallow"];
}

/** Last seasons from the farmer's rotation, assuming it repeats: last season first. */
export function previousFromRotation(current, seasons = 3) {
  const n = current.length;
  return Array.from({ length: seasons }, (_, k) => current[(((n - 1 - k) % n) + n) % n] ?? "");
}
