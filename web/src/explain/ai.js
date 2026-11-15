// Browser side of the AI layer: cached demo texts first (works offline), then
// /api/explain. Every text is checked again here: if a number is not in the
// facts, the caller keeps the template sentence.

import { cacheKey } from "./payload.js";
import { verifyNumbers } from "./verify.js";

let bundled = null; // web/public/data/explain_cache.json, filled by scripts/build_explain_cache.mjs
const memory = new Map();
const STORE = "fieldshift-explain-v1";

function loadBundled() {
  bundled ??= fetch("/data/explain_cache.json")
    .then((r) => (r.ok ? r.json() : { entries: {} }))
    .catch(() => ({ entries: {} }));
  return bundled;
}

function readStore(key) {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "{}")[key] ?? null;
  } catch {
    return null;
  }
}
function writeStore(key, text) {
  try {
    const all = JSON.parse(localStorage.getItem(STORE) ?? "{}");
    all[key] = text;
    const keys = Object.keys(all);
    for (const k of keys.slice(0, Math.max(0, keys.length - 200))) delete all[k]; // keep it small
    localStorage.setItem(STORE, JSON.stringify(all));
  } catch {
    /* private mode or full storage: memory cache only */
  }
}

const checked = (text, facts, source) => (text && verifyNumbers(text, facts).ok ? { text, source } : null);

/** A cached text for these facts, or null. Never calls the network API. */
export async function cachedExplanation(kind, lang, facts) {
  const key = cacheKey(kind, lang, facts);
  if (memory.has(key)) return memory.get(key);
  const hit =
    checked((await loadBundled()).entries?.[key]?.text, facts, "cache") ?? checked(readStore(key), facts, "cache");
  if (hit) memory.set(key, hit);
  return hit;
}

/** Cached text, or a new one from /api/explain. Throws with a short reason when there is none. */
export async function explain(kind, lang, facts, { signal } = {}) {
  const cached = await cachedExplanation(kind, lang, facts);
  if (cached) return cached;
  const key = cacheKey(kind, lang, facts);
  const res = await fetch("/api/explain", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, lang, facts }),
    signal,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `http_${res.status}`);
  const out = checked(body.text, facts, "ai");
  if (!out) throw new Error("number_check_failed");
  memory.set(key, out);
  writeStore(key, out.text);
  return out;
}
