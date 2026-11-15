// Serverless function (Vercel/Netlify style) that turns a computed Geleceğin Tarımı
// result into 2-3 plain sentences with an AI model. API keys live only on the
// server (host environment variables; web/.env.local in development).
//
// Provider (web/server/providers/):
//   AI_PROVIDER=gemini|claude   optional; otherwise Gemini if GEMINI_API_KEY is set,
//                               else Claude if ANTHROPIC_API_KEY is set, else none.
//   GEMINI_MODEL                optional; default gemini-3.5-flash-lite
//
// POST /api/explain  { kind: "rotation"|"check"|"today", lang: "en"|"tr", facts: {...} }
// → 200 { text, model }             text passed the number check
// → 422 { error, unknown? }         failed the check, declined or cut off: use the template
// → 503 { error: "ai_unavailable" } no key configured: use the template
//
// The AI never decides anything: verdicts, scores and colours come from the
// rule-based engine and arrive here already computed.

import { KINDS, LANGS } from "../src/explain/payload.js";
import { verifyNumbers } from "../src/explain/verify.js";
import { ProviderError } from "../server/providers/errors.js";

const MAX_BODY_CHARS = 20000;

const WHAT = {
  rotation: "one crop-rotation option and its score. Start with the rotation and its score",
  check: "the verdict on whether one crop makes sense after the previous seasons. The verdict is about that crop, not about the rotation: start with the crop name and the verdict",
  today: "the next 7 days of weather risks for the crop in the field. Start with the crop and the overall status",
};

const STATUS_OF = { rate_limited: 429, ai_unavailable: 503 };

export function systemPrompt(lang) {
  return [
    "You explain results from Geleceğin Tarımı, a decision-support tool for farmers in Turkey.",
    "A rule-based engine has already computed the result from NASA data, a crop table and published rotation rules. Your job is only to explain it in plain words to a farmer with little time; you do not judge, re-score or change it.",
    "",
    "Rules:",
    "- Use only facts that are in the JSON. Do not add causes, risks, advice, crop names or numbers that are not there (for example, never mention waterlogging, pests or prices unless the JSON does).",
    "- Every number you write must appear in the JSON. Write every number with digits exactly as it appears there, small counts too (7, not seven or yedi; 20, not twenty or yirmi): a dot for decimals, no thousands separators. Leave a number out rather than round, convert or spell it.",
    "- Keep the verdict, score, status and confidence exactly as given. Never give fertilizer, pesticide or irrigation doses.",
    "- Write 2 or 3 short sentences of plain prose: the main conclusion first, then the most important reason, then what to watch or check. No lists, headings or markdown, and do not mention AI or JSON.",
    "- If the data says a local agronomist should check something, you may say so.",
    lang === "tr"
      ? [
          "- Write in simple, correct Turkish, as an agricultural extension officer (ziraat mühendisi) would speak to a farmer. Use only real, everyday Turkish words; never invent a word and never leave an English word in the text.",
          "- Use these Turkish terms: crop rotation = ekim nöbeti; current rotation = mevcut ekim nöbeti; fallow = nadas; legume = baklagil; score = puan; confidence = güven düzeyi (medium = orta, low = düşük); dry year = kurak yıl; frost = don; heat stress = sıcaklık stresi; flowering = çiçeklenme; water need = su ihtiyacı; irrigation = sulama; bare soil = çıplak toprak; erosion = erozyon; nitrogen = azot; heat units = sıcaklık birikimi (gün-derece); local agronomist = yerel ziraat mühendisi.",
          "- Write percentages the Turkish way, with the sign first: %51.",
          "- Translate every crop name into Turkish, also in lists of alternatives. Crop names: wheat = buğday, spring wheat = yazlık buğday, spring barley = yazlık arpa, silage maize = silajlık mısır, sorghum = sorgum, soybean = soya, dry bean = kuru fasulye, potato = patates, tomato = domates, barley = arpa, chickpea = nohut, lentil = mercimek, sunflower = ayçiçeği, faba bean = bakla, common vetch = fiğ, maize = mısır, cotton = pamuk, sugar beet = şeker pancarı, alfalfa = yonca, sainfoin = korunga, triticale = tritikale, rye = çavdar, oats = yulaf, pea = bezelye, canola = kanola, safflower = aspir.",
        ].join("\n")
      : "- Write in simple English.",
  ].join("\n");
}

// English crop words that must not appear in a Turkish explanation.
const ENGLISH_CROPS =
  /(?<![\p{L}])(wheat|barley|rye|oats?|triticale|maize|corn|sorghum|chickpeas?|lentils?|peas?|beans?|soybeans?|sunflowers?|safflower|canola|beet|cotton|potato(es)?|tomato(es)?|alfalfa|sainfoin|vetch|fallow|spring)(?![\p{L}])/giu;
export const englishCropWords = (text) => [...String(text).matchAll(ENGLISH_CROPS)].map((m) => m[0]);

/** Which provider the environment asks for: "gemini", "claude" or null. */
export function providerName(env = process.env) {
  const wanted = (env.AI_PROVIDER ?? "").toLowerCase();
  if (wanted === "gemini") return env.GEMINI_API_KEY ? "gemini" : null;
  if (wanted === "claude") return env.ANTHROPIC_API_KEY ? "claude" : null;
  if (env.GEMINI_API_KEY) return "gemini";
  if (env.ANTHROPIC_API_KEY) return "claude";
  return null;
}

/** The configured provider, or null. Also used by scripts/build_explain_cache.mjs. */
export async function makeProvider(env = process.env) {
  const name = providerName(env);
  if (name === "gemini") return (await import("../server/providers/gemini.js")).createGemini();
  if (name === "claude") return (await import("../server/providers/claude.js")).createClaude();
  return null;
}

/** Core logic with an injectable provider ({ name, model, generate }); tests pass a fake one. */
export async function explainWith(provider, body) {
  const { kind, lang, facts } = body ?? {};
  if (!KINDS.includes(kind) || !LANGS.includes(lang) || !facts || typeof facts !== "object") {
    return { status: 400, json: { error: "kind, lang and facts are required" } };
  }
  const factsJson = JSON.stringify(facts);
  if (factsJson.length > MAX_BODY_CHARS) return { status: 413, json: { error: "facts too large" } };

  let out;
  try {
    out = await provider.generate({ system: systemPrompt(lang), user: `Explain ${WHAT[kind]}.\n\n${factsJson}` });
  } catch (e) {
    const code = e instanceof ProviderError ? e.code : "ai_unreachable";
    return { status: STATUS_OF[code] ?? 502, json: { error: code } };
  }
  if (out.stop === "refused") return { status: 422, json: { error: "declined" } };
  if (out.stop === "truncated") return { status: 422, json: { error: "too_long" } };

  const text = String(out.text ?? "").replace(/\s+/g, " ").trim();
  const check = verifyNumbers(text, facts);
  if (!check.ok) return { status: 422, json: { error: "number_check_failed", unknown: check.unknown } };
  const english = lang === "tr" ? englishCropWords(text) : [];
  if (english.length) return { status: 422, json: { error: "wrong_language", unknown: english } };
  return { status: 200, json: { text, model: out.model } };
}

let provider = null;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }
  if (!providerName()) {
    res.status(503).json({ error: "ai_unavailable" });
    return;
  }
  provider ??= await makeProvider();
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).json({ error: "invalid JSON" });
      return;
    }
  }
  const out = await explainWith(provider, body);
  res.status(out.status).json(out.json);
}
