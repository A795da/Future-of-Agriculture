// Evidence chips shared by the rotation cards and the crop check.
// Evidence lines come from the engine in English; the level tag is translated, and
// water lines with numbers attached (`reason.water`) are worded in Turkish too.
import { GlossaryText } from "./Glossary.jsx";
import { useLang } from "../../i18n/LangContext.jsx";
import Icon from "./Icon.jsx";
import { waterEvidenceTr } from "../../i18n/summaries.js";

const EFFECT_ICON = { positive: "plus", negative: "minus", neutral: "dot" };
const isNasa = (kind) => kind.startsWith("NASA");
const LEVEL_KEY = { blocker: "blocks", caution: "caution" };

export default function EvidenceList({ reasons }) {
  const { lang, t } = useLang();
  return (
    <ul className="evidence">
      {reasons.map((r, i) => (
        <li key={i} className={`ev ev-${r.effect}`}>
          <span className="ev-icon" aria-label={r.effect}>
            <Icon name={EFFECT_ICON[r.effect]} size="14px" />
          </span>
          <span className="ev-text" lang={lang === "tr" && r.water ? "tr" : "en"}>
            {LEVEL_KEY[r.level] && <span className={`lvl lvl-${r.level}`}>{t(LEVEL_KEY[r.level])}</span>}
            {lang === "tr" && r.water ? waterEvidenceTr(r.water) : <GlossaryText text={r.evidence} />}
          </span>
          <span className={`src ${isNasa(r.kind) ? "src-nasa" : ""}`} title={r.kind}>
            {r.source} · <GlossaryText text={r.kind} />
          </span>
        </li>
      ))}
    </ul>
  );
}
