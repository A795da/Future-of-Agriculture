// Glossary terms and farmer income ratings.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { GLOSSARY, splitGlossary } from "../web/src/explain/glossary.js";
import { runScoring } from "../web/src/scoring/index.js";
import { withSowingCalendar } from "../web/src/data/loader.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, "web/public/data", p), "utf8"));

test("glossary covers the terms the brief names and finds them in evidence text", () => {
  const ids = GLOSSARY.map((g) => g.id);
  for (const id of ["ndvi", "et", "dry-year", "reanalysis", "confidence"]) assert.ok(ids.includes(id), id);
  for (const g of GLOSSARY) assert.ok(g.text.length > 40 && g.term, g.id);
  const parts = splitGlossary("in a dry year, rain and stored soil water cover 39% of wheat's water need (~486 mm)");
  assert.deepEqual(
    parts.filter((p) => typeof p !== "string").map((p) => p.id),
    ["et", "dry-year", "stored-water"].sort((a, b) => parts.findIndex((p) => p.id === a) - parts.findIndex((p) => p.id === b))
  );
  assert.equal(parts.map((p) => (typeof p === "string" ? p : p.text)).join(""), "in a dry year, rain and stored soil water cover 39% of wheat's water need (~486 mm)");
  assert.deepEqual(splitGlossary("no terms here"), ["no terms here"]);
});

test("income ratings move the Income score and are labelled as the farmer's own", () => {
  const provinces = J("provinces.json");
  const point = (provinces.provinces ?? provinces).find((p) => p.id === "konya");
  const raw = J("cache/konya/features.json");
  const features = withSowingCalendar(raw.features ?? raw, point, J("tagem_calendar.json"), "rainfed");
  const run = (ratings) =>
    runScoring({
      features,
      cropTable: J("crops.json"),
      rotationTable: J("rotations.json"),
      farmer: { region: point.region, irrigation: "rainfed", current_sequence: ["wheat", "fallow"], history: ["wheat", "fallow"], priorities: { water: 50, soil: 50, income: 50, simplicity: 50 }, never_grow: [], income_ratings: ratings },
      dataStatus: { power: true },
    }).results[0];
  const none = run({});
  const high = run({ wheat: 5 });
  const low = run({ wheat: 1 });
  assert.equal(none.dimensions.income, 25, "wheat 3/5 and a fallow year");
  assert.ok(high.dimensions.income > none.dimensions.income && low.dimensions.income < none.dimensions.income);
  assert.ok(high.reasons.some((r) => r.type === "income" && r.kind === "farmer input"));
  assert.ok(none.reasons.some((r) => r.type === "income" && r.kind === "compiled rule"));
});
