// Build web/public/data/rotation_rules.json from data/sources/rotation_rules.csv.
// Usage: node scripts/build_rotation_rules.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const text = fs.readFileSync(path.join(ROOT, "data/sources/rotation_rules.csv"), "utf8").replace(/^\uFEFF/, "");
const rows = [];
let row = [], f = "", q = false;
for (let i = 0; i < text.length; i++) {
  const c = text[i];
  if (q) { if (c === '"' && text[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
  else if (c === '"') q = true;
  else if (c === ",") { row.push(f); f = ""; }
  else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
  else if (c !== "\r") f += c;
}
if (f || row.length) { row.push(f); rows.push(row); }
const [head, ...body] = rows.filter((r) => r.length > 1);
const crops = JSON.parse(fs.readFileSync(path.join(ROOT, "web/public/data/crops.json"), "utf8"));
const ids = new Set(crops.crops.map((c) => c.id));
const families = new Set(Object.keys(crops.families));

const rules = body.map((r) => {
  const o = Object.fromEntries(head.map((k, i) => [k, r[i]]));
  const rule = {
    id: o.rule_id, type: o.type, target: o.target, previous: o.previous || null,
    min_gap_years: o.min_gap_years ? +o.min_gap_years : null, points: +o.points,
    reason: o.reason, source: o.source, url: o.url,
  };
  const known = (x) => ids.has(x) || families.has(x);
  if (!["min_gap", "family_repeat", "after"].includes(rule.type)) throw new Error(`${rule.id}: bad type`);
  if (!known(rule.target) || (rule.previous && !known(rule.previous))) throw new Error(`${rule.id}: unknown crop or family`);
  if (rule.type === "min_gap" && !(rule.min_gap_years >= 2)) throw new Error(`${rule.id}: min_gap_years missing`);
  if (!rule.source || !rule.url) throw new Error(`${rule.id}: every rule needs a source and URL`);
  return rule;
});
fs.writeFileSync(path.join(ROOT, "web/public/data/rotation_rules.json"),
  JSON.stringify({ source_file: "data/sources/rotation_rules.csv", rules }, null, 1));
console.log(`${rules.length} rules: ${rules.map((r) => r.id).join(", ")}`);
