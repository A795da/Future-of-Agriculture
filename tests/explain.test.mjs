// AI layer tests: number check, payloads, and the /api/explain logic with a fake
// Claude client (no network, no API key).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { numbersIn, verifyNumbers } from "../web/src/explain/verify.js";
import { cacheKey, checkFacts, rotationFacts, stableJson, todayFacts } from "../web/src/explain/payload.js";
import { explainWith, providerName, systemPrompt } from "../web/api/explain.js";
import { createClaude, CLAUDE_MODEL } from "../web/server/providers/claude.js";
import { createGemini, GEMINI_DEFAULT_MODEL } from "../web/server/providers/gemini.js";
import { cardSummary, checkSummary } from "../web/src/explain/templates.js";
import { runScoring } from "../web/src/scoring/index.js";
import { runCropCheck } from "../web/src/scoring/cropCheck.js";
import { runToday, todaySummary } from "../web/src/scoring/today.js";
import { parseForecast } from "../web/src/data/forecast.js";
import { withSowingCalendar } from "../web/src/data/loader.js";
import { DEFAULT_INPUTS, defaultRotation, previousFromRotation } from "../web/src/scoring/defaults.js";
import { shortName } from "../web/src/scoring/names.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, "web/public/data", p), "utf8"));
const tables = {
  cropTable: J("crops.json"),
  rotationTable: J("rotations.json"),
  nutrientTable: J("nutrients.json"),
  ruleTable: J("rotation_rules.json"),
};
const tagem = J("tagem_calendar.json");
const provinces = J("provinces.json");
const plist = provinces.provinces ?? provinces;
const cropsById = Object.fromEntries(tables.cropTable.crops.map((c) => [c.id, c]));
const nameOf = (id) => (id === "fallow" ? "fallow" : shortName(cropsById[id]));

function demo(id) {
  const point = plist.find((p) => p.id === id);
  const raw = J(`cache/${id}/features.json`);
  const f = withSowingCalendar(raw.features ?? raw, point, tagem, "rainfed");
  const current = defaultRotation({ ...tables, tagem }, point.region, f);
  const { results } = runScoring({
    features: f,
    ...tables,
    farmer: { region: point.region, irrigation: "rainfed", current_sequence: current, history: current, priorities: DEFAULT_INPUTS.priorities, never_grow: [] },
    scenario: { rainPct: 0, tempC: 0 },
    dataStatus: { power: true, soil: false },
  });
  return { f, current, results };
}

test("numbers in text: signs, decimals, ranges, percent, Turkish decimal comma", () => {
  const v = (t) => numbersIn(t).map((n) => n.value);
  assert.deepEqual(v("lows down to −2 °C"), [-2]);
  assert.deepEqual(v("covers 30% of 463 mm."), [30, 463]);
  assert.deepEqual(v("5-15 mm"), [5, 15]);
  assert.deepEqual(v("yağış %30, sıcaklık 0,5 derece"), [30, 0.5]);
  assert.deepEqual(v("2026-11-18"), [2026, 11, 18]);
});

test("number check passes copied numbers and catches invented ones", () => {
  const facts = { evidence: [{ evidence: "in a dry year rain covers 30% of sunflower's water need (~463 mm)" }], score_out_of_100: 64, low: -2 };
  assert.ok(verifyNumbers("Sunflower scores 64: rain covers only 30% of its 463 mm need, and frost can reach -2 °C.", facts).ok);
  assert.ok(verifyNumbers("Kuraklıkta yağış ihtiyacın %30'unu karşılar.", facts).ok);
  const bad = verifyNumbers("Rain covers 48% of the need.", facts);
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.unknown, ["48"]);
  assert.equal(verifyNumbers("", facts).ok, false, "empty text never passes");
  // numbers spelled as words would dodge the digit check, so they fail
  assert.deepEqual(verifyNumbers("Son yirmi yılın yedisinde don görüldü.", facts).unknown, ["yirmi", "yedisinde"]);
  assert.equal(verifyNumbers("Frost hit in seven of the last 20 years.", { a: "20" }).ok, false);
  // ordinary words that look like numbers are fine
  assert.ok(verifyNumbers("Bir tarım uzmanına danışın; toprak altında su var. Rain fell on one field.", facts).ok);
});

test("the template text itself always passes the number check (all demo provinces, all three kinds)", () => {
  for (const id of ["konya", "edirne", "adana", "sanliurfa", "erzurum"]) {
    const { f, current, results } = demo(id);
    const baseline = results.find((r) => r.is_baseline);
    for (const r of results) {
      const b = r.is_baseline ? undefined : baseline;
      const facts = rotationFacts(r, b, cardSummary(r, b));
      assert.ok(verifyNumbers(facts.template_text, facts).ok, `${id} ${r.label}`);
    }
    for (const crop of ["sunflower", "chickpea", "wheat"]) {
      const r = runCropCheck({ cropId: crop, previous: previousFromRotation(current), features: f, ...tables, farmer: { irrigation: "rainfed", never_grow: [] }, dataStatus: { power: true } });
      const facts = checkFacts(r, nameOf, checkSummary(r, nameOf));
      assert.ok(verifyNumbers(facts.template_text, facts).ok, `${id} check ${crop}: ${verifyNumbers(facts.template_text, facts).unknown}`);
    }
    const fc = parseForecast(J(`cache/${id}/forecast_snapshot.json`).response);
    const t = runToday({ cropId: "wheat", forecast: fc, features: f, cropsById, irrigation: "rainfed" });
    const facts = todayFacts(t, nameOf, todaySummary(t, nameOf));
    assert.ok(verifyNumbers(facts.template_text, facts).ok, `${id} today`);
  }
});

test("payloads hold no coordinates or place names; cache keys ignore key order", () => {
  const { results } = demo("konya");
  const text = JSON.stringify(rotationFacts(results[0], undefined, "x"));
  for (const key of ["lat", "lon", "centroid", "polygon", "province", "field"]) assert.ok(!text.includes(`"${key}"`), key);
  assert.ok(!text.includes("Konya"), "no place name");
  assert.equal(stableJson({ b: 1, a: [2, { d: 3, c: 4 }] }), stableJson({ a: [2, { c: 4, d: 3 }], b: 1 }));
  assert.equal(cacheKey("check", "tr", { b: 1, a: 2 }), cacheKey("check", "tr", { a: 2, b: 1 }));
  assert.notEqual(cacheKey("check", "tr", { a: 2 }), cacheKey("check", "en", { a: 2 }));
});

/** Fake Claude SDK client: records the request, returns a canned response. */
function fakeClaudeSdk(reply) {
  const calls = [];
  return { calls, beta: { messages: { create: async (params) => (calls.push(params), reply) } } };
}
/** Fake Gemini SDK client. */
function fakeGeminiSdk(reply) {
  const calls = [];
  return { calls, models: { generateContent: async (params) => (calls.push(params), typeof reply === "function" ? reply() : reply) } };
}
/** Provider double for the endpoint logic. */
const fakeProvider = (out) => ({ name: "fake", model: "fake-1", generate: async () => (typeof out === "function" ? out() : out) });
const ok = (text) => ({ stop: "ok", text, model: "fake-1" });
const FACTS = { crop: "sunflower", verdict: "not_reasonable", evidence: [{ evidence: "grown 2 seasons ago; needs 4 years between crops", effect: "negative" }] };
const BODY = { kind: "check", lang: "en", facts: FACTS };

test("/api/explain returns checked text and rejects invented numbers, declines, truncation and bad input", async () => {
  const good = await explainWith(fakeProvider(ok("Sunflower is not a good idea: it was grown 2 seasons ago and needs 4 years between crops.")), BODY);
  assert.equal(good.status, 200);
  assert.equal(good.json.model, "fake-1");
  const invented = await explainWith(fakeProvider(ok("It needs 5 years between crops.")), BODY);
  assert.equal(invented.status, 422);
  assert.deepEqual(invented.json.unknown, ["5"]);
  assert.equal((await explainWith(fakeProvider({ stop: "refused", text: "" }), BODY)).json.error, "declined");
  assert.equal((await explainWith(fakeProvider({ stop: "truncated", text: "" }), BODY)).json.error, "too_long");
  assert.equal((await explainWith(fakeProvider(ok("x")), { ...BODY, kind: "poem" })).status, 400);
  assert.equal((await explainWith(fakeProvider(ok("x")), { ...BODY, lang: "de" })).status, 400);
  assert.equal((await explainWith(fakeProvider(ok("x")), { ...BODY, facts: { evidence: "x".repeat(25000) } })).status, 413);
  const { ProviderError } = await import("../web/server/providers/errors.js");
  const limited = await explainWith(fakeProvider(() => { throw new ProviderError("rate_limited"); }), BODY);
  assert.equal(limited.status, 429);
  assert.match(systemPrompt("tr"), /Turkish/);
  // Turkish text that leaves an English crop name in is rejected
  const mixed = await explainWith(fakeProvider(ok("Ayçiçeği yerine Triticale ekin.")), { ...BODY, lang: "tr" });
  assert.equal(mixed.json.error, "wrong_language");
  assert.equal((await explainWith(fakeProvider(ok("Ayçiçeği yerine tritikale ekin.")), { ...BODY, lang: "tr" })).status, 200);
});

test("provider choice: AI_PROVIDER wins, else Gemini key, else Claude key, else none", () => {
  assert.equal(providerName({}), null);
  assert.equal(providerName({ GEMINI_API_KEY: "g" }), "gemini");
  assert.equal(providerName({ ANTHROPIC_API_KEY: "a" }), "claude");
  assert.equal(providerName({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a" }), "gemini");
  assert.equal(providerName({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a", AI_PROVIDER: "claude" }), "claude");
  assert.equal(providerName({ AI_PROVIDER: "claude", GEMINI_API_KEY: "g" }), null, "asked for Claude without its key");
});

test("Gemini provider: default model, system instruction, and block/limit handling", async () => {
  const sdk = fakeGeminiSdk({ text: "Sunflower needs 4 years.", candidates: [{ finishReason: "STOP" }] });
  const g = createGemini({ client: sdk, model: undefined });
  assert.equal(g.model, process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL);
  assert.equal(GEMINI_DEFAULT_MODEL, "gemini-3.5-flash-lite");
  const out = await g.generate({ system: "SYS", user: "USER" });
  assert.deepEqual(out, { stop: "ok", text: "Sunflower needs 4 years.", model: g.model });
  const p = sdk.calls[0];
  assert.equal(p.contents, "USER");
  assert.equal(p.config.systemInstruction, "SYS");
  assert.ok(p.config.maxOutputTokens >= 1024);
  const blocked = createGemini({ client: fakeGeminiSdk({ promptFeedback: { blockReason: "SAFETY" } }) });
  assert.equal((await blocked.generate({ system: "", user: "" })).stop, "refused");
  const safety = createGemini({ client: fakeGeminiSdk({ text: "", candidates: [{ finishReason: "SAFETY" }] }) });
  assert.equal((await safety.generate({ system: "", user: "" })).stop, "refused");
  const cut = createGemini({ client: fakeGeminiSdk({ text: "Sun", candidates: [{ finishReason: "MAX_TOKENS" }] }) });
  assert.equal((await cut.generate({ system: "", user: "" })).stop, "truncated");
  const limited = createGemini({ client: fakeGeminiSdk(() => { throw Object.assign(new Error("quota"), { status: 429 }); }) });
  await assert.rejects(limited.generate({ system: "", user: "" }), (e) => e.code === "rate_limited");
  const badKey = createGemini({ client: fakeGeminiSdk(() => { throw Object.assign(new Error("API key not valid"), { status: 400 }); }) });
  await assert.rejects(badKey.generate({ system: "", user: "" }), (e) => e.code === "ai_unavailable");
});

test("Claude provider: model, refusal fallback on, thinking left at default", async () => {
  const sdk = fakeClaudeSdk({ model: CLAUDE_MODEL, stop_reason: "end_turn", content: [{ type: "text", text: "Fine." }] });
  const c = createClaude({ client: sdk });
  assert.deepEqual(await c.generate({ system: "SYS", user: "USER" }), { stop: "ok", text: "Fine.", model: CLAUDE_MODEL });
  const p = sdk.calls[0];
  assert.equal(p.model, "claude-opus-5-5");
  assert.equal(p.fallbacks, "default");
  assert.ok(p.betas.includes("server-side-fallback-2026-07-01"));
  assert.equal(p.thinking, undefined);
  assert.equal(p.system, "SYS");
  const refused = createClaude({ client: fakeClaudeSdk({ model: CLAUDE_MODEL, stop_reason: "refusal", content: [] }) });
  assert.equal((await refused.generate({ system: "", user: "" })).stop, "refused");
});

test("/api/explain handler answers 503 without a key, so the app keeps the template", async () => {
  const { default: handler } = await import("../web/api/explain.js");
  const keys = ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "AI_PROVIDER"];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  let status, body;
  const res = { status: (s) => ((status = s), res), json: (b) => (body = b) };
  await handler({ method: "POST", body: JSON.stringify({ kind: "check", lang: "en", facts: FACTS }) }, res);
  for (const k of keys) if (saved[k] !== undefined) process.env[k] = saved[k];
  assert.equal(status, 503);
  assert.equal(body.error, "ai_unavailable");
});
