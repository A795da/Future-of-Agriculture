// Optional AI wording under a template explanation. The template is always
// shown; this adds a friendlier version only after it passes the number check.

import { useEffect, useMemo, useState } from "react";
import { cachedExplanation, explain } from "../../explain/ai.js";
import { cacheKey } from "../../explain/payload.js";
import Icon from "./Icon.jsx";

const TEXT = {
  en: {
    ask: "Explain in plain words",
    busy: "Writing…",
    label: "AI summary of the data above",
    cached: "saved",
    errors: {
      ai_unavailable: "AI explanations are not set up on this server; the text above is the full explanation.",
      number_check_failed: "The AI text had a number that is not in the data, so only the standard text is shown.",
      declined: "The AI declined to write this one; the text above is the full explanation.",
      default: "AI explanation unavailable right now; the text above is the full explanation.",
    },
  },
  tr: {
    ask: "Sade dille anlat",
    busy: "Yazılıyor…",
    label: "Yukarıdaki verilerin yapay zekâ özeti",
    cached: "kayıtlı",
    errors: {
      ai_unavailable: "Bu sunucuda yapay zekâ açıklaması kurulu değil; yukarıdaki metin açıklamanın tamamıdır.",
      number_check_failed: "Yapay zekâ metninde verilerde olmayan bir sayı vardı; bu yüzden yalnızca standart metin gösteriliyor.",
      declined: "Yapay zekâ bu metni yazmadı; yukarıdaki metin açıklamanın tamamıdır.",
      default: "Yapay zekâ açıklaması şu anda alınamıyor; yukarıdaki metin açıklamanın tamamıdır.",
    },
  },
};

export default function AiSummary({ kind, facts, lang = "en" }) {
  const t = TEXT[lang] ?? TEXT.en;
  const key = useMemo(() => cacheKey(kind, lang, facts), [kind, lang, facts]);
  const [state, setState] = useState({ key: null, status: "idle" });

  // Saved texts (demo cache, earlier answers) appear without a click and without a network call.
  useEffect(() => {
    let live = true;
    setState({ key, status: "idle" });
    cachedExplanation(kind, lang, facts).then((hit) => live && hit && setState({ key, status: "done", ...hit }));
    return () => (live = false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const ask = () => {
    setState({ key, status: "busy" });
    explain(kind, lang, facts)
      .then((r) => setState((s) => (s.key === key ? { key, status: "done", ...r } : s)))
      .catch((e) => setState((s) => (s.key === key ? { key, status: "error", error: e.message } : s)));
  };

  if (state.key !== key) return null;
  if (state.status === "done") {
    return (
      <div className="ai-summary" lang={lang}>
        <p>{state.text}</p>
        <span className="ai-label">
          {t.label}
          {state.source === "cache" ? ` · ${t.cached}` : ""}
        </span>
      </div>
    );
  }
  return (
    <div className="ai-ask">
      <button className="link" onClick={ask} disabled={state.status === "busy"}>
        {state.status === "busy" ? t.busy : t.ask}
      </button>
      {state.status === "error" && <p className="note">{t.errors[state.error] ?? t.errors.default}</p>}
    </div>
  );
}
