// Overview: the most important results on one screen. Every number here comes
// from the engine output or a NASA data file; nothing is invented for the layout.

import { useLang } from "../../i18n/LangContext.jsx";
import { cropLabel } from "../../i18n/strings.js";
import Icon from "../components/Icon.jsx";
import SeasonPlan, { CalendarStrip } from "./SeasonPlan.jsx";
import { rotationCalendar } from "../../scoring/calendar.js";
import { partName, partRotation } from "../layout/PartSwitcher.jsx";
import { formatArea } from "../../field/geometry.js";

/** Rotation name with second crops: "Wheat + Maize › Cotton". */
const rotName = (r, cropsById, lang) =>
  r.sequence.map((id, i) => cropLabel(id, cropsById, lang) + (r.second_crops?.[i] ? ` + ${cropLabel(r.second_crops[i], cropsById, lang)}` : "")).join(" › ");

/** One row per field part: its rotation, current score and best option. */
function PartsStrip({ partResults, farm, onPick, cropsById }) {
  const { lang, t } = useLang();
  return (
    <section className="panel parts-strip">
      <header className="panel-head">
        <div>
          <p className="eyebrow">{t("parts_tag")}</p>
          <h3 className="display-sm">{t("parts_strip_h")}</h3>
        </div>
      </header>
      <div className="ps-rows">
        {partResults.map(({ part, result }) => {
          const res = result?.outcome?.results ?? [];
          const base = res.find((r) => r.is_baseline);
          const best = [...res].sort((a, b) => b.score - a.score)[0];
          const on = part.id === farm.activePart;
          return (
            <button key={part.id} className={`ps-row ${on ? "on" : ""}`} aria-pressed={on} onClick={() => onPick(part.id)}>
              <span className="ps-name">
                <strong>{partName(part, farm.parts, t)}</strong>
                <small>
                  {t(part.irrigation)}
                  {part.area_ha ? ` · ${formatArea(part.area_ha)}` : ""}
                </small>
              </span>
              <span className="ps-rot">{partRotation(part, cropsById, lang)}</span>
              <span className="ps-score">
                <small>{t("parts_now")}</small>
                <strong>{base?.score ?? "–"}</strong>
              </span>
              <span className="ps-score best">
                <small>{t("ov_best")}</small>
                <strong>{best?.score ?? "–"}</strong>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

const MONTHS_LONG = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  tr: ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"],
};
const MONTHS_SHORT = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  tr: ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"],
};

const signed = (v) => (v > 0 ? `+${v}` : `${v}`);

/** Colour per crop family for the sequence dots. */
function cropTone(id, cropsById) {
  if (id === "fallow") return "fallow";
  const fam = cropsById?.[id]?.family;
  if (fam === "poaceae") return "cereal";
  if (fam === "fabaceae") return "legume";
  return "other";
}

function ScoreRing({ score }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ring" viewBox="0 0 80 80" width="88" height="88" aria-hidden="true">
      <circle cx="40" cy="40" r={r} className="ring-track" />
      <circle
        cx="40"
        cy="40"
        r={r}
        className="ring-fill"
        strokeDasharray={`${(c * score) / 100} ${c}`}
        transform="rotate(-90 40 40)"
      />
      <text x="40" y="44" textAnchor="middle" className="ring-num">
        {score}
      </text>
      <text x="40" y="58" textAnchor="middle" className="ring-of">
        /100
      </text>
    </svg>
  );
}

function StatCard({ icon, tone, title, value, sub, source, level }) {
  const { t } = useLang();
  return (
    <article className={`stat stat-${tone}`}>
      <span className="stat-icon">
        <Icon name={icon} size="1.25em" />
      </span>
      <div className="stat-body">
        <p className="eyebrow">{title}</p>
        <p className="stat-value">{value}</p>
        <p className="stat-sub">{sub}</p>
      </div>
      <footer className="stat-foot">
        {level && <span className={`badge badge-${level}`}>{t(`shift_level_${level}`)}</span>}
        <span className="stat-src">{source}</span>
      </footer>
    </article>
  );
}

/** Monthly water balance: evaporative demand (ET0) vs rain, 20-year NASA POWER means. */
function SeasonChart({ et0, rain, lang }) {
  const { t } = useLang();
  const W = 720;
  const H = 200;
  const pad = { l: 8, r: 8, t: 30, b: 26 };
  const max = Math.max(...et0, ...rain) * 1.1;
  const x = (i) => pad.l + (i * (W - pad.l - pad.r)) / 11;
  const y = (v) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const line = (arr) => arr.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line(et0)} L${x(11)},${y(0)} L${x(0)},${y(0)} Z`;
  const gap = et0.map((v, i) => v - rain[i]);
  const peak = gap.indexOf(Math.max(...gap));
  const px = x(peak);
  const labelX = Math.min(Math.max(px, 70), W - 70);
  return (
    <div className="season-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("ov_season_h")}>
        <defs>
          <linearGradient id="et0fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" className="et0-stop-a" />
            <stop offset="100%" className="et0-stop-b" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={pad.l} x2={W - pad.r} y1={pad.t + f * (H - pad.t - pad.b)} y2={pad.t + f * (H - pad.t - pad.b)} className="grid-line" />
        ))}
        <path d={area} fill="url(#et0fill)" />
        <path d={line(et0)} className="et0-line" />
        <path d={line(rain)} className="rain-line" />
        <line x1={px} x2={px} y1={y(et0[peak])} y2={y(rain[peak])} className="gap-line" />
        <circle cx={px} cy={y(et0[peak])} r="4" className="et0-dot" />
        <g transform={`translate(${labelX},${Math.max(y(et0[peak]) - 24, 12)})`}>
          <rect x="-62" y="-14" width="124" height="22" rx="6" className="peak-box" />
          <text x="0" y="1" textAnchor="middle" className="peak-text">
            {t("ov_peak")}: {MONTHS_SHORT[lang][peak]}
          </text>
        </g>
        {MONTHS_SHORT[lang].map((m, i) => (
          <text key={m} x={x(i)} y={H - 6} textAnchor="middle" className="axis-text">
            {m}
          </text>
        ))}
      </svg>
      <p className="season-insight">
        <Icon name="sun" />
        <span>
          {t("ov_insight", { m: MONTHS_LONG[lang][peak], et0: Math.round(et0[peak]), rain: Math.round(rain[peak]) })}
        </span>
      </p>
    </div>
  );
}

function MiniRotation({ result, tag, tone, cropsById, features, onOpen }) {
  const { lang, t } = useLang();
  const cal = features && cropsById ? rotationCalendar(result.sequence, result.second_crops ?? {}, cropsById, features) : null;
  const dims = ["water", "soil", "income"];
  return (
    <article className={`mini-rot mini-${tone}`}>
      <header>
        <div>
          <p className="eyebrow">{tag}</p>
          <h3>
            {rotName(result, cropsById, lang)}
          </h3>
        </div>
        <span className="mini-score">
          <strong>{result.score}</strong>
          <small>{t("ov_score")}</small>
        </span>
      </header>
      {cal ? (
        <CalendarStrip cal={cal} cropsById={cropsById} compact />
      ) : (
        <ol className="seq">
          {result.sequence.map((id, i) => (
            <li key={i} className={`seq-dot seq-${cropTone(id, cropsById)}`} title={cropLabel(id, cropsById, lang)} />
          ))}
        </ol>
      )}
      <div className="mini-bars">
        {dims.map((k) => (
          <div key={k} className="mini-bar">
            <span>{t(`d_${k}`)}</span>
            <span className="bar-track">
              <span className="bar-fill" style={{ width: `${result.dimensions[k]}%` }} />
            </span>
            <span className="num">{result.dimensions[k]}</span>
          </div>
        ))}
      </div>
      {result.resilience && (
        <p className={`resil resil-${result.resilience.label}`}>
          <strong>{t("resil_label")}:</strong> {t(`resil_${result.resilience.label}`)}
        </p>
      )}
      <button className="link-arrow" onClick={onOpen}>
        {t("ov_full")} <Icon name="arrow" size="1em" />
      </button>
    </article>
  );
}

export default function Overview({ outcome, status, features, shift, water, place, cropsById, onNavigate, partResults = null, farm = null, onPickPart }) {
  const { lang, t } = useLang();
  if (status === "loading") return <p className="muted">{t("loading_climate")}</p>;
  if (status === "error") return <p className="warn">{t("climate_error")}</p>;
  if (!outcome || outcome.error) return null;

  const baseline = outcome.results.find((r) => r.is_baseline);
  const options = outcome.results.filter((r) => !r.is_baseline);
  const best = [...outcome.results].sort((a, b) => b.score - a.score)[0];
  const delta = baseline && best !== baseline ? best.score - baseline.score : null;
  const m = shift?.measures;
  const et0 = features?.monthly_et0_mm?.value;
  const rain = features?.monthly_rain_mm?.value;

  return (
    <div className="overview">
      <section className="ov-hero">
        <div>
          <span className="season-chip">
            <Icon name="calendar" size="1em" /> {t("ov_season", { year: new Date().getFullYear() + 1 })}
          </span>
          <h2 className="display">{t("ov_title", { place })}</h2>
          <p className="lede">{t("ov_sub", { place })}</p>
        </div>
        {best && (
          <div className="ov-score">
            <ScoreRing score={best.score} />
            <div>
              <p className="eyebrow">{t("ov_best")}</p>
              <p className="ov-best-name">
                {rotName(best, cropsById, lang)}
              </p>
              <p className="ov-delta">{delta ? t("ov_vs_current", { d: signed(delta) }) : t("ov_no_better")}</p>
            </div>
          </div>
        )}
      </section>

      {partResults && <PartsStrip partResults={partResults} farm={farm} onPick={onPickPart} cropsById={cropsById} />}

      <section className="stats">
        {m?.hot_days && (
          <StatCard
            icon="thermo"
            tone="heat"
            title={t("ov_hot_h")}
            value={t("ov_hot_v", { d: signed(m.hot_days.diff) })}
            sub={t("ov_shift_sub", { a: m.hot_days.early, b: m.hot_days.recent })}
            source="NASA POWER"
            level={m.hot_days.level}
          />
        )}
        {m?.rain_mm && (
          <StatCard
            icon="rain"
            tone="water"
            title={t("ov_rain_h")}
            value={t("ov_rain_v", { d: signed(m.rain_mm.pct) })}
            sub={t("ov_shift_sub", { a: `${m.rain_mm.early} mm`, b: `${m.rain_mm.recent} mm` })}
            source="NASA POWER"
            level={m.rain_mm.level}
          />
        )}
        {water && (
          <StatCard
            icon="layers"
            tone="soil"
            title={t("ov_grace_h")}
            value={t("ov_grace_v", { d: signed(water.trend_cm_yr) })}
            sub={t("ov_grace_sub", { c: signed(water.change_cm) })}
            source="NASA GRACE / GRACE-FO"
          />
        )}
      </section>

      {et0 && rain && (
        <section className="panel">
          <header className="panel-head">
            <div>
              <p className="eyebrow">{t("ov_season_tag")}</p>
              <h3 className="display-sm">{t("ov_season_h")}</h3>
            </div>
            <ul className="legend">
              <li>
                <span className="key key-et0" /> {t("ov_legend_et0")}
              </li>
              <li>
                <span className="key key-rain" /> {t("ov_legend_rain")}
              </li>
            </ul>
          </header>
          <SeasonChart et0={et0} rain={rain} lang={lang} />
          <footer className="panel-foot">
            <span className="stat-src">NASA POWER · 2005-2024</span>
            <button className="link-arrow" onClick={() => onNavigate("climate")}>
              {t("ov_explore")} <Icon name="arrow" size="1em" />
            </button>
          </footer>
        </section>
      )}

      <section className="ov-rot">
        <header className="ov-rot-head">
          <div>
            <p className="eyebrow">{t("ov_rot_tag")}</p>
            <h3 className="display-sm">{t("ov_rot_h")}</h3>
            <p className="lede">{t("ov_rot_sub")}</p>
          </div>
          <button className="link-arrow" onClick={() => onNavigate("plan")}>
            {t("ov_full")} <Icon name="arrow" size="1em" />
          </button>
        </header>
        <div className="mini-rots">
          {baseline && (
            <MiniRotation result={baseline} tag={t("ov_baseline")} tone="base" cropsById={cropsById} features={features} onOpen={() => onNavigate("plan")} />
          )}
          {options.map((r) => (
            <MiniRotation
              key={r.id}
              result={r}
              tag={r === best ? t("ov_best_match") : t("ov_alt")}
              tone={r === best ? "best" : "alt"}
              cropsById={cropsById}
              features={features}
              onOpen={() => onNavigate("plan")}
            />
          ))}
        </div>
      </section>

      <SeasonPlan results={outcome.results} best={best} features={features} cropsById={cropsById} />
    </div>
  );
}
