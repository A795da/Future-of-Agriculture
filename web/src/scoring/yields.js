// Local yields from TÜİK province statistics (web/public/data/tuik_yields.json):
// per crop, the 5-year average for this province and water regime. Used for the
// nutrient numbers instead of the national FAOSTAT yield, and as "grown here"
// evidence in the crop check. Falls back to nothing (national values) when TÜİK
// has no figure.

/**
 * @returns {{ province, irrigation, years, covered: Set<string>, crops: Object<string, {first?, second?, rainfedArea?}> } | null}
 */
export function localYields(tuikTable, provinceId, irrigation) {
  if (!tuikTable?.crops || !provinceId) return null;
  const water = irrigation === "irrigated" ? "irrigated" : "rainfed";
  const crops = {};
  const split = new Set(); // crops with rain-fed / irrigated figures
  for (const [crop, byProv] of Object.entries(tuikTable.crops)) {
    if (Object.values(byProv).some((p) => p.rainfed || p.irrigated)) split.add(crop);
    const here = byProv[provinceId];
    // Water-specific figures first; else the unsplit Tahıllar table ("all": rain-fed
    // and irrigated together), flagged `mixed` so it never counts as proof that the
    // crop is grown under this water regime.
    const w = here?.[water] ?? here?.all;
    if (!w) continue;
    crops[crop] = {
      first: w.first ?? null, // { t_ha, years, planted_ha? }
      second: w.second ?? null,
      mixed: !here?.[water],
    };
  }
  return {
    province: provinceId,
    irrigation: water,
    years: tuikTable._meta?.period ?? "",
    covered: split, // crops with water-specific figures (for "no rain-fed X here")
    coveredAll: new Set(Object.keys(tuikTable.crops)), // crops TÜİK reports at all
    crops,
  };
}

/** Yield in t/ha for a crop as main or second crop, with its source; null when TÜİK has none. */
export function localYield(local, cropId, asSecond = false) {
  const e = local?.crops?.[cropId];
  const v = asSecond ? e?.second ?? null : e?.first ?? null;
  return v ? { t_ha: v.t_ha, years: v.years, planted_ha: v.planted_ha ?? null, mixed: Boolean(e.mixed) } : null;
}
