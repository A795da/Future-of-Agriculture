import { useMemo } from "react";
import { cardSummary } from "../../explain/templates.js";
import EvidenceList from "../components/EvidenceList.jsx";
import AiSummary from "../components/AiSummary.jsx";
import { Term } from "../components/Glossary.jsx";
import { rotationFacts } from "../../explain/payload.js";
import { useLang } from "../../i18n/LangContext.jsx";
import { rotationLabel } from "../../i18n/strings.js";
import { cardSummaryTr } from "../../i18n/summaries.js";

const DIMENSIONS = ["water", "climate", "soil", "erosion", "pest", "income", "simplicity"];

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
  const { t } = useLang();
  const net = n.n_net;
  return (
    <div className="nutrients">
      <h4>{t("nutrients_h")}</h4>
      <table>
        <tbody>
          <tr>
            <th>{t("nitrogen")}</th>
            <td>
              −{n.n_removed} {t("removed")}
              {n.n_fixed > 0 && (
                <>
                  , +{n.n_fixed} {t("fixed_by_legumes")}
                </>
              )}
            </td>
            <td className={net >= 0 ? "good" : "bad"}>
              {net >= 0 ? "+" : ""}
              {net} kg
            </td>
          </tr>
          <tr>
            <th>{t("phosphate")}</th>
            <td>
              −{n.p2o5_removed} {t("removed")}
            </td>
            <td className="bad">−{n.p2o5_removed} kg</td>
          </tr>
          <tr>
            <th>{t("potash")}</th>
            <td>
              −{n.k2o_removed} {t("removed")}
            </td>
            <td className="bad">−{n.k2o_removed} kg</td>
          </tr>
        </tbody>
      </table>
      <p className="nutrient-note">{t("nutrient_note")}</p>
    </div>
  );
}

export default function RotationCard({ result, baseline, index, cropsById }) {
  const { lang, t } = useLang();
  // The AI always gets the English facts (cache keys stay stable); only the display changes.
  const summary = cardSummary(result, baseline);
  const facts = useMemo(() => rotationFacts(result, baseline, summary), [result, baseline, summary]);
  const delta = baseline && !result.is_baseline ? result.score - baseline.score : null;
  const tr = lang === "tr";
  return (
    <article className={`rot-card ${result.is_baseline ? "baseline" : ""}`}>
      <header className="rot-head">
        <span className="rot-tag">{result.is_baseline ? t("current_rotation") : t("option_n", { n: index })}</span>
        <span className={`conf conf-${result.confidence}`} title={t("trust_title")}>
          {t(`conf_${result.confidence}`)} <Term id="confidence">{t("confidence_word")}</Term>
        </span>
      </header>

      <div className="rot-title">
        <h3>{tr && cropsById ? rotationLabel(result.sequence, cropsById, "tr", result.second_crops ?? {}) : result.label}</h3>
        <div className="score">
          <strong>{result.score}</strong>
          <span>/100</span>
          {delta != null && <em className={delta >= 0 ? "up" : "down"}>{delta >= 0 ? `+${delta}` : delta}</em>}
        </div>
      </div>

      {result.what_if && (
        <p className="what-if-tag">
          <Term id="what-if">{t("what_if_tag")}</Term>
          {t("not_forecast")}
        </p>
      )}
      {result.resilience && (
        <p className={`resil resil-${result.resilience.label}`} title={t("resil_note")}>
          <strong>{t("resil_label")}:</strong> {t(`resil_${result.resilience.label}`)} ·{" "}
          {t("resil_line", { today: result.resilience.today, warm: result.resilience.warm, dry: result.resilience.warm_dry })}
        </p>
      )}
      <p className="summary">{tr ? cardSummaryTr(result, baseline) : summary}</p>
      <AiSummary kind="rotation" facts={facts} lang={lang} />

      <div className="bars">
        {DIMENSIONS.map((k) => (
          <Bar key={k} label={t(`d_${k}`)} value={result.dimensions[k]} />
        ))}
        {result.sequence_adjustment !== 0 && (
          <p className="adj">
            {t("rules_line", { v: `${result.sequence_adjustment > 0 ? "+" : ""}${result.sequence_adjustment}` })}
          </p>
        )}
      </div>

      <h4>{t("evidence")}</h4>
      <EvidenceList reasons={result.reasons} />

      {result.nutrients && <NutrientBlock n={result.nutrients} />}

      {result.risks.length > 0 && (
        <>
          <h4>{t("risks")}</h4>
          <ul className="risks" lang="en">
            {result.risks.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </>
      )}

      <details className="gaps">
        <summary>{t("gaps", { n: result.gaps.length })}</summary>
        <ul lang="en">
          {result.gaps.map((g, i) => (
            <li key={i}>{g}</li>
          ))}
        </ul>
      </details>
      {result.notes && (
        <p className="rot-notes" lang="en">
          {result.notes}
        </p>
      )}
    </article>
  );
}
