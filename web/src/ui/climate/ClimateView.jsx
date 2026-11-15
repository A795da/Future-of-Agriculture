// Climate & trends: the last 12 months against normal, the frost calendar,
// normal vs dry-year rain, 20 years of hot and frosty 10-day periods, root-zone
// wetness and the recent climate shift. All from NASA POWER (cached 2005-2024
// features, or the live last 12 months); every block says so.

import { useLang } from "../../i18n/LangContext.jsx";
import { shiftScenario } from "../../features/shift.js";
import Icon from "../components/Icon.jsx";
import SatelliteMap from "./SatelliteMap.jsx";

const MONTHS = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  tr: ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"],
};
const MONTHS_LONG = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  tr: ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"],
};
const PART = { en: ["early", "mid", "late"], tr: ["başı", "ortası", "sonu"] };

const HOT_C = 35; // same threshold as the climate-shift "hot days" measure
const WARM_C = 32;
const FROST_C = 0;
const HARD_FROST_C = -10;

const signed = (v, d = 0) => (v > 0 ? `+${v.toFixed(d)}` : v.toFixed(d));
const doyDate = (doy, lang) => {
  const d = new Date(Date.UTC(2023, 0, Math.round(doy)));
  return lang === "tr" ? `${d.getUTCDate()} ${MONTHS_LONG.tr[d.getUTCMonth()]}` : `${d.getUTCDate()} ${MONTHS_LONG.en[d.getUTCMonth()]}`;
};
const dekadName = (i, lang) =>
  lang === "tr" ? `${MONTHS_LONG.tr[Math.floor(i / 3)]} ${PART.tr[i % 3]}` : `${PART.en[i % 3]} ${MONTHS_LONG.en[Math.floor(i / 3)]}`;

function Block({ eyebrow, title, takeaway, source, children, wide = false }) {
  return (
    <section className={`panel cv-block ${wide ? "cv-wide" : ""}`}>
      <header className="panel-head">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3 className="display-sm">{title}</h3>
        </div>
      </header>
      <div className="cv-body">{children}</div>
      {takeaway && (
        <p className="season-insight">
          <Icon name="info" />
          <span>{takeaway}</span>
        </p>
      )}
      <footer className="panel-foot">
        <span className="stat-src">{source}</span>
      </footer>
    </section>
  );
}

/* 1. Last 12 months compared with the 20-year normal for each month. */
function Anomalies({ conditions, features, lang }) {
  const { t } = useLang();
  const d = conditions.daily;
  const by = new Map();
  d.date.forEach((iso, i) => {
    const k = iso.slice(0, 7);
    if (!by.has(k)) by.set(k, { days: 0, rain: 0, tmax: 0, n: 0 });
    const b = by.get(k);
    b.days++;
    if (d.PRECTOTCORR[i] != null) b.rain += d.PRECTOTCORR[i];
    if (d.T2M_MAX[i] != null) {
      b.tmax += d.T2M_MAX[i];
      b.n++;
    }
  });
  const normRain = features.monthly_rain_mm.value;
  const normTmax = features.monthly_tmax_c.value;
  const rows = [...by.entries()]
    .filter(([k, b]) => b.days >= 25) // part months at either end are left out
    .map(([k, b]) => {
      const m = +k.slice(5, 7) - 1;
      const nr = normRain[m];
      const rainDiff = b.rain - nr;
      const pct = nr >= 10 ? Math.round((rainDiff / nr) * 100) : null;
      return { key: k, m, year: k.slice(0, 4), rain: Math.round(b.rain), nr: Math.round(nr), rainDiff, pct, tdiff: b.tmax / b.n - normTmax[m] };
    });
  if (!rows.length) return null;
  const rainScore = (r) => (r.pct != null ? r.pct : (r.rainDiff / Math.max(r.nr, 1)) * 100);
  // Months that normally get under 10 mm would swing wildly in %, so they are not ranked.
  const ranked = rows.filter((r) => r.pct != null);
  const driest = (ranked.length ? ranked : rows).reduce((a, b) => (rainScore(b) < rainScore(a) ? b : a));
  const hottest = rows.reduce((a, b) => (b.tdiff > a.tdiff ? b : a));
  const maxPct = 100;
  const maxT = Math.max(3, ...rows.map((r) => Math.abs(r.tdiff)));
  const name = (r) => `${MONTHS_LONG[lang][r.m]} ${r.year}`;
  // Turkish writes the percent sign first: -%32.
  const pctText = (v) => (lang === "tr" ? `${v > 0 ? "+" : v < 0 ? "-" : ""}%${Math.abs(v)}` : `${v > 0 ? "+" : ""}${v}%`);

  return (
    <Block
      wide
      eyebrow={t("cv_anom_tag")}
      title={t("cv_anom_h")}
      source={`NASA POWER · ${conditions.period.start} – ${conditions.period.end} · ${t("cv_vs_normal")}`}
      takeaway={t("cv_anom_take", {
        dry: name(driest),
        dryv: driest.pct != null ? pctText(driest.pct) : `${signed(driest.rainDiff)} mm`,
        hot: name(hottest),
        hotv: signed(hottest.tdiff, 1),
      })}
    >
      <div className="anom">
        <div className="anom-head">
          <span />
          <span>{t("cv_rain_vs")}</span>
          <span>{t("cv_temp_vs")}</span>
        </div>
        {rows.map((r) => {
          const p = Math.max(-maxPct, Math.min(maxPct, rainScore(r)));
          return (
            <div key={r.key} className="anom-row">
              <span className="anom-month">
                {MONTHS[lang][r.m]} <small>{r.year.slice(2)}</small>
              </span>
              <span className="div-bar" title={`${r.rain} mm / ${r.nr} mm`}>
                <span className={`div-fill ${p < 0 ? "neg dry" : "pos wet"}`} style={{ width: `${(Math.abs(p) / maxPct) * 50}%` }} />
                <em>{r.pct != null ? pctText(r.pct) : `${signed(r.rainDiff)} mm`}</em>
              </span>
              <span className="div-bar">
                <span className={`div-fill ${r.tdiff < 0 ? "neg cool" : "pos warm"}`} style={{ width: `${(Math.abs(r.tdiff) / maxT) * 50}%` }} />
                <em>{signed(r.tdiff, 1)} °C</em>
              </span>
            </div>
          );
        })}
        <p className="note">{t("cv_anom_note")}</p>
      </div>
    </Block>
  );
}

/* 2. Frost calendar: frost nights per month plus last/first frost dates. */
function FrostCalendar({ features, lang }) {
  const { t } = useLang();
  const fd = features.frost_days_by_month.value;
  const last = features.last_spring_frost_doy.value;
  const first = features.first_autumn_frost_doy.value;
  const free = features.frost_free_days.value;
  const cold = features.yearly_min_temp_c.value;
  return (
    <Block
      eyebrow={t("cv_frost_tag")}
      title={t("cv_frost_h")}
      source="NASA POWER · 2005-2024"
      takeaway={t("cv_frost_take", { last: doyDate(last, lang), first: doyDate(first, lang), free, cold })}
    >
      <div className="frost-strip">
        {fd.map((v, i) => (
          <div key={i} className="frost-cell" style={{ "--f": Math.min(1, v / 28) }} title={`${v}`}>
            <span className="frost-m">{MONTHS[lang][i]}</span>
            <strong>{v >= 1 ? Math.round(v) : v > 0 ? "<1" : "0"}</strong>
          </div>
        ))}
      </div>
      <div className="frost-dates">
        <div>
          <p className="eyebrow">{t("cv_last_frost")}</p>
          <p className="cv-big">{doyDate(last, lang)}</p>
        </div>
        <div>
          <p className="eyebrow">{t("cv_frost_free")}</p>
          <p className="cv-big">{t("cv_days", { n: free })}</p>
        </div>
        <div>
          <p className="eyebrow">{t("cv_first_frost")}</p>
          <p className="cv-big">{doyDate(first, lang)}</p>
        </div>
      </div>
      <p className="note">{t("cv_frost_note")}</p>
    </Block>
  );
}

/* 3. Normal vs dry-year rain against the water the air pulls (ET0). */
function DryYear({ features, lang }) {
  const { t } = useLang();
  const normal = features.monthly_rain_mm.value;
  const dry = features.monthly_rain_dry_mm.value;
  const et0 = features.monthly_et0_mm.value;
  const W = 520;
  const H = 210;
  const pad = { l: 30, r: 6, t: 10, b: 22 };
  const max = Math.max(...normal, ...et0) * 1.08;
  const step = (W - pad.l - pad.r) / 12;
  const y = (v) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const bw = step * 0.32;
  const et0Path = et0.map((v, i) => `${i ? "L" : "M"}${(pad.l + step * (i + 0.5)).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  // Growing-season months where a dry year loses the most rain, in relative terms.
  const drop = normal.map((v, i) => ({ i, v, d: dry[i], rel: v >= 10 ? (v - dry[i]) / v : 0 }));
  const worst = drop.reduce((a, b) => (b.rel > a.rel ? b : a));
  const ticks = [0, Math.round(max / 2 / 10) * 10, Math.round((max * 0.95) / 10) * 10];
  return (
    <Block
      eyebrow={t("cv_dry_tag")}
      title={t("cv_dry_h")}
      source="NASA POWER · 2005-2024"
      takeaway={t("cv_dry_take", {
        annual: features.annual_rain_mm.value,
        dryannual: features.annual_rain_dry_mm.value,
        m: MONTHS_LONG[lang][worst.i],
        n: Math.round(worst.v),
        d: Math.round(worst.d),
      })}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="cv-svg" role="img" aria-label={t("cv_dry_h")}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="grid-line" />
            <text x={pad.l - 4} y={y(v) + 3} textAnchor="end" className="axis-text">
              {v}
            </text>
          </g>
        ))}
        {normal.map((v, i) => {
          const cx = pad.l + step * (i + 0.5);
          return (
            <g key={i}>
              <rect x={cx - bw - 1} y={y(v)} width={bw} height={y(0) - y(v)} rx="2" className="bar-normal" />
              <rect x={cx + 1} y={y(dry[i])} width={bw} height={y(0) - y(dry[i])} rx="2" className="bar-dry" />
              <text x={cx} y={H - 6} textAnchor="middle" className="axis-text">
                {MONTHS[lang][i]}
              </text>
            </g>
          );
        })}
        <path d={et0Path} className="et0-line" />
      </svg>
      <ul className="legend cv-legend">
        <li>
          <span className="key key-normal" /> {t("cv_normal_year")}
        </li>
        <li>
          <span className="key key-dry" /> {t("cv_dry_year")}
        </li>
        <li>
          <span className="key key-et0" /> {t("ov_legend_et0")}
        </li>
      </ul>
    </Block>
  );
}

/* 4. Every 10-day period of the last 20 years: hottest day and coldest night. */
function ExtremesGrid({ features, lang }) {
  const { t } = useLang();
  const years = features.dekad_extremes_by_year.value;
  const hotYears = Array.from({ length: 36 }, (_, i) => years.filter((y) => (y.tmax_abs[i] ?? -99) >= HOT_C).length);
  const anyHot = years.filter((y) => y.tmax_abs.some((v) => v >= HOT_C)).length;
  const peak = hotYears.indexOf(Math.max(...hotYears));
  const hardYears = years.filter((y) => y.tmin_abs.some((v) => v <= HARD_FROST_C)).length;
  const cls = (tmax, tmin) =>
    tmax >= HOT_C ? "x-hot" : tmin <= HARD_FROST_C ? "x-hard" : tmin <= FROST_C ? "x-frost" : tmax >= WARM_C ? "x-warm" : "x-ok";
  return (
    <Block
      wide
      eyebrow={t("cv_grid_tag")}
      title={t("cv_grid_h")}
      source={`NASA POWER · ${years[0].year}-${years.at(-1).year}`}
      takeaway={
        anyHot
          ? t("cv_grid_take", { hot: anyHot, n: years.length, peak: dekadName(peak, lang), py: hotYears[peak], hard: hardYears })
          : t("cv_grid_take_nohot", { n: years.length, hard: hardYears })
      }
    >
      <div className="xgrid-wrap">
        <div className="xgrid" style={{ gridTemplateColumns: `2.6rem repeat(36, minmax(6px, 1fr))` }}>
          <span />
          {Array.from({ length: 36 }, (_, i) => (
            <span key={i} className="xgrid-m">
              {i % 3 === 0 ? MONTHS[lang][i / 3] : ""}
            </span>
          ))}
          {years.map((y) => (
            <div key={y.year} className="xgrid-row">
              <span className="xgrid-y">{y.year}</span>
              {y.tmax_abs.map((tx, i) => (
                <span
                  key={i}
                  className={`xcell ${cls(tx, y.tmin_abs[i])}`}
                  title={`${y.year} · ${dekadName(i, lang)}: ${t("cv_max")} ${tx} °C, ${t("cv_min")} ${y.tmin_abs[i]} °C`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <ul className="legend cv-legend">
        <li><span className="key x-hot" /> {t("cv_k_hot")}</li>
        <li><span className="key x-warm" /> {t("cv_k_warm")}</li>
        <li><span className="key x-frost" /> {t("cv_k_frost")}</li>
        <li><span className="key x-hard" /> {t("cv_k_hard")}</li>
      </ul>
    </Block>
  );
}

/* 5. Root-zone wetness by month (NASA model estimate). */
function SoilMoisture({ features, lang }) {
  const { t } = useLang();
  const w = features.root_zone_wetness_by_month.value;
  const hi = w.indexOf(Math.max(...w));
  const lo = w.indexOf(Math.min(...w));
  return (
    <Block
      eyebrow={t("cv_soil_tag")}
      title={t("cv_soil_h")}
      source={`NASA POWER · ${t("cv_model")} · 2005-2024`}
      takeaway={t("cv_soil_take", { hi: MONTHS_LONG[lang][hi], hv: w[hi].toFixed(2), lo: MONTHS_LONG[lang][lo], lv: w[lo].toFixed(2) })}
    >
      <div className="wet-bars">
        {w.map((v, i) => (
          <div key={i} className="wet-col">
            <span className="wet-v">{v.toFixed(2)}</span>
            <span className="wet-track">
              <span className="wet-fill" style={{ height: `${v * 100}%` }} />
            </span>
            <span className="wet-m">{MONTHS[lang][i]}</span>
          </div>
        ))}
      </div>
      <p className="note">{t("cv_soil_note")}</p>
    </Block>
  );
}

/* 6. Recent climate shift as bars, with the one-tap what-if. */
const ORDER = ["temp_c", "hot_days", "rain_mm", "heavy_rain_days", "dry_spell_days", "frost_nights", "last_spring_frost_doy", "spring_soil_wetness"];

function ShiftBars({ shift, onApply }) {
  const { t } = useLang();
  const m = shift.measures;
  const fmt = (k, v) => (k === "spring_soil_wetness" ? v.toFixed(2) : k === "temp_c" ? v.toFixed(1) : String(v));
  const change = (k, s) =>
    k === "rain_mm" ? `${s.pct > 0 ? "+" : ""}${s.pct}%` : `${s.diff > 0 ? "+" : ""}${k === "spring_soil_wetness" ? s.diff.toFixed(2) : s.diff}`;
  const sc = shiftScenario(shift);
  const clear = ORDER.filter((k) => m[k]?.level === "clear").length;
  const possible = ORDER.filter((k) => m[k]?.level === "possible").length;
  return (
    <Block
      eyebrow={t("cv_shift_tag")}
      title={t("shift_title")}
      source={`NASA POWER · ${t("shift_period", { from: shift.recent_from, to: shift.years[1], a: shift.years[0], b: shift.recent_from - 1 })}`}
      takeaway={t("cv_shift_take", { c: clear, p: possible })}
    >
      <div className="zbars">
        {ORDER.filter((k) => m[k]).map((k) => {
          const s = m[k];
          const z = Math.max(-3, Math.min(3, s.z));
          return (
            <div key={k} className={`zrow lvl-${s.level}`}>
              <span className="zlabel">{t(`shift_${k}`)}</span>
              <span className="znum">
                {fmt(k, s.early)} → {fmt(k, s.recent)}
              </span>
              <span className="zbar">
                <span className="zmark z1n" />
                <span className="zmark z1p" />
                <span className="zmark z2n" />
                <span className="zmark z2p" />
                <span className={`zfill ${z < 0 ? "neg" : "pos"}`} style={{ width: `${(Math.abs(z) / 3) * 50}%` }} />
              </span>
              <span className="znum">{change(k, s)}</span>
              <span className={`badge badge-${s.level}`}>{t(`shift_level_${s.level}`)}</span>
            </div>
          );
        })}
      </div>
      <p className="note">{t("cv_shift_bar_note")}</p>
      <button className="chip-btn shift-btn" onClick={() => onApply(sc)}>
        {t("shift_apply", { t: sc.tempC, r: `${sc.rainPct > 0 ? "+" : ""}${sc.rainPct}` })}
      </button>
    </Block>
  );
}

export default function ClimateView({ features, conditions, chartStatus, chart, shift, onApplyShift, status, lat, lon, place }) {
  const { lang, t } = useLang();
  if (status === "loading" || !features) return <p className="muted">{t("loading_climate")}</p>;
  if (status === "error") return <p className="warn">{t("climate_error")}</p>;
  return (
    <div className="cv">
      <SatelliteMap lat={lat} lon={lon} place={place} />
      {chart}
      {conditions && chartStatus === "ready" ? (
        <Anomalies conditions={conditions} features={features} lang={lang} />
      ) : null}
      <div className="cv-grid">
        <FrostCalendar features={features} lang={lang} />
        <DryYear features={features} lang={lang} />
      </div>
      <ExtremesGrid features={features} lang={lang} />
      <div className="cv-grid cv-grid-b">
        <SoilMoisture features={features} lang={lang} />
        {shift ? <ShiftBars shift={shift} onApply={onApplyShift} /> : null}
      </div>
    </div>
  );
}
