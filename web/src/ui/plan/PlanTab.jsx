import RotationCard from "./RotationCard.jsx";
import ClimateShift from "./ClimateShift.jsx";
import { useLang } from "../../i18n/LangContext.jsx";
import { cropLabel } from "../../i18n/strings.js";

export default function PlanTab({ outcome, scenario, onScenario, status, cropsById, shift = null }) {
  const { lang, t } = useLang();
  if (status === "loading") return <p className="muted">{t("loading_climate")}</p>;
  if (status === "error") return <p className="warn">{t("climate_error")}</p>;
  if (!outcome) return null;
  if (outcome.error) return <p className="warn">{t("scoring_failed", { e: outcome.error })}</p>;

  const { results, removed } = outcome;
  const baseline = results.find((r) => r.is_baseline);
  const options = results.filter((r) => !r.is_baseline);

  return (
    <div className="plan">
      <ClimateShift shift={shift} onScenario={onScenario} />
      <div className="what-if">
        <h3>{t("what_if")}</h3>
        <label className="slider">
          <span>{t("rainfall")}</span>
          <input type="range" min="-30" max="20" step="1" value={scenario.rainPct}
            onChange={(e) => onScenario({ ...scenario, rainPct: +e.target.value })} />
          <output>{scenario.rainPct > 0 ? "+" : ""}{scenario.rainPct}%</output>
        </label>
        <label className="slider">
          <span>{t("temperature")}</span>
          <input type="range" min="0" max="3" step="0.1" value={scenario.tempC}
            onChange={(e) => onScenario({ ...scenario, tempC: +e.target.value })} />
          <output>+{scenario.tempC} °C</output>
        </label>
        {(scenario.rainPct !== 0 || scenario.tempC !== 0) && (
          <button className="link" onClick={() => onScenario({ rainPct: 0, tempC: 0 })}>{t("back_today")}</button>
        )}
      </div>

      {t("english_note") && <p className="note">{t("english_note")}</p>}

      <div className="cards">
        {baseline && <RotationCard result={baseline} cropsById={cropsById} />}
        {options.map((r, i) => (
          <RotationCard key={r.id} result={r} baseline={baseline} index={i + 1} cropsById={cropsById} />
        ))}
        {options.length === 0 && <p className="warn">{t("no_alternative")}</p>}
      </div>

      {removed.length > 0 && (
        <details className="why-not">
          <summary>{t("why_not", { n: removed.length })}</summary>
          <ul>
            {removed.map((r) => (
              <li key={r.id}>
                <strong>{cropsById ? cropLabel(r.id, cropsById, lang) : r.name}</strong>: <span lang="en">{r.reasons.join("; ")}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
