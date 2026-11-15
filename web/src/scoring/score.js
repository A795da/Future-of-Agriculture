// Steps 2-4: dimension scores (0-100), sequence adjustment, weighted score,
// and structured reasons. Every number shown to the farmer comes from here.

import { clamp, mean, round } from "../features/stats.js";
import { climateHistory, describePaddySoil, dryYearCoverage, irrigationNeed } from "./agronomy.js";
import { waterSupply } from "./waterSupply.js";
import { amountText, peaksWords, waterData } from "./waterText.js";
import { bareStats, rotationTimeline, secondCropFit, sowingDoy } from "./calendar.js";
import { heatUnits } from "./heat.js";
import { nutrientBalance } from "./nutrients.js";
import { applyRotationRules, shortSource } from "./rules.js";

export const FIXED_WEIGHTS = { climate: 0.2, pest: 0.1 }; // not on the sliders
export const NEUTRAL_RATING = 3; // income rating (1-5) when the farmer gave none

import { shortName } from "./names.js";
const nameOf = (id, cropsById) => (id === "fallow" ? "fallow" : shortName(cropsById[id]));
export const labelOf = (seq, cropsById, second = {}) =>
  seq
    .map((id, i) => nameOf(id, cropsById) + (second[i] ?? second[String(i)] ? ` + ${nameOf(second[i] ?? second[String(i)], cropsById)}` : ""))
    .join(" > ");

/** Slider priorities (water, soil, income, simplicity) -> weights per dimension, summing to 1. */
export function weightsFrom(priorities = {}) {
  const p = { water: 0.25, soil: 0.25, income: 0.25, simplicity: 0.25, ...priorities };
  const total = p.water + p.soil + p.income + p.simplicity || 1;
  const free = 1 - FIXED_WEIGHTS.climate - FIXED_WEIGHTS.pest;
  const k = free / total;
  return {
    water: p.water * k,
    soil: p.soil * k * 0.6,
    erosion: p.soil * k * 0.4,
    income: p.income * k,
    simplicity: p.simplicity * k,
    climate: FIXED_WEIGHTS.climate,
    pest: FIXED_WEIGHTS.pest,
  };
}

function familyOf(id, cropsById) {
  return id === "fallow" ? "fallow" : cropsById[id].family;
}

/** Adjacent pairs on the cyclic sequence (a 1-year sequence pairs with itself). */
function pairs(seq) {
  return seq.map((id, i) => [id, seq[(i + 1) % seq.length]]);
}

export function scoreRotation(rot, ctx) {
  const { f, cropsById, farmer, terrain } = ctx;
  const seq = rot.sequence;
  const irrigated = farmer.irrigation === "irrigated";
  const reasons = [];
  const risks = [];

  // Optional second crop sown after the main harvest in the same year (by year index).
  const secondAt = (i) => {
    const id = rot.second_crops?.[i] ?? rot.second_crops?.[String(i)];
    return id && cropsById[id] && seq[i] !== "fallow" ? id : null;
  };
  const seconds = seq.map((_, i) => secondAt(i)).filter(Boolean);

  // ---- per crop-year water and climate
  const cropYears = seq
    .map((id, i) => ({ id, i, afterFallow: seq[(i - 1 + seq.length) % seq.length] === "fallow", second: secondAt(i) }))
    .filter((y) => y.id !== "fallow");

  const water = cropYears.map(({ id, afterFallow, second }) => {
    const crop = cropsById[id];
    if (irrigated) {
      const w = irrigationNeed(crop, f, afterFallow);
      if (!second) return { id, score: clamp(100 - w.deficit / 7), deficit: w.deficit, need: w.need, paddy: w.paddy ?? null, w };
      // The second crop starts after the harvest: no stored winter water left, so it adds its full irrigation need.
      const w2 = irrigationNeed(cropsById[second], f, false);
      const deficit = w.deficit + w2.deficit;
      return { id, second, score: clamp(100 - deficit / 7), deficit, need: w.need + w2.need, paddy: w.paddy ?? null, w };
    }
    const w = dryYearCoverage(crop, f, afterFallow);
    const main = { id, score: clamp(100 * Math.min(1, w.coverage)), coverage: w.coverage, need: w.need };
    if (!second) return main;
    const w2 = dryYearCoverage(cropsById[second], f, false);
    const sc = { id: second, secondOf: id, score: clamp(100 * Math.min(1, w2.coverage)), coverage: w2.coverage, need: w2.need };
    return sc.score < main.score ? sc : main; // the weaker crop limits the year
  });
  // Climate fit = share of past years without frost/heat damage at the sensitive
  // stage, reduced when the summer does not give enough heat units to mature.
  const climate = cropYears.map(({ id }) => {
    const crop = cropsById[id];
    const hist = climateHistory(crop, f);
    const heat = heatUnits(crop, f, sowingDoy(crop, f));
    return { id, ...hist, heat, okShare: hist.okShare * (heat ? Math.min(1, heat.ratio) : 1) };
  });
  // Second crops use their own sowing calendar here (an approximation, listed as a gap),
  // and must fit between the main harvest and the first autumn frost.
  const seasonFits = [];
  seq.forEach((mainId, i) => {
    const id = secondAt(i);
    if (!id) return;
    const crop = cropsById[id];
    const hist = climateHistory(crop, f);
    const heat = heatUnits(crop, f, sowingDoy(crop, f));
    const fit = secondCropFit(mainId, id, cropsById, f);
    if (fit && !fit.official) seasonFits.push({ id, mainId, ...fit });
    const seasonShare = fit && !fit.fits ? Math.max(0, fit.window / fit.need) : 1;
    climate.push({ id, ...hist, heat, okShare: hist.okShare * (heat ? Math.min(1, heat.ratio) : 1) * seasonShare });
  });

  // ---- calendar: bare soil and erosion
  const tl = rotationTimeline(seq, rot.second_crops, cropsById, f);
  const bare = bareStats(tl, f);
  const slope = terrain?.mean_slope_pct?.value;
  const slopeFactor = slope == null ? 1 : Math.min(3, 0.6 + slope / 5);
  const heavy = f.heavy_rain_days_per_year.value ?? 0;
  const erosionRisk = 100 * bare.rainOnBareShare * slopeFactor * (1 + heavy / 10);

  // ---- soil health per year
  const soilYears = seq.map((id, i) => {
    if (id === "fallow") return 15;
    const c = cropsById[id];
    let s = 50;
    if (c.is_legume) s += 30;
    if (c.id === "alfalfa" || c.id === "vetch") s += 5;
    if (c.root_depth_m[1] >= 1.5) s += 5;
    if (secondAt(i) && cropsById[secondAt(i)].is_legume) s += 10; // a legume second crop adds nitrogen too
    return Math.min(100, s);
  });
  const soil = clamp(mean(soilYears) - 3 * bare.bareMonthsPerYear);

  // ---- pest-cycle break
  // Plantings in time order: each year's main crop, then its second crop if any.
  const fams = seq.flatMap((id, i) => (secondAt(i) ? [familyOf(id, cropsById), familyOf(secondAt(i), cropsById)] : [familyOf(id, cropsById)]));
  const distinct = new Set(fams).size;
  const sameFamilyPairs = fams.length === 1 ? 1 : pairs(fams).filter(([a, b]) => a === b && a !== "fallow").length;
  const pest = clamp(30 + 70 * Math.min(1, (distinct - 1) / 2) - 25 * sameFamilyPairs);

  // ---- income: farmer's own rating per crop (no price data)
  const ratings = farmer.income_ratings ?? {};
  const share = (id) => ((ratings[id] ?? NEUTRAL_RATING) - 1) / 4;
  // A second crop adds half its rating to that year (it is smaller and later), capped at a full year.
  const rated = seq.map((id, i) => (id === "fallow" ? 0 : Math.min(1, share(id) + (secondAt(i) ? 0.5 * share(secondAt(i)) : 0))));
  const income = clamp(100 * mean(rated));

  // ---- simplicity: new crops compared with what the farmer already grows
  const known = new Set([...(farmer.current_sequence ?? []), ...(farmer.history ?? []), ...Object.values(farmer.current_second ?? {})]);
  const uniqueCrops = [...new Set([...seq.filter((id) => id !== "fallow"), ...seconds])];
  const newCrops = uniqueCrops.filter((id) => !known.has(id));
  const simplicity = clamp(100 - 25 * newCrops.length - 5 * Math.max(0, uniqueCrops.length - 2));

  const dimensions = {
    water: round(mean(water.map((w) => w.score)) ?? 100),
    climate: round(100 * (mean(climate.map((c) => c.okShare)) ?? 1)),
    soil: round(soil),
    erosion: round(clamp(100 - erosionRisk)),
    pest: round(pest),
    income: round(income),
    simplicity: round(simplicity),
  };

  // ---- sequence adjustment: sourced rotation rules when available
  let adj = 0;
  const ruleResult = ctx.ruleTable ? applyRotationRules(seq, cropsById, ctx.ruleTable) : null;
  if (ruleResult) {
    adj += ruleResult.adjustment;
  } else {
    for (const [a, b] of pairs(seq)) {
      if (a !== "fallow" && b !== "fallow" && cropsById[a].is_legume && cropsById[b].family === "poaceae") adj += 5;
    }
    adj -= 5 * sameFamilyPairs;
  }
  adj -= 3 * bare.longGaps;

  const w = weightsFrom(farmer.priorities);
  const weighted = Object.entries(w).reduce((s, [k, wk]) => s + wk * dimensions[k], 0);
  const score = round(clamp(weighted + adj));

  // ---- reasons (structured; text is built later by templates or AI)
  const period = f.monthly_rain_mm.period;
  if (water.length) {
    const worst = water.reduce((a, b) => (b.score < a.score ? b : a));
    const n = worst.second ? `${nameOf(worst.id, cropsById)} + second-crop ${nameOf(worst.second, cropsById)}` : nameOf(worst.id, cropsById);
    if (irrigated) {
      reasons.push({
        type: "water",
        evidence: worst.paddy
          ? `flooded ${n} needs about ${round(worst.deficit)} mm of irrigation in a normal year (about ${round(worst.deficit * 10)} m³ per hectare): the crop uses ~${round(worst.need)} mm and the basin loses ~${round(worst.paddy.total)} mm to soaking, the water layer and seepage; ${describePaddySoil(worst.w).text}`
          : irrigatedCardText(n, worst, cropsById, f),
        ...(worst.paddy || worst.deficit < 20 ? {} : { water: cardWater(worst, cropsById, f) }),
        source: worst.paddy ? describePaddySoil(worst.w).source : "NASA POWER",
        kind: "NASA reanalysis",
        effect: worst.deficit < 150 ? "positive" : worst.deficit > 400 ? "negative" : "neutral",
      });
      // Is the water source itself shrinking? NASA GRACE/GRACE-FO (irrigated fields only).
      const ws = waterSupply(f);
      if (ws) {
        reasons.push({ type: "water", evidence: ws.text, source: ws.source, kind: ws.kind, effect: ws.falling ? "negative" : ws.trend < -0.2 ? "neutral" : "positive" });
        if (ws.falling) {
          const thirsty = [...new Set(water.filter((y) => y.deficit > 400).map((y) => nameOf(y.id, cropsById)))];
          risks.push(
            `water stored underground and on land here has fallen about ${Math.abs(ws.trend)} cm a year (NASA GRACE): wells and reservoirs may become less reliable${thirsty.length ? `, a bigger risk for water-hungry ${thirsty.join(", ")}` : ""}`
          );
        }
      }
      for (const y of water.filter((y) => y.paddy)) {
        risks.push(`flooded ${nameOf(y.id, cropsById)} needs about ${round(y.deficit * 10)} m³ of water per hectare a season; check that your water allocation (DSİ or irrigation cooperative) covers it`);
      }
    } else {
      const pct = round(worst.coverage * 100);
      for (const id of seconds) {
        risks.push(`second-crop ${nameOf(id, cropsById)} relies on summer rain on a rain-fed field; it usually needs irrigation`);
      }
      reasons.push({
        type: "water",
        evidence: `in a dry year, rain and stored soil water cover ${Math.min(pct, 100)}% of ${n}'s water need (~${round(worst.need)} mm), ${period}`,
        source: "NASA POWER",
        kind: "NASA reanalysis",
        effect: pct >= 80 ? "positive" : pct < 60 ? "negative" : "neutral",
      });
      if (pct < 60) risks.push(`${n} may run short of water in dry years (${pct}% of need covered)`);

      // FAO EcoCrop's minimum annual rainfall for rain-fed growing, against a dry year here.
      const dryYear = f.annual_rain_dry_mm?.value;
      for (const id of [...new Set([...cropYears.map((y) => y.id), ...seconds])]) {
        const min = cropsById[id].rain_abs_mm?.[0];
        if (dryYear != null && min != null && dryYear < min) {
          const cn = nameOf(id, cropsById);
          reasons.push({
            type: "water",
            evidence: `in a dry year about ${dryYear} mm of rain falls here, below the ${min} mm a year that ${cn} needs as a rain-fed crop`,
            source: "NASA POWER + FAO EcoCrop",
            kind: "NASA reanalysis",
            effect: "negative",
          });
          risks.push(`dry-year rainfall (${dryYear} mm) is below FAO EcoCrop's minimum for rain-fed ${cn} (${min} mm)`);
        }
      }
    }
  }

  if (climate.length) {
    const worst = climate.reduce((a, b) => (b.badYears > a.badYears ? b : a));
    const n = nameOf(worst.id, cropsById);
    const parts = [];
    if (worst.frostYears) parts.push(`frost at flowering in ${worst.frostYears}`);
    if (worst.heatYears) parts.push(`heat at flowering in ${worst.heatYears}`);
    if (worst.winterYears) parts.push(`a too-cold winter in ${worst.winterYears}`);
    reasons.push({
      type: "climate",
      evidence: parts.length
        ? `${n}: ${parts.join(", ")} of the last ${worst.n} years`
        : `no damaging frost or heat at the sensitive stage of any crop in the last ${worst.n} years`,
      source: "NASA POWER",
      kind: "NASA reanalysis",
      effect: worst.badYears === 0 ? "positive" : worst.badYears / worst.n > 0.25 ? "negative" : "neutral",
    });
    if (worst.badYears >= 3) risks.push(`${n}: ${parts.join(", ")} of the last ${worst.n} years`);

    // Heat units: short of the need means maturity only in warm years or with a short-season variety.
    for (const c of climate.filter((x) => x.heat && x.heat.ratio < 1)) {
      const cn = nameOf(c.id, cropsById);
      const pct = round(c.heat.ratio * 100);
      reasons.push({
        type: "climate",
        evidence: `${cn}: the summer gives about ${c.heat.available} heat units above ${c.heat.base} °C before ${c.heat.endsAtFrost ? "the first autumn frost" : "the season ends"}, ${pct}% of what a typical variety needs (${c.heat.required})`,
        source: "NASA POWER + FAO AquaCrop",
        kind: "NASA reanalysis",
        effect: "negative",
      });
      risks.push(`${cn} may only mature in warm years or with a short-season variety (${pct}% of the heat it needs)`);
    }
  }

  // Second crops that do not fit the season after the main harvest.
  for (const s of seasonFits) {
    const sn = nameOf(s.id, cropsById);
    const mn = nameOf(s.mainId, cropsById);
    const left = Math.max(0, s.window);
    reasons.push({
      type: "climate",
      evidence: s.fits
        ? `second-crop ${sn}: about ${left} days between the ${mn} harvest and the first autumn frost, enough for the ~${s.need} days it needs`
        : `second-crop ${sn}: only about ${left} days between the ${mn} harvest and the first autumn frost, but it needs ~${s.need} days`,
      source: "NASA POWER + crop calendar",
      kind: "NASA reanalysis",
      effect: s.fits ? "positive" : "negative",
    });
    if (!s.fits) risks.push(`the season is too short here for second-crop ${sn} after ${mn} (${left} of ~${s.need} days before the first autumn frost); it may not mature`);
  }

  const legumes = [...seq, ...seconds].filter((id) => id !== "fallow" && cropsById[id].is_legume);
  const fallows = seq.filter((id) => id === "fallow").length;
  reasons.push({
    type: "soil",
    evidence: legumes.length
      ? `${[...new Set(legumes.map((id) => nameOf(id, cropsById)))].join(" and ")} ${legumes.length > 1 ? "are legumes that add" : "is a legume that adds"} nitrogen to the soil`
      : fallows
        ? `${fallows} fallow year${fallows > 1 ? "s" : ""} and no legume: nothing adds nitrogen`
        : "no legume in the rotation to add nitrogen",
    source: "crop table",
    kind: "compiled rule",
    effect: legumes.length ? "positive" : "negative",
  });

  reasons.push({
    type: "erosion",
    evidence:
      `soil is bare about ${round(bare.bareMonthsPerYear, 1)} months a year; ${round(bare.rainOnBareShare * 100)}% of the yearly rain falls on bare soil` +
      (slope != null ? `; field slope ${slope}%` : ""),
    source: slope != null ? "crop calendar + NASA POWER + SRTM" : "crop calendar + NASA POWER",
    kind: "compiled rule",
    effect: dimensions.erosion >= 70 ? "positive" : dimensions.erosion < 45 ? "negative" : "neutral",
  });
  if (dimensions.erosion < 45) risks.push("long bare periods in the rainy season raise erosion risk");

  reasons.push({
    type: "pest",
    evidence:
      `${distinct} crop famil${distinct === 1 ? "y" : "ies"} in ${seq.length} year${seq.length > 1 ? "s" : ""}` +
      (sameFamilyPairs ? `; the same family follows itself ${sameFamilyPairs} time${sameFamilyPairs > 1 ? "s" : ""}` : ""),
    source: "crop table",
    kind: "compiled rule",
    effect: sameFamilyPairs ? "negative" : distinct >= 3 ? "positive" : "neutral",
  });
  if (ruleResult) {
    for (const h of ruleResult.hits) {
      reasons.push({
        type: h.type,
        evidence: h.text,
        source: shortSource(h.rule.source),
        kind: "compiled rule",
        effect: h.points < 0 ? "negative" : "positive",
      });
      if (h.points < 0) risks.push(h.text);
    }
    if (ruleResult.genericSameFamily) risks.push("same crop family back to back can build up pests and diseases");
  } else if (sameFamilyPairs) risks.push("same crop family back to back can build up pests and diseases");

  // Nutrient balance (information; it does not change the score yet).
  const nutrients = nutrientBalance(seq, rot.second_crops, ctx.nutrientTable, ctx.localYields);
  if (nutrients) {
    const parts = [`harvests remove about ${nutrients.n_removed} kg N, ${nutrients.p2o5_removed} kg P2O5 and ${nutrients.k2o_removed} kg K2O per hectare a year`];
    if (nutrients.n_fixed > 0) {
      parts.push(`legumes fix about ${nutrients.n_fixed} kg N, so the nitrogen balance is ${nutrients.n_net >= 0 ? "+" : ""}${nutrients.n_net} kg`);
    } else parts.push("nothing in the rotation adds nitrogen");
    reasons.push({
      type: "soil",
      evidence: parts.join("; "),
      source: `${nutrients.yields_local.length ? "TÜİK province yields" : "FAOSTAT yields"} + Ludemann 2023 + Herridge 2008`,
      kind: "compiled rule",
      effect: nutrients.n_net >= 0 ? "positive" : nutrients.n_net < -40 ? "negative" : "neutral",
    });
  }

  const hasRatings = Object.keys(ratings).length > 0;
  reasons.push({
    type: "income",
    evidence: hasRatings
      ? `average of your own crop ratings: ${round(1 + 4 * mean(rated), 1)} out of 5`
      : `no crop ratings given, so every crop counts as ${NEUTRAL_RATING}/5${fallows ? " and fallow years earn nothing" : ""}`,
    source: hasRatings ? "farmer" : "default",
    kind: hasRatings ? "farmer input" : "compiled rule",
    effect: "neutral",
  });

  if (newCrops.length) {
    reasons.push({
      type: "simplicity",
      evidence: `new to your farm: ${newCrops.map((id) => nameOf(id, cropsById)).join(", ")}`,
      source: "farmer",
      kind: "farmer input",
      effect: "negative",
    });
  }

  return { dimensions, sequence_adjustment: adj, score, reasons, risks, bare, water, climate, nutrients };
}

/** Irrigated card: amount per dekar and hectare, share covered by rain, and (single crop) the peak months. */
function cardWater(worst, cropsById, f) {
  const covered = worst.need > 0 ? Math.max(0, Math.min(100, round(((worst.need - worst.deficit) / worst.need) * 100))) : 100;
  const d = waterData("irrigate", cropsById[worst.id], f, { need: worst.need, mm: worst.deficit, covered, peaks: !worst.second });
  if (worst.second) d.crop_tr = `${d.crop_tr} + ${cropsById[worst.second].name_tr.split(" (")[0]}`;
  return d;
}

function irrigatedCardText(n, worst, cropsById, f) {
  const d = cardWater(worst, cropsById, f);
  const peak = peaksWords(d.peaks);
  return `${n} needs about ${amountText(worst.deficit)} of irrigation in a normal year: the crop uses ~${round(worst.need)} mm and rain plus stored soil water cover about ${d.covered}%${peak ? `; ${peak}` : ""}`;
}
