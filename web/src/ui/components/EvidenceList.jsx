// Evidence chips shared by the rotation cards and the crop check.
// Evidence lines come from the engine in English; the level tag is translated.
import { GlossaryText } from "./Glossary.jsx";
import { useLang } from "../../i18n/LangContext.jsx";

const EFFECT_ICON = { positive: "▲", negative: "▼", neutral: "●" };
const isNasa = (kind) => kind.startsWith("NASA");
const LEVEL_KEY = { blocker: "blocks", caution: "caution" };

export default function EvidenceList({ reasons }) {
  const { t } = useLang();
  return (
    <ul className="evidence">
      {reasons.map((r, i) => (
        <li key={i} className={`ev ev-${r.effect}`}>
          <span className="ev-icon" aria-label={r.effect}>
            {EFFECT_ICON[r.effect]}
          </span>
          <span className="ev-text" lang="en">
            {LEVEL_KEY[r.level] && <span className={`lvl lvl-${r.level}`}>{t(LEVEL_KEY[r.level])}</span>}
            <GlossaryText text={r.evidence} />
          </span>
          <span className={`src ${isNasa(r.kind) ? "src-nasa" : ""}`} title={r.kind}>
            {r.source} · <GlossaryText text={r.kind} />
          </span>
        </li>
      ))}
    </ul>
  );
}
