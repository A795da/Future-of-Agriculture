import { DIMENSION_LABELS, cardSummary } from "../../explain/templates.js";
import { useMemo } from "react";
import EvidenceList from "../components/EvidenceList.jsx";
import AiSummary from "../components/AiSummary.jsx";
import { rotationFacts } from "../../explain/payload.js";

function Bar({ label, value }) {
  const tone = value >= 70 ? "good" : value >= 45 ? "mid" : "bad";
  return (
    <div className="bar">
      <span className="bar-label">{label}</span>
      <span className="bar-track">
        <span className={`bar-fill ${tone}`} style={{ width: `${value}%` }} />
      </span>
      <span className="bar-value">{value}</span>
    </div>
  );
}

function NutrientBlock({ n }) {
  const net = n.n_net;
  return (
    <div className="nutrients">
      <h4>Nutrients per hectare, per year</h4>
      <table>
        <tbody>
          <tr>
            <th>Nitrogen (N)</th>
            <td>
              −{n.n_removed} removed{n.n_fixed > 0 && <>, +{n.n_fixed} fixed by legumes</>}
            </td>
            <td className={net >= 0 ? "good" : "bad"}>
              {net >= 0 ? "+" : ""}
              {net} kg
            </td>
          </tr>
          <tr>
            <th>Phosphate (P₂O₅)</th>
            <td>−{n.p2o5_removed} removed</td>
            <td className="bad">−{n.p2o5_removed} kg</td>
          </tr>
          <tr>
            <th>Potash (K₂O)</th>
            <td>−{n.k2o_removed} removed</td>
            <td className="bad">−{n.k2o_removed} kg</td>
          </tr>
        </tbody>
      </table>
      <p className="nutrient-note">
        Only legumes add nitrogen. Phosphate and potash can only come back through fertilizer or manure; a soil test
        tells how much. FieldShift gives no doses. Source: FAOSTAT yields, Ludemann et al. 2023, Herridge et al. 2008.
      </p>
    </div>
  );
}

export default function RotationCard({ result, baseline, index, lang }) {
  const summary = cardSummary(result, baseline);
  const facts = useMemo(() => rotationFacts(result, baseline, summary), [result, baseline, summary]);
  const delta = baseline && !result.is_baseline ? result.score - baseline.score : null;
  return (
    <article className={`rot-card ${result.is_baseline ? "baseline" : ""}`}>
      <header className="rot-head">
        <span className="rot-tag">{result.is_baseline ? "Your current rotation" : `Option ${index}`}</span>
        <span className={`conf conf-${result.confidence}`} title="How much to trust this result">
          {result.confidence} confidence
        </span>
      </header>

      <div className="rot-title">
        <h3>{result.label}</h3>
        <div className="score">
          <strong>{result.score}</strong>
          <span>/100</span>
          {delta != null && <em className={delta >= 0 ? "up" : "down"}>{delta >= 0 ? `+${delta}` : delta}</em>}
        </div>
      </div>

      {result.what_if && <p className="what-if-tag">What-if scenario, not a forecast</p>}
      <p className="summary">{summary}</p>
      <AiSummary kind="rotation" facts={facts} lang={lang} />

      <div className="bars">
        {Object.entries(DIMENSION_LABELS).map(([k, label]) => (
          <Bar key={k} label={label} value={result.dimensions[k]} />
        ))}
        {result.sequence_adjustment !== 0 && (
          <p className="adj">
            Rotation rules: {result.sequence_adjustment > 0 ? "+" : ""}
            {result.sequence_adjustment} points (legume before a cereal, same family back to back, long bare gaps)
          </p>
        )}
      </div>

      <h4>Evidence</h4>
      <EvidenceList reasons={result.reasons} />

      {result.nutrients && <NutrientBlock n={result.nutrients} />}

      {result.risks.length > 0 && (
        <>
          <h4>Risks to check locally</h4>
          <ul className="risks">
            {result.risks.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </>
      )}

      <details className="gaps">
        <summary>What we don't know ({result.gaps.length})</summary>
        <ul>
          {result.gaps.map((g, i) => (
            <li key={i}>{g}</li>
          ))}
        </ul>
      </details>
      {result.notes && <p className="rot-notes">{result.notes}</p>}
    </article>
  );
}
