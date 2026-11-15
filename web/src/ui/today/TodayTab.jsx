// Today tab: 7-day forecast (Open-Meteo, not NASA) against the limits of the
// crop in the field now. Colours and reasons come from scoring/today.js.

import { useEffect, useMemo, useState } from "react";
import { loadForecast } from "../../data/forecast.js";
import { guessCropNow, runToday, todaySummary } from "../../scoring/today.js";
import { shortName } from "../../scoring/names.js";
import AiSummary from "../components/AiSummary.jsx";
import Icon from "../components/Icon.jsx";
import HourlyStrip, { skyIcon } from "./HourlyStrip.jsx";
import { GlossaryText } from "../components/Glossary.jsx";
import { todayFacts } from "../../explain/payload.js";
import { useLang } from "../../i18n/LangContext.jsx";
import { cropLabel, dayLabel } from "../../i18n/strings.js";
import { alertActionTr, alertEvidenceTr, todaySummaryTr } from "../../i18n/summaries.js";

export default function TodayTab({ tables, features, inputs, lat, lon, provinceId, place, status }) {
  const { lang, t } = useLang();
  const tr = lang === "tr";
  const crops = tables.cropTable.crops;
  const cropsById = useMemo(() => Object.fromEntries(crops.map((c) => [c.id, c])), [crops]);
  const nameOf = (id) => (id === "fallow" ? "fallow" : shortName(cropsById[id])); // English, for the AI facts
  const label = (id) => cropLabel(id, cropsById, lang);

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
    () => (features && today ? guessCropNow([...inputs.current, ...Object.values(inputs.second ?? {})], cropsById, features, today) : null),
    [features, today, inputs.current, inputs.second, cropsById]
  );
  const [picked, setPicked] = useState(null);
  const [dayIdx, setDayIdx] = useState(0);
  useEffect(() => setDayIdx(0), [fc.data]);
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

  if (fc.status === "loading" || status === "loading") return <p className="muted">{t("loading_forecast")}</p>;
  if (fc.status === "error") return <p className="warn">{t("forecast_error")}</p>;
  if (status === "error") return <p className="warn">{t("climate_error_short")}</p>;
  if (!result) return null;
  if (result.error) return <p className="warn">{t("today_failed", { e: result.error })}</p>;

  const rotationCrops = [...new Set([...inputs.current, ...Object.values(inputs.second ?? {})].filter((id) => id !== "fallow"))];
  const others = crops.filter((c) => !rotationCrops.includes(c.id));
  const cropTr = label(cropNow).toLocaleLowerCase("tr");
  // One temperature scale for the whole week, so the bars compare day to day.
  const lo = Math.min(...result.days.map((d) => d.tmin)) - 1;
  const span = Math.max(...result.days.map((d) => d.tmax)) + 1 - lo;
  const maxRain = Math.max(10, ...result.days.map((d) => d.rain));

  return (
    <div className="today">
      <label className="field-label" htmlFor="crop-now">{t("in_field_now")}</label>
      <select id="crop-now" value={cropNow} onChange={(e) => setPicked(e.target.value)}>
        <optgroup label={t("your_rotation")}>
          {rotationCrops.map((id) => (
            <option key={id} value={id}>
              {label(id)}
            </option>
          ))}
          <option value="fallow">{t("fallow_empty")}</option>
        </optgroup>
        <optgroup label={t("other_crops")}>
          {others.map((c) => (
            <option key={c.id} value={c.id}>
              {label(c.id)}
            </option>
          ))}
        </optgroup>
      </select>
      {!picked && <p className="note">{t("guess_note")}</p>}

      <div className={`today-banner t-${result.status}`}>
        <span className="today-badge">{t(`s_${result.status}`)}</span>
        <p>{tr ? todaySummaryTr(result, label) : summary}</p>
      </div>
      {facts && <AiSummary kind="today" facts={facts} lang={lang} />}
      {cropNow !== "fallow" && (
        <p className="note">
          <strong>{label(cropNow)}</strong>: {t(`st_${result.stage.key}`)}
          {result.stage.estimated && t("stage_estimated", { cal: result.stage.calendar })}
        </p>
      )}

      <section className="week">
        <header className="week-head">
          <h3>{t("forecast_7")}</h3>
          <span>°C · mm</span>
        </header>
        <ol className="days" aria-label={t("forecast_7")}>
          {result.days.map((d, i) => {
            const dl = dayLabel(d.date, lang);
            const pos = (v) => ((v - lo) / span) * 100;
            return (
              <li key={d.date} className={`day d-${d.status}${i === dayIdx ? " is-sel" : ""}`}>
                <button type="button" className="day-btn" aria-pressed={i === dayIdx} onClick={() => setDayIdx(i)}>
                <span className="day-name">
                  {dl.day} {dl.date.split(" ")[0]}
                </span>
                {d.sky && (
                  <span
                    className={`day-sky sky-${d.sky}`}
                    title={d.rain_prob != null ? `${t(`sky_${d.sky}`)} · ${t("rain_chance", { p: d.rain_prob })}` : t(`sky_${d.sky}`)}
                  >
                    <Icon name={skyIcon(d.sky)} size="28" />
                    <span className="day-sky-label">{t(`sky_${d.sky}`)}</span>
                  </span>
                )}
                <span className="day-hi">{Math.round(d.tmax)}°</span>
                <span className="day-range" aria-hidden="true">
                  <i style={{ bottom: `${pos(d.tmin)}%`, top: `${100 - pos(d.tmax)}%` }} />
                </span>
                <span className="day-lo">{Math.round(d.tmin)}°</span>
                <span className="day-rainbar" aria-hidden="true">
                  {d.rain >= 0.5 && <i style={{ height: `${Math.max(8, (d.rain / maxRain) * 100)}%` }} />}
                </span>
                <span className="day-rain">{d.rain >= 0.5 ? `${Math.round(d.rain)} mm` : "–"}</span>
                <span className="sr-only">{d.status}</span>
                </button>
              </li>
            );
          })}
        </ol>
        {fc.data.days.some((d) => d.hours?.length) && <p className="note week-hint">{t("hourly_hint")}</p>}
      </section>

      <HourlyStrip days={result.days} index={dayIdx} />

      {result.alerts.length > 0 && (
        <div className="alerts">
          {result.alerts.map((a, i) => (
            <article key={i} className={`alert a-${a.level}`}>
              <header>
                <span className="alert-level">{t(`l_${a.level}`)}</span>
                <strong>{t(`t_${a.type}`)}</strong>
              </header>
              <p>{tr ? alertEvidenceTr(a, cropTr) : <GlossaryText text={a.evidence} />}</p>
              <p className="alert-action">
                <b>{t("what_to_do")}</b> {tr ? alertActionTr(a) : a.action}
              </p>
              <span className="src" title={a.kind}>
                {a.source} · <GlossaryText text={a.kind} />
              </span>
            </article>
          ))}
        </div>
      )}

      <p className="source">
        <span className="chip">Open-Meteo</span>
        {t("forecast_src")} <strong>{t("not_nasa")}</strong>
        {fc.data.snapshot ? t("saved_on", { d: fc.data.snapshot }) : ` · ${place}`}
      </p>
      <details className="gaps">
        <summary>{t("gaps", { n: result.gaps.length })}</summary>
        <ul lang="en">
          {result.gaps.map((g, i) => (
            <li key={i}>{g}</li>
          ))}
        </ul>
      </details>
      <p className="note">{t("no_doses")}</p>
    </div>
  );
}
