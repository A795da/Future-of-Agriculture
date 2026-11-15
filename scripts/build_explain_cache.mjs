// Pre-write the AI explanations a first-time visitor sees in the demo provinces
// (rotation cards with the default inputs, and a few crop checks), in English and
// Turkish, so the demo never depends on the network or an API key.
//
// Usage (needs GEMINI_API_KEY or ANTHROPIC_API_KEY; read from web/.env.local):
//   node scripts/build_explain_cache.mjs [provinceId ...]
// Output: web/public/data/explain_cache.json (only texts that pass the number check)
//
// The facts are built with the same functions as the app (scoring/defaults.js,
// explain/payload.js), so the cache keys match the app's requests exactly.
// Today-tab texts are not cached: they depend on the live forecast.

import fs from "node:fs";
import path from "node:path";
import { explainWith, makeProvider } from "../web/api/explain.js";
import { withSoilTexture, withSowingCalendar, withWaterStorage } from "../web/src/data/loader.js";
import { cardSummary, checkSummary } from "../web/src/explain/templates.js";
import { cacheKey, checkFacts, rotationFacts } from "../web/src/explain/payload.js";
import { runCropCheck } from "../web/src/scoring/cropCheck.js";
import { DEFAULT_INPUTS, defaultRotation, previousFromRotation } from "../web/src/scoring/defaults.js";
import { runScoring } from "../web/src/scoring/index.js";
import { shortName } from "../web/src/scoring/names.js";
import { localYields as buildLocalYields } from "../web/src/scoring/yields.js";

const DEMO = ["konya", "edirne", "adana", "sanliurfa", "erzurum"];
const CHECKS = ["sunflower", "chickpea", "wheat", "maize"];
const LANGS = ["en", "tr"];

const ROOT = path.resolve(import.meta.dirname, "..");
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, "web/public/data", p), "utf8"));
const OUT = path.join(ROOT, "web/public/data/explain_cache.json");

// Read web/.env.local (same file the dev server uses) without printing anything from it.
const envFile = path.join(ROOT, "web/.env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith("#") && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const provider = await makeProvider();
if (!provider) {
  console.error("No AI key found. Put GEMINI_API_KEY (or ANTHROPIC_API_KEY) in web/.env.local; see web/.env.example.");
  process.exit(1);
}
console.log(`Provider: ${provider.name}, model ${provider.model}`);
// Free tiers allow only a few requests a minute: space the calls out.
const PAUSE_MS = provider.name === "gemini" ? 6500 : 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const tables = {
  cropTable: J("crops.json"),
  rotationTable: J("rotations.json"),
  nutrientTable: J("nutrients.json"),
  ruleTable: J("rotation_rules.json"),
  tagem: J("tagem_calendar.json"),
};
const tuikYields = fs.existsSync(path.join(ROOT, "web/public/data/tuik_yields.json")) ? J("tuik_yields.json") : null;
const provinces = J("provinces.json");
const plist = provinces.provinces ?? provinces;
const cropsById = Object.fromEntries(tables.cropTable.crops.map((c) => [c.id, c]));
const nameOf = (id) => (id === "fallow" ? "fallow" : shortName(cropsById[id]));

const cache = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
cache.entries ??= {};
let added = 0, kept = 0, failed = 0;

async function fill(kind, facts, label) {
  for (const lang of LANGS) {
    const key = cacheKey(kind, lang, facts);
    if (cache.entries[key]) {
      kept++;
      continue;
    }
    let out = await explainWith(provider, { kind, lang, facts });
    if (out.status === 429) {
      console.log("  … rate limited, waiting 60 s");
      await sleep(60000);
      out = await explainWith(provider, { kind, lang, facts });
    }
    await sleep(PAUSE_MS);
    if (out.status === 200) {
      cache.entries[key] = { text: out.json.text, kind, lang, label, model: out.json.model };
      added++;
      console.log(`  ✓ ${lang} ${label}`);
    } else {
      failed++;
      console.log(`  ✗ ${lang} ${label}: ${out.json.error}${out.json.unknown ? ` (${out.json.unknown.join(", ")})` : ""}`);
      if (out.status === 503) {
        console.error("The key was rejected or the model is not available; stopping.");
        process.exit(1);
      }
    }
  }
}

const ids = process.argv.slice(2).length ? process.argv.slice(2) : DEMO;
for (const id of ids) {
  const point = plist.find((p) => p.id === id);
  const raw = J(`cache/${id}/features.json`);
  const base = raw.features ?? raw;
  const current = defaultRotation(tables, point.region, withSowingCalendar(base, point, tables.tagem, "rainfed"));
  const inputs = { ...DEFAULT_INPUTS, current };
  const soilTexture = fs.existsSync(path.join(ROOT, "web/public/data/soil_texture.json")) ? J("soil_texture.json") : null;
  const waterStorage = fs.existsSync(path.join(ROOT, "web/public/data/water_storage.json")) ? J("water_storage.json") : null;
  const features = withWaterStorage(withSoilTexture(withSowingCalendar(base, point, tables.tagem, inputs.irrigation), point, soilTexture, inputs.soil), point, waterStorage); // same as the app
  console.log(`${point.name}: ${current.join(" > ")}`);
  const localYields = buildLocalYields(tuikYields, point.id, inputs.irrigation); // same as the app

  const { results } = runScoring({
    features,
    terrain: null,
    vegetation: null,
    ...tables,
    localYields,
    farmer: {
      region: point.region,
      irrigation: inputs.irrigation,
      current_sequence: inputs.current,
      history: inputs.current,
      priorities: inputs.priorities,
      never_grow: inputs.never,
    },
    scenario: { rainPct: 0, tempC: 0 },
    dataStatus: { power: true, soil: false },
  });
  const baseline = results.find((r) => r.is_baseline) ?? null;
  for (const r of results) {
    const b = r.is_baseline ? undefined : baseline;
    await fill("rotation", rotationFacts(r, b, cardSummary(r, b)), `${id} ${r.label}`);
  }

  const previous = previousFromRotation(inputs.current, 3);
  for (const cropId of CHECKS) {
    const r = runCropCheck({
      cropId,
      previous,
      features,
      ...tables,
      localYields,
      farmer: { irrigation: inputs.irrigation, never_grow: inputs.never },
      dataStatus: { power: true, soil: false },
    });
    await fill("check", checkFacts(r, nameOf, checkSummary(r, nameOf)), `${id} check ${cropId}`);
  }
}

cache.model = provider.model;
cache.generated = new Date().toISOString().slice(0, 10);
cache.note = "Written by scripts/build_explain_cache.mjs; every text passed the number check.";
fs.writeFileSync(OUT, JSON.stringify(cache, null, 1));
console.log(`\n${added} new, ${kept} already cached, ${failed} failed (template text is shown for those).`);
