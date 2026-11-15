// Anthropic Claude provider for /api/explain (official @anthropic-ai/sdk).
// Reads ANTHROPIC_API_KEY.

import Anthropic from "@anthropic-ai/sdk";
import { ProviderError } from "./errors.js";

export const CLAUDE_MODEL = "claude-opus-5-5";

/** @param {{ client?: object }} opts  client: injected in tests */
export function createClaude({ client } = {}) {
  const anthropic = client ?? new Anthropic();
  return {
    name: "claude",
    model: CLAUDE_MODEL,
    async generate({ system, user }) {
      let response;
      try {
        response = await anthropic.beta.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: 2048,
          output_config: { effort: "low" }, // short wording task; thinking cannot be turned off on this model
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default", // if a safety classifier declines, the API retries on a fallback model
          system,
          messages: [{ role: "user", content: user }],
        });
      } catch (e) {
        if (e instanceof Anthropic.RateLimitError) throw new ProviderError("rate_limited");
        if (e instanceof Anthropic.AuthenticationError) throw new ProviderError("ai_unavailable");
        if (e instanceof Anthropic.APIError) throw new ProviderError(`ai_error_${e.status ?? "unknown"}`);
        throw new ProviderError("ai_unreachable");
      }
      if (response.stop_reason === "refusal") return { stop: "refused", text: "", model: response.model };
      if (response.stop_reason === "max_tokens") return { stop: "truncated", text: "", model: response.model };
      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join(" ");
      return { stop: "ok", text, model: response.model };
    },
  };
}
