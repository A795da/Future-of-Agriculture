/** A provider failure with a short code the app understands (rate_limited, ai_unavailable, ...). */
export class ProviderError extends Error {
  constructor(code, detail = "") {
    super(detail ? `${code}: ${detail}` : code);
    this.code = code;
  }
}
