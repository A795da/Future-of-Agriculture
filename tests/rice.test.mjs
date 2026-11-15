// Rice (paddy): flooded-basin water losses on top of crop water use, irrigated only,
// and only where TÜİK shows a paddy area (the proxy for a river or canal supply).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { checkCrop, OBSERVED_MIN_HA } from "../web/src/scoring/filter.js";
import { irrigationNeed, paddyLosses } from "../web/src/scoring/agronomy.js";
import { runCropCheck, validateCheck } from "../web/src/scoring/cropCheck.js";
import { runScoring } from "../web/src/scoring/index.js";
import { validateResult } from "../web/src/scoring/contract.js";
import { matchCrop } from "../web/src/scoring/aliases.js";
import { zoneCalendar } from "../web/src/scoring/calendar.js";
import { localYields } from "../web/src/scoring/yields.js";
import { withSowingCalendar } from "../web/src/data/loader.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, "web/public/data", p), "utf8"));
const cropTable = J("crops.json");
const byId = Object.fromEntries(cropTable.crops.map((c) => [c.id, c]));
const tagem = J("tagem_calendar.json");
const plist = J("provinces.json");
const tuik = J("tuik_yields.json");
const tables = { cropTable, rotationTable: J("rotations.json"), ruleTable: J("rotation_rules.json"), nutrientTable: J("nutrients.json") };
const features = (id, irrigation = "irrigated") => {
  const raw = J(`cache/${id}/features.json`);
  return withSowingCalendar(raw.features ?? raw, plist.find((p) => p.id === id), tagem, irrigation);
};
const irrigated = { irrigation: "irrigated", never_grow: [] };
// TÜİK rice statistics for a province: real ones when the export is loaded, else a stand-in.
const riceLocal = (province, planted_ha) => {
  if (tuik.crops.rice) return localYields(tuik, province, "irrigated");
  return { province, irrigation: "irrigated", years: "2020-2024", covered: new Set(["rice"]), crops: planted_ha ? { rice: { first: { t_ha: 8, years: 5, planted_ha }, second: null } } : {} };
};

test("rice is wired into the tables with sources", () => {
  const rice = byId.rice;
  assert.ok(rice && rice.rainfed_ok === false && rice.verified === false);
  assert.match(rice.paddy.source, /Training Manual 3/);
  assert.match(rice.field_sources.paddy, /Note 2/, "TAGEM's own note that its rice figures exclude basin losses");
  assert.match(rice.heat_units.source, /PaddyRiceGDD/);
  assert.ok(J("nutrients.json").crops.rice.yield_t_ha > 5, "FAOSTAT paddy yield");
  assert.equal(zoneCalendar("rice", features("edirne"))?.use, "full", "TAGEM lists çeltik for the Edirne zone");
  for (const w of ["çeltik", "celtik", "pirinç", "rice"]) assert.equal(matchCrop(w, cropTable.crops).crop?.id, "rice", w);
  assert.ok(tables.rotationTable.rotations.some((r) => r.sequence.length === 1 && r.sequence[0] === "rice"));
});

test("paddy water: soaking, water layer and seepage are added to crop water use", () => {
  const f = features("edirne");
  const p = paddyLosses(byId.rice, f);
  assert.equal(p.total, 200 + 100 + 6 * p.days);
  assert.ok(p.range[0] < p.total && p.total < p.range[1], "heavy clay < average < sandy");
  const rice = irrigationNeed(byId.rice, f);
  const maize = irrigationNeed(byId.maize, f);
  assert.equal(rice.stored, 0, "no stored-soil-water credit for a flooded basin (soaking is counted)");
  assert.ok(rice.deficit > rice.need, "irrigation exceeds crop use because of basin losses");
  assert.ok(rice.deficit > 3 * maize.deficit, `rice ${rice.deficit} vs maize ${maize.deficit}`);
  assert.ok(rice.deficit > 1300 && rice.deficit < 2800, `plausible Thrace paddy irrigation, got ${Math.round(rice.deficit)} mm`);
  assert.equal(maize.paddy, undefined, "other crops unchanged");
});

test("rice needs irrigation and a paddy area (TÜİK) in the province", () => {
  const f = features("edirne");
  assert.equal(checkCrop(byId.rice, features("edirne", "rainfed"), { irrigation: "rainfed", never_grow: [] }).ok, false);
  const noData = checkCrop(byId.rice, f, irrigated, null);
  assert.equal(noData.ok, false);
  assert.ok(noData.details.some((d) => d.check === "paddy_area" && d.evidence.includes("no TÜİK rice statistics")));
  const grown = checkCrop(byId.rice, f, irrigated, riceLocal("edirne", 20000));
  assert.equal(grown.ok, true, grown.reasons.join("; "));
  if (!tuik.crops.rice) {
    const small = checkCrop(byId.rice, f, irrigated, riceLocal("edirne", OBSERVED_MIN_HA - 1));
    assert.ok(small.details.some((d) => d.check === "paddy_area" && d.evidence.includes("only about")));
  }
  // Konya: TÜİK shows no paddy area, so irrigated rice is removed there.
  const konya = checkCrop(byId.rice, features("konya"), irrigated, riceLocal("konya", 0));
  assert.equal(konya.ok, false);
});

test("crop check and rotation cards say how much water flooded rice needs", () => {
  const local = riceLocal("edirne", 20000);
  const r = runCropCheck({ cropId: "rice", previous: ["rice", "rice", "rice"], features: features("edirne"), ...tables, localYields: local, farmer: irrigated, dataStatus: { power: true } });
  assert.deepEqual(validateCheck(r), []);
  assert.notEqual(r.verdict, "not_reasonable", JSON.stringify(r.reasons.filter((x) => x.level === "blocker")));
  const water = r.reasons.find((x) => x.type === "water");
  assert.match(water.evidence, /m³ per hectare/);
  assert.match(water.evidence, /heavy clay/);
  assert.ok(r.risks.some((x) => x.includes("DSİ")));
  // Edirne is the main rice province: heat at flowering must not be flagged most years.
  const heat = r.reasons.find((x) => x.type === "climate" && x.evidence.startsWith("rice:"));
  assert.ok(!heat || heat.level !== "caution", heat?.evidence);

  const { results } = runScoring({
    features: features("edirne"), ...tables, localYields: local,
    farmer: { region: "marmara", irrigation: "irrigated", current_sequence: ["rice"], history: ["rice"], priorities: {}, never_grow: [] },
    dataStatus: { power: true },
  });
  const base = results.find((x) => x.is_baseline);
  assert.equal(base.label, "rice");
  assert.ok(base.reasons.some((x) => x.type === "water" && x.evidence.includes("flooded")), JSON.stringify(base.reasons));
  assert.ok(base.risks.some((x) => x.includes("m³")));
  for (const x of results) assert.deepEqual(validateResult(x), []);
});

test("rice seepage follows soil texture: farmer choice first, then NASA HWSD, else the average", async () => {
  const { textureClass, withSoilTexture } = await import("../web/src/data/loader.js");
  assert.equal(textureClass(45, 20), "clay");
  assert.equal(textureClass(10, 80), "sandy");
  assert.equal(textureClass(25, 40), "loam");
  assert.equal(textureClass(null, 40), null);
  const point = plist.find((p) => p.id === "edirne");
  const base = features("edirne");
  const hwsd = { _meta: { short: "NASA ORNL DAAC regridded HWSD v1.2" }, provinces: { edirne: { clay: 46, sand: 22 } } };
  const days = paddyLosses(byId.rice, base).days;

  const unknown = paddyLosses(byId.rice, withSoilTexture(base, point, null, "unknown"));
  assert.equal(unknown.perc_mm_day, 6);
  assert.equal(unknown.soil, null);
  const fromMap = withSoilTexture(base, point, hwsd, "unknown");
  assert.equal(fromMap.soil_texture.kind, "model estimate");
  assert.equal(paddyLosses(byId.rice, fromMap).perc_mm_day, 4, "46% clay → heavy clay → 4 mm/day (FAO)");
  const sandy = paddyLosses(byId.rice, withSoilTexture(base, point, hwsd, "sandy"));
  assert.equal(sandy.perc_mm_day, 8, "the farmer's choice overrides the map");
  assert.equal(sandy.total - paddyLosses(byId.rice, fromMap).total, 4 * days);

  const local = riceLocal("edirne", 20000);
  const r = runCropCheck({ cropId: "rice", previous: ["rice"], features: fromMap, ...tables, localYields: local, farmer: irrigated, dataStatus: { power: true } });
  const water = r.reasons.find((x) => x.type === "water");
  assert.match(water.evidence, /NASA HWSD: 46% clay, 22% sand/);
  assert.match(water.source, /NASA HWSD/);
  assert.deepEqual(validateCheck(r), []);
  // other crops ignore soil texture
  assert.equal(irrigationNeed(byId.maize, fromMap).deficit, irrigationNeed(byId.maize, base).deficit);
});

test("climate outlook keeps climate fit apart from water supply, today and with +2/+3 °C", async () => {
  const { climateOutlook, OUTLOOK_WARMING_C } = await import("../web/src/scoring/outlook.js");
  assert.deepEqual(OUTLOOK_WARMING_C, [2, 3]);
  const edirne = climateOutlook(byId.rice, features("edirne"));
  assert.ok(edirne.today.fit, "Edirne fits rice today");
  assert.ok(edirne.warmer.some((w) => !w.fit && w.why === "hot_flowering"), "heat at flowering with warming");
  const kars = climateOutlook(byId.rice, features("kars"));
  assert.equal(kars.today.fit, false);
  assert.equal(kars.today.why, "too_cool");
  assert.ok(kars.warmer.some((w) => w.fit), "warming makes the Kars summer long enough");
  assert.equal(climateOutlook(byId.rice, features("samsun")).changes, false);

  // Crop check: Kars is blocked by climate today; the outlook says what would change, and that water is separate.
  const kc = runCropCheck({ cropId: "rice", previous: [], features: features("kars"), ...tables, localYields: riceLocal("kars", 0), farmer: irrigated, dataStatus: { power: true } });
  const line = kc.reasons.find((x) => x.evidence.startsWith("climate outlook"));
  assert.ok(line && line.level === "info", JSON.stringify(kc.reasons));
  assert.match(line.evidence, /not a forecast/);
  assert.match(line.evidence, /river or canal supply/);
  // Edirne with a paddy area: warming risk on the crop check and on the rice card.
  const local = riceLocal("edirne", 20000);
  const ec = runCropCheck({ cropId: "rice", previous: ["rice"], features: features("edirne"), ...tables, localYields: local, farmer: irrigated, dataStatus: { power: true } });
  assert.ok(ec.risks.some((x) => x.includes("warming")), ec.risks.join(" | "));
  assert.deepEqual(validateCheck(ec), []);
  const { results } = runScoring({
    features: features("edirne"), ...tables, localYields: local,
    farmer: { region: "marmara", irrigation: "irrigated", current_sequence: ["rice"], history: ["rice"], priorities: {}, never_grow: [] },
    dataStatus: { power: true },
  });
  assert.ok(results.find((x) => x.is_baseline).risks.some((x) => x.includes("warming")));
  // Other crops get no outlook line (keeps their results and the AI cache unchanged).
  const wheat = runCropCheck({ cropId: "wheat", previous: [], features: features("edirne"), ...tables, farmer: irrigated, dataStatus: { power: true } });
  assert.ok(!wheat.reasons.some((x) => x.evidence.startsWith("climate outlook")));
});
