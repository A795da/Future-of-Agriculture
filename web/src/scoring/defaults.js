// Defaults the app starts from (shared with scripts/build_explain_cache.mjs, so
// the cached demo explanations match what a first-time visitor sees).

import { filterCrops } from "./filter.js";

export const DEFAULT_INPUTS = {
  irrigation: "rainfed",
  current: ["wheat", "fallow"],
  priorities: { water: 50, soil: 50, income: 50, simplicity: 50 },
  never: [],
  soil: "unknown", // farmer's topsoil texture: unknown | clay | loam | sandy (rice seepage)
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

// ---- Field parts: a farm can split its field into parts, each with its own
// rotation (with optional second crops), water and soil. Priorities, income
// ratings and never-grow crops stay farm-wide.
export const MAX_PARTS = 4;

export function newPart(id, from = DEFAULT_INPUTS) {
  return { id, name: "", area_ha: null, irrigation: from.irrigation, soil: from.soil ?? "unknown", current: [...from.current], second: {} };
}

export const DEFAULT_FARM = {
  priorities: DEFAULT_INPUTS.priorities,
  never: DEFAULT_INPUTS.never,
  ratings: DEFAULT_INPUTS.ratings,
  touched: false,
  parts: [newPart("p1")],
  activePart: "p1",
};

/** The active part as the flat inputs the engine and older components use.
 * With one part and no second crop this equals DEFAULT_INPUTS-style inputs, so
 * the cached AI explanations still match. */
export function effectiveInputs(farm) {
  const part = farm.parts.find((p) => p.id === farm.activePart) ?? farm.parts[0];
  return {
    irrigation: part.irrigation,
    soil: part.soil,
    current: part.current,
    second: part.second ?? {},
    priorities: farm.priorities,
    never: farm.never,
    ratings: farm.ratings,
    touched: farm.touched,
    partId: part.id,
  };
}

/** Second crops as a clean { yearIndex: cropId } map (drops empty and fallow years). */
export function cleanSecond(current, second = {}) {
  return Object.fromEntries(Object.entries(second).filter(([i, id]) => id && current[+i] && current[+i] !== "fallow"));
}

/** Farm with one more part (a copy of the active part's water and soil) made active. */
export function withNewPart(farm) {
  if (farm.parts.length >= MAX_PARTS) return farm;
  const id = `p${Math.max(0, ...farm.parts.map((p) => +p.id.slice(1) || 0)) + 1}`;
  const from = farm.parts.find((p) => p.id === farm.activePart) ?? farm.parts[0];
  return { ...farm, touched: true, parts: [...farm.parts, newPart(id, from)], activePart: id };
}
