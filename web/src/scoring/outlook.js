// Climate outlook: does the crop's climate still fit with uniform warming?
// A what-if on the 20-year NASA POWER record (features/scenario.js), never a
// forecast. It keeps climate fit apart from water supply: the paddy-area rule
// (filter.js) says whether rice's river or canal water exists today; this says
// whether the climate would allow the crop today, at +2 °C and at +3 °C.
// Used for rice for now (crops with `paddy`), so other crops' results do not change.

import { applyScenario } from "../features/scenario.js";
import { climateHistory } from "./agronomy.js";
import { checkCrop } from "./filter.js";
export const OUTLOOK_WARMING_C = [2, 3];
// Same as CLIMATE_CAUTION_SHARE in cropCheck.js (not imported: cropCheck imports this module).
const CLIMATE_CAUTION_SHARE = 0.25;

/** Climate-only verdict for one climate: hard climate checks plus heat/frost history. */
function climateFit(crop, f) {
  // Irrigated, no TÜİK data: water, paddy area and pH are not climate questions.
  const site = checkCrop(crop, f, { irrigation: "irrigated", never_grow: [] }, null);
  const failures = site.details.filter((d) => d.type === "climate");
  const hist = climateHistory(crop, f);
  const tooOftenHot = hist.n > 0 && hist.heatYears / hist.n > CLIMATE_CAUTION_SHARE;
  const tooOftenCold = hist.n > 0 && hist.frostYears / hist.n > CLIMATE_CAUTION_SHARE;
  let why = null;
  if (failures.length) why = failures.some((d) => /too cool|frost-free|winters/.test(d.evidence)) ? "too_cool" : "too_hot";
  else if (tooOftenHot) why = "hot_flowering";
  else if (tooOftenCold) why = "cold_flowering";
  return { fit: !why, why, heatYears: hist.heatYears, frostYears: hist.frostYears, n: hist.n };
}

/** Today plus each warming step; `changes` is true when the verdict differs from today. */
export function climateOutlook(crop, f) {
  const today = { tempC: 0, ...climateFit(crop, f) };
  const warmer = OUTLOOK_WARMING_C.map((t) => ({ tempC: t, ...climateFit(crop, applyScenario(f, { tempC: t })) }));
  return { today, warmer, changes: warmer.some((w) => w.fit !== today.fit) };
}

const WHY = {
  too_cool: "too cool to mature",
  too_hot: "too hot",
  hot_flowering: "heat at flowering",
  cold_flowering: "cold at flowering",
};

/** One plain-language line, numbers included. */
export function describeOutlook(name, o) {
  const step = (s) => {
    const label = s.tempC ? `at +${s.tempC} °C` : "today";
    if (s.fit) return `${label} the climate fits (heat at flowering in ${s.heatYears} of ${s.n} years)`;
    if (s.why === "hot_flowering") return `${label} heat at flowering in ${s.heatYears} of ${s.n} years`;
    if (s.why === "cold_flowering") return `${label} cold at flowering in ${s.frostYears} of ${s.n} years`;
    return `${label} ${WHY[s.why]}`;
  };
  return `climate outlook for ${name} (what-if warming of the last ${o.today.n} years, not a forecast): ${[o.today, ...o.warmer].map(step).join("; ")}`;
}
