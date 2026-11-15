// Today tab: 7-day forecast (Open-Meteo, not NASA) against the limits of the
// crop in the field now. Colours and reasons come from scoring/today.js.

import { useEffect, useMemo, useState } from "react";
import { loadForecast } from "../../data/forecast.js";
import { guessCropNow, runToday, shortDate, todaySummary } from "../../scoring/today.js";
import { displayName, shortName } from "../../scoring/names.js";
import AiSummary from "../components/AiSummary.jsx";
import { todayFacts } from "../../explain/payload.js";

const STATUS_TEXT = { green: "All clear", yellow: "Watch", red: "Act now" };
const LEVEL_TEXT = { red: "Act now", yellow: "Watch", info: "Plan" };
const TYPE_TEXT = { frost: "Frost", heat: "Heat", rain: "Heavy rain", water: "Water" };

export default function TodayTab({ tables, features, inputs, lat, lon, provinceId, place, status, lang }) {
  const crops = tables.cropTable.crops;
  const cropsById = useMemo(() => Object.fromEntries(crops.map((c) => [c.id, c])), [crops]);
  const nameOf = (id) => (id === "fallow" ? "fallow" : shortName(cropsById[id]));

  const [fc, setFc] = useState({ status: "idle", data: null });
  useEffect(() => {
    if (lat == null) return;
    const ctrl = new AbortController();
    setFc({ status: "loading", data: null });
    loadForecast({ lat, lon, provinceId, signal: ctrl.signal })
      .then((data) => setFc({ status: "ready", data }))
      .catch((e) => e.name !== "AbortError" && setFc({ status: "error", data: null }));
    return () => ctrl.abort();
  }, [lat, lon, provinceId]);

  const today = fc.data?.days[0]?.date;
  const guess = useMemo(
    () => (features && today ? guessCropNow(inputs.current, cropsById, features, today) : null),
    [features, today, inputs.current, cropsById]
  );
  const [picked, setPicked] = useState(null);
  useEffect(() => setPicked(null), [inputs.current, provinceId]); // new rotation or place: guess again
  const cropNow = picked ?? guess;

  const result = useMemo(() => {
    if (!fc.data || !features || !cropNow) return null;
    try {
      return runToday({ cropId: cropNow, forecast: fc.data, features, cropsById, irrigation: inputs.irrigation });
    } catch (e) {
      return { error: e.message };
    }
  }, [fc.data, features, cropNow, cropsById, inputs.irrigation]);

  const summary = result && !result.error ? todaySummary(result, nameOf) : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const facts = useMemo(() => (summary ? todayFacts(result, nameOf, summary) : null), [result, summary]);

  if (fc.status === "loading" || status === "loading") return <p className="muted">Loading the 7-day forecast…</p>;
  if (fc.status === "error") return <p className="warn">The forecast service did not respond and no saved forecast exists for this place. Try again later.</p>;
  if (status === "error") return <p className="warn">Could not load climate data for this place.</p>;
  if (!result) return null;
  if (result.error) return <p className="warn">Today check failed: {result.error}</p>;

  const rotationCrops = [...new Set(inputs.current.filter((id) => id !== "fallow"))];
  const others = crops.filter((c) => !rotationCrops.includes(c.id));

  return (
    <div className="today">
      <label className="field-label" htmlFor="crop-now">In your field now</label>
      <select id="crop-now" value={cropNow} onChange={(e) => setPicked(e.target.value)}>
        <optgroup label="Your rotation">
          {rotationCrops.map((id) => (
            <option key={id} value={id}>
              {displayName(cropsById[id])} · {cropsById[id].name_tr}
            </option>
          ))}
          <option value="fallow">Fallow (nadas) / empty</option>
        </optgroup>
        <optgroup label="Other crops">
          {others.map((c) => (
            <option key={c.id} value={c.id}>
              {displayName(c)} · {c.name_tr}
            </option>
          ))}
        </optgroup>
      </select>
      {!picked && <p className="note">Our guess from your rotation and the usual sowing dates here. Change it if it is wrong.</p>}

      <div className={`today-banner t-${result.status}`}>
        <span className="today-badge">{STATUS_TEXT[result.status]}</span>
        <p>{summary}</p>
      </div>
      {facts && <AiSummary kind="today" facts={facts} lang={lang} />}
      {cropNow !== "fallow" && (
        <p className="note">
          <strong>{displayName(cropsById[cropNow])}</strong>: {result.stage.label}
          {result.stage.estimated && ` (estimated from the ${result.stage.calendar} calendar for this place)`}
        </p>
      )}

      <ol className="days" aria-label="7-day forecast">
        {result.days.map((d) => (
          <li key={d.date} className={`day d-${d.status}`}>
            <span className="day-name">{shortDate(d.date).slice(0, 6)}</span>
            <span className="day-dot" aria-label={d.status} />
            <span className="day-t">
              <b>{Math.round(d.tmax)}°</b> / {Math.round(d.tmin)}°
            </span>
            <span className="day-rain">{d.rain >= 0.5 ? `${Math.round(d.rain)} mm` : "–"}</span>
          </li>
        ))}
      </ol>

      {result.alerts.length > 0 && (
        <div className="alerts">
          {result.alerts.map((a, i) => (
            <article key={i} className={`alert a-${a.level}`}>
              <header>
                <span className="alert-level">{LEVEL_TEXT[a.level]}</span>
                <strong>{TYPE_TEXT[a.type]}</strong>
              </header>
              <p>{a.evidence}</p>
              <p className="alert-action">
                <b>What to do:</b> {a.action}
              </p>
              <span className="src" title={a.kind}>
                {a.source} · {a.kind}
              </span>
            </article>
          ))}
        </div>
      )}

      <p className="source">
        <span className="chip">Open-Meteo</span>
        Weather forecast, <strong>not NASA data</strong>
        {fc.data.snapshot ? ` · saved on ${fc.data.snapshot} (live forecast unavailable)` : ` · ${place}`}
      </p>
      <details className="gaps">
        <summary>What we don't know ({result.gaps.length})</summary>
        <ul>
          {result.gaps.map((g, i) => (
            <li key={i}>{g}</li>
          ))}
        </ul>
      </details>
      <p className="note">Reminders never include fertilizer or spray doses. Check with a local agronomist before acting.</p>
    </div>
  );
}
