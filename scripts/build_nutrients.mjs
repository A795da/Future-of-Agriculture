// Build web/public/data/nutrients.json: per crop, the Türkiye average yield
// (FAOSTAT 2020-2024), nutrients removed per tonne of harvested product and of
// crop residue (Ludemann et al. 2023, Tier 1 world values), and nitrogen fixed by
// legumes (Herridge, Peoples & Boddey 2008 method).
//
// Usage: node scripts/build_nutrients.mjs
// Reads:  data/sources/{faostat_turkey_yields,ludemann2023_Tier_1_and_2_crop_coefficients,
//         nutrient_crop_map,fixation}.csv
// Writes: web/public/data/nutrients.json

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const YEARS = [2020, 2021, 2022, 2023, 2024];

function readCsv(file) {
  const text = fs.readFileSync(path.join(ROOT, "data/sources", file), "utf8").replace(/^﻿/, "");
  const rows = [];
  let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { f += '"'; i++; }
      else if (c === '"') q = false;
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
    else if (c !== "\r") f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.length > 1);
  return body.map((r) => Object.fromEntries(head.map((k, i) => [k, r[i]])));
}

const num = (v) => (v === undefined || v === "" || v === "NA" ? null : +v);
const round = (v, d = 1) => (v == null ? null : +v.toFixed(d));

const faostat = readCsv("faostat_turkey_yields.csv");
const ludemann = readCsv("ludemann2023_Tier_1_and_2_crop_coefficients.csv").filter((r) => r.tier === "1");
const map = readCsv("nutrient_crop_map.csv");
const fixation = Object.fromEntries(readCsv("fixation.csv").map((r) => [r.crop_id, r]));

const out = {
  sources: {
    yield: "FAOSTAT QCL, Türkiye, yield (kg/ha), mean of 2020-2024 (CC BY 4.0)",
    nutrients: "Ludemann et al. 2023, Global data on crop nutrient concentration and harvest indices, Dryad doi:10.5061/dryad.n2z34tn0x, Tier 1 world values (CC0)",
    fixation: "Herridge, Peoples & Boddey 2008, Plant and Soil 311:1-18 (method and parameters); alfalfa per year from Smil 1999 as cited there",
  },
  units: "yield t/ha; nutrients kg per tonne fresh weight; P and K as elements (P2O5 = P x 2.291, K2O = K x 1.205); fixation kg N/ha per crop (alfalfa per year)",
  crops: {},
};

for (const m of map) {
  const entry = { note: m.note || null };
  if (m.faostat_item) {
    const vals = faostat
      .filter((r) => r.Item === m.faostat_item && YEARS.includes(+r.Year) && r.Unit === "kg/ha")
      .map((r) => +r.Value);
    if (!vals.length) throw new Error(`no FAOSTAT yield for ${m.faostat_item}`);
    entry.yield_t_ha = round(vals.reduce((a, b) => a + b, 0) / vals.length / 1000, 2);
    entry.yield_years = `${YEARS[0]}-${YEARS.at(-1)} (${vals.length} years)`;
  }
  if (m.ludemann_item) {
    const part = (component) => {
      const r = ludemann.find((x) => x.item === m.ludemann_item && x.crop_component === component);
      return r
        ? { N: round(num(r.N_kg_per_t_fresh_wt), 2), P: round(num(r.P_kg_per_t_fresh_wt), 2), K: round(num(r.K_kg_per_t_fresh_wt), 2), HI: round(num(r.HI), 3) }
        : null;
    };
    entry.product = part("Crop_products");
    entry.residue = part("Crop_residues");
    if (!entry.product) throw new Error(`no Ludemann product row for ${m.ludemann_item}`);
  }
  const fx = fixation[m.crop_id];
  if (fx) {
    if (fx.method === "per_year") {
      entry.fixed_kg_n_ha = num(fx.fixed_kg_n_ha_yr);
    } else {
      const shootDm = entry.yield_t_ha / num(fx.harvest_index); // t/ha
      const shootN = shootDm * 1000 * (num(fx.shoot_n_pct) / 100); // kg N/ha
      entry.fixed_kg_n_ha = round(shootN * num(fx.belowground_factor) * num(fx.ndfa), 0);
    }
    entry.fixation_method = fx.method;
    entry.fixation_source = fx.source;
  }
  out.crops[m.crop_id] = entry;
}

fs.writeFileSync(path.join(ROOT, "web/public/data/nutrients.json"), JSON.stringify(out, null, 1));
for (const [id, c] of Object.entries(out.crops)) {
  const rem = c.product && c.yield_t_ha ? `removes N ${round(c.yield_t_ha * c.product.N, 0)} P2O5 ${round(c.yield_t_ha * c.product.P * 2.291, 0)} K2O ${round(c.yield_t_ha * c.product.K * 1.205, 0)} kg/ha` : "removal n/a";
  console.log(`${id.padEnd(14)} yield ${String(c.yield_t_ha ?? "-").padStart(6)} t/ha · ${rem}${c.fixed_kg_n_ha != null ? ` · fixes ${c.fixed_kg_n_ha} kg N/ha` : ""}`);
}
