// Evidence chips shared by the rotation cards and the crop check.
const EFFECT_ICON = { positive: "▲", negative: "▼", neutral: "●" };
const isNasa = (kind) => kind.startsWith("NASA");
const LEVEL_LABEL = { blocker: "blocks", caution: "caution" };

export default function EvidenceList({ reasons }) {
  return (
    <ul className="evidence">
      {reasons.map((r, i) => (
        <li key={i} className={`ev ev-${r.effect}`}>
          <span className="ev-icon" aria-label={r.effect}>
            {EFFECT_ICON[r.effect]}
          </span>
          <span className="ev-text">
            {LEVEL_LABEL[r.level] && <span className={`lvl lvl-${r.level}`}>{LEVEL_LABEL[r.level]}</span>}
            {r.evidence}
          </span>
          <span className={`src ${isNasa(r.kind) ? "src-nasa" : ""}`} title={r.kind}>
            {r.source} · {r.kind}
          </span>
        </li>
      ))}
    </ul>
  );
}
