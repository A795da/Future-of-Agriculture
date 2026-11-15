// Google Gemini provider for /api/explain (official @google/genai SDK).
// Reads GEMINI_API_KEY; model from GEMINI_MODEL (default below).
//
// Default: gemini-3.5-flash-lite: stable, the cheapest/fastest 3.5 model, and on
// the free tier with a larger daily quota than the Flash models (check your
// project's limits in Google AI Studio). Short rewording does not need more.

import { ApiError, GoogleGenAI } from "@google/genai";
import { ProviderError } from "./errors.js";

export const GEMINI_DEFAULT_MODEL = "gemini-3.5-flash-lite";
const BLOCKED = new Set(["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "LANGUAGE", "OTHER"]);

/** @param {{ client?: object, apiKey?: string, model?: string }} opts  client: injected in tests */
export function createGemini({ client, apiKey = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL } = {}) {
  const ai = client ?? new GoogleGenAI({ apiKey });
  return {
    name: "gemini",
    model,
    async generate({ system, user }) {
      let response;
      try {
        response = await ai.models.generateContent({
          model,
          contents: user,
          config: {
            systemInstruction: system,
            maxOutputTokens: 2048, // room for the model's own thinking plus 2-3 sentences
          },
        });
      } catch (e) {
        if (e instanceof ApiError || Number.isInteger(e?.status)) {
          if (e.status === 429) throw new ProviderError("rate_limited");
          if (e.status === 400 || e.status === 401 || e.status === 403) throw new ProviderError("ai_unavailable", e.message);
          if (e.status === 404) throw new ProviderError("ai_unavailable", `model ${model} not found`);
          throw new ProviderError(`ai_error_${e.status}`);
        }
        throw new ProviderError("ai_unreachable");
      }
      if (response.promptFeedback?.blockReason) return { stop: "refused", text: "", model };
      const finish = response.candidates?.[0]?.finishReason;
      if (finish === "MAX_TOKENS") return { stop: "truncated", text: "", model };
      if (BLOCKED.has(finish)) return { stop: "refused", text: "", model };
      return { stop: "ok", text: response.text ?? "", model };
    },
  };
}
