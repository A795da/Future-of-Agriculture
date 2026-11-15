// Scores one field part: its own water regime and soil feed the same features
// pipeline and engine run as the app's main view, so a part summary and the
// cards always agree.

import { withSoilTexture, withSowingCalendar, withWaterStorage } from "../data/loader.js";
import { runScoring } from "./index.js";
import { localYields as buildLocalYields } from "./yields.js";
import { cleanSecond } from "./defaults.js";

export function partFeatures(rawFeatures, point, tables, part) {
  return withWaterStorage(
    withSoilTexture(withSowingCalendar(rawFeatures, point, tables?.tagem, part.irrigation), point, tables?.soilTexture, part.soil),
    point,
    tables?.waterStorage
  );
}

export function scorePart({ part, farm, rawFeatures, point, tables, terrain = null, vegetation = null, scenario, features: given = null }) {
  if (!rawFeatures || !tables || !point) return null;
  const features = given ?? partFeatures(rawFeatures, point, tables, part);
  const localYields = buildLocalYields(tables.tuikYields, point.id, part.irrigation);
  const second = cleanSecond(part.current, part.second);
  try {
    const outcome = runScoring({
      features,
      terrain,
      vegetation,
      cropTable: tables.cropTable,
      rotationTable: tables.rotationTable,
      nutrientTable: tables.nutrientTable,
      ruleTable: tables.ruleTable,
      localYields,
      farmer: {
        region: point.region,
        irrigation: part.irrigation,
        current_sequence: part.current,
        ...(Object.keys(second).length ? { current_second: second } : {}),
        history: part.current,
        priorities: farm.priorities,
        never_grow: farm.never,
        income_ratings: farm.ratings ?? {},
      },
      scenario,
      dataStatus: { power: true, soil: false },
    });
    return { features, localYields, outcome };
  } catch (e) {
    return { features, localYields, outcome: { error: e.message } };
  }
}
