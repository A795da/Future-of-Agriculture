import RotationCard from "./RotationCard.jsx";

export default function PlanTab({ outcome, scenario, onScenario, status, lang }) {
  if (status === "loading") return <p className="muted">Loading 20 years of NASA climate data…</p>;
  if (status === "error") return <p className="warn">Could not load climate data for this place. Try again, or pick a province.</p>;
  if (!outcome) return null;
  if (outcome.error) return <p className="warn">Scoring failed: {outcome.error}</p>;

  const { results, removed } = outcome;
  const baseline = results.find((r) => r.is_baseline);
  const options = results.filter((r) => !r.is_baseline);

  return (
    <div className="plan">
      <div className="what-if">
        <h3>What if…</h3>
        <label className="slider">
          <span>Rainfall</span>
          <input type="range" min="-30" max="20" step="10" value={scenario.rainPct}
            onChange={(e) => onScenario({ ...scenario, rainPct: +e.target.value })} />
          <output>{scenario.rainPct > 0 ? "+" : ""}{scenario.rainPct}%</output>
        </label>
        <label className="slider">
          <span>Temperature</span>
          <input type="range" min="0" max="3" step="0.5" value={scenario.tempC}
            onChange={(e) => onScenario({ ...scenario, tempC: +e.target.value })} />
          <output>+{scenario.tempC} °C</output>
        </label>
        {(scenario.rainPct !== 0 || scenario.tempC !== 0) && (
          <button className="link" onClick={() => onScenario({ rainPct: 0, tempC: 0 })}>Back to today's climate</button>
        )}
      </div>

      <div className="cards">
        {baseline && <RotationCard result={baseline} lang={lang} />}
        {options.map((r, i) => (
          <RotationCard key={r.id} result={r} baseline={baseline} index={i + 1} lang={lang} />
        ))}
        {options.length === 0 && (
          <p className="warn">
            No alternative rotation passed the checks for this place. This usually means our crop list is missing crops
            that suit it (for example spring-sown wheat in very cold areas).
          </p>
        )}
      </div>

      {removed.length > 0 && (
        <details className="why-not">
          <summary>Why not other crops? ({removed.length} ruled out)</summary>
          <ul>
            {removed.map((r) => (
              <li key={r.id}>
                <strong>{r.name}</strong>: {r.reasons.join("; ")}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
