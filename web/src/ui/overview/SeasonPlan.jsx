// Season plan for a rotation: a calendar strip (July to June, one block per
// rotation year) with every crop from sowing to harvest, flowering and the bare
// gaps, then a line per crop with dates, days in the field and the nutrients the
// harvest takes out. Dates come from rotationCalendar (the same placement the
// scores use); nutrients from nutrientBalance.per_crop. Amounts removed only,
// never fertiliser doses (team decision).

import { useMemo, useState } from "react";
import { useLang } from "../../i18n/LangContext.jsx";
import { cropLabel } from "../../i18n/strings.js";
import { rotationCalendar } from "../../scoring/calendar.js";
import Icon from "../components/Icon.jsx";

const MONTHS = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  tr: ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"],
};
const MONTHS_LONG = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  tr: ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"],
};
const MONTH_START = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
const ROT_MONTHS = [6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5]; // a rotation year runs July to June

/** Day of year → "early Oct" / "Ekim başı". */
export function doyLabel(doy, lang) {
  let m = 11;
  while (m > 0 && MONTH_START[m] > doy) m--;
  const day = doy - MONTH_START[m] + 1;
  const part = day <= 10 ? 0 : day <= 20 ? 1 : 2;
  return lang === "tr"
    ? `${MONTHS_LONG.tr[m]} ${["başı", "ortası", "sonu"][part]}`
    : `${["early", "mid", "late"][part]} ${MONTHS_LONG.en[m]}`;
}

export function cropTone(id, cropsById) {
  if (id === "fallow") return "fallow";
  const fam = cropsById?.[id]?.family;
  if (fam === "poaceae") return "cereal";
  if (fam === "fabaceae") return "legume";
  return "other";
}

/** Bars on a cyclic strip: a crop that runs past the end wraps to the start. */
function segments(offset, days, total) {
  const end = offset + days;
  return end <= total ? [[offset, days]] : [[offset, total - offset], [0, end - total]];
}

export function CalendarStrip({ cal, cropsById, compact = false }) {
  const { lang } = useLang();
  const pct = (d) => `${(d / cal.total) * 100}%`;
  return (
    <div className={`cal-strip ${compact ? "compact" : ""}`} aria-hidden={compact}>
      {!compact && (
        <div className="cal-years" style={{ gridTemplateColumns: `repeat(${cal.years}, 1fr)` }}>
          {Array.from({ length: cal.years }, (_, y) => (
            <span key={y}>{lang === "tr" ? `${y + 1}. yıl` : `Year ${y + 1}`}</span>
          ))}
        </div>
      )}
      <div className="cal-track">
        {Array.from({ length: cal.years * 12 }, (_, i) => (
          <span key={i} className={`cal-month ${i % 12 === 0 ? "year-start" : ""}`} style={{ left: pct((i * 365) / 12) }} />
        ))}
        {cal.gaps.map((g, i) =>
          segments(g.offset, g.days, cal.total).map(([o, d], k) => (
            <span key={`g${i}${k}`} className="cal-gap" style={{ left: pct(o), width: pct(d) }} />
          ))
        )}
        {cal.plantings.map((p, i) =>
          segments(p.offset, p.days, cal.total).map(([o, d], k) => (
            <span
              key={`p${i}${k}`}
              className={`cal-bar seq-${cropTone(p.id, cropsById)} ${p.second ? "second" : ""} ${compact ? "" : "row-" + (p.second ? 1 : 0)}`}
              style={{ left: pct(o), width: pct(d) }}
              title={cropLabel(p.id, cropsById, lang)}
            >
              {!compact && k === 0 && d > cal.total * 0.07 && <em>{cropLabel(p.id, cropsById, lang)}</em>}
            </span>
          ))
        )}
        {!compact &&
          cal.plantings
            .filter((p) => p.flowerDoy != null)
            .map((p, i) => {
              const dd = (p.flowerDoy - p.sowDoy + 365) % 365;
              return <span key={`f${i}`} className={`cal-flower ${p.second ? "row-1" : "row-0"}`} style={{ left: pct((p.offset + dd) % cal.total) }} />;
            })}
      </div>
      {!compact && (
        <div className="cal-months" style={{ gridTemplateColumns: `repeat(${cal.years * 12}, minmax(0, 1fr))` }}>
          {Array.from({ length: cal.years * 12 }, (_, i) => (
            <span key={i}>{MONTHS[lang][ROT_MONTHS[i % 12]]}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function PlanList({ cal, nutrients, cropsById }) {
  const { lang, t } = useLang();
  const name = (id) => cropLabel(id, cropsById, lang);
  // Match each planting with its nutrient entry (same crop, main or second).
  const pool = [...(nutrients?.per_crop ?? [])];
  const take = (p) => {
    const i = pool.findIndex((n) => n.id === p.id && n.second === p.second);
    return i >= 0 ? pool.splice(i, 1)[0] : null;
  };
  const rows = cal.plantings.map((p) => ({ p, n: take(p) }));
  // Interleave the bare gaps after the planting they follow (by offset on the cycle).
  const items = [];
  rows.forEach((r, i) => {
    items.push({ kind: "crop", ...r });
    const end = (r.p.offset + r.p.days) % cal.total;
    const gap = cal.gaps.find((g) => Math.abs(g.offset - end) <= 1);
    if (gap) items.push({ kind: "gap", gap, prev: r, next: rows[(i + 1) % rows.length] });
  });

  return (
    <ol className="plan-list">
      {items.map((it, i) =>
        it.kind === "crop" ? (
          <li key={i} className="pl-crop">
            <span className={`pl-dot seq-${cropTone(it.p.id, cropsById)}`} />
            <div>
              <p className="pl-title">
                <strong>{name(it.p.id)}</strong>
                <span className="muted">
                  {" · "}
                  {it.p.second ? t("sp_second_in_year", { n: it.p.year + 1 }) : t("year_n", { n: it.p.year + 1 })}
                </span>
              </p>
              <ul className="pl-facts">
                <li>
                  <Icon name="calendar" size="1em" /> {t("sp_sow")}: <strong>{doyLabel(it.p.sowDoy, lang)}</strong>
                </li>
                {it.p.flowerDoy != null && (
                  <li>
                    <Icon name="sun" size="1em" /> {t("sp_flower")}: <strong>{doyLabel(it.p.flowerDoy, lang)}</strong>
                  </li>
                )}
                <li>
                  <Icon name="check" size="1em" /> {t("sp_harvest")}: <strong>{it.p.perennial ? t("sp_perennial") : doyLabel(it.p.harvestDoy, lang)}</strong>
                </li>
                <li>
                  <Icon name="rotate" size="1em" /> <strong>{t("sp_days", { n: it.p.days })}</strong>
                </li>
              </ul>
              {it.n && (
                <p className="pl-nutr">
                  <Icon name="leaf" size="1em" />{" "}
                  {t("sp_removes", { n: it.n.n, p: it.n.p2o5, k: it.n.k2o, y: it.n.yield_t_ha })}
                  {it.n.n_fixed > 0 && ` ${t("sp_fixes", { n: it.n.n_fixed })}`}
                </p>
              )}
              <p className="pl-src">{it.p.calendar === "TAGEM-DSİ 2017" ? t("sp_src_tagem") : it.p.thermal ? t("sp_src_thermal") : t("sp_src_table")}</p>
            </div>
          </li>
        ) : (
          <li key={i} className="pl-gap">
            <span className="pl-dot gap" />
            <div>
              <p className="pl-title">
                <strong>{t("sp_bare", { from: doyLabel(it.gap.fromDoy, lang), to: doyLabel(it.gap.toDoy, lang) })}</strong>
                <span className="muted"> · {t("sp_gap_days", { n: it.gap.days })}</span>
              </p>
              {it.next?.n && (
                <p className="pl-nutr feed">
                  <Icon name="droplet" size="1em" />{" "}
                  {t("sp_before_next", { crop: name(it.next.p.id), n: it.next.n.n, p: it.next.n.p2o5, k: it.next.n.k2o })}
                  {it.prev?.n?.n_fixed > 0 && ` ${t("sp_after_legume", { crop: name(it.prev.p.id), n: it.prev.n.n_fixed })}`}
                  {cropsById?.[it.next.p.id]?.is_legume && ` ${t("sp_next_legume", { crop: name(it.next.p.id) })}`}
                </p>
              )}
              <p className="pl-src">{t("sp_gap_note")}</p>
            </div>
          </li>
        )
      )}
    </ol>
  );
}

export default function SeasonPlan({ results, best, features, cropsById }) {
  const { t, lang } = useLang();
  const [pick, setPick] = useState(null);
  const chosen = results.find((r) => r.id === pick) ?? best ?? results[0];
  const cal = useMemo(
    () => (chosen && features && cropsById ? rotationCalendar(chosen.sequence, chosen.second_crops ?? {}, cropsById, features) : null),
    [chosen, features, cropsById]
  );
  if (!cal) return null;
  const tag = (r) => (r.is_baseline ? t("ov_baseline") : r === best ? t("ov_best_match") : t("ov_alt"));
  const rotName = (r) =>
    r.sequence.map((id, i) => cropLabel(id, cropsById, lang) + (r.second_crops?.[i] ? ` + ${cropLabel(r.second_crops[i], cropsById, lang)}` : "")).join(" › ");

  return (
    <section className="panel season-plan">
      <header className="panel-head">
        <div>
          <p className="eyebrow">{t("sp_tag")}</p>
          <h3 className="display-sm">{t("sp_h")}</h3>
        </div>
        <div className="sp-tabs" role="tablist" aria-label={t("sp_h")}>
          {results.map((r) => (
            <button key={r.id} role="tab" aria-selected={r === chosen} className={r === chosen ? "on" : ""} onClick={() => setPick(r.id)}>
              <small>{tag(r)}</small>
              <span>{rotName(r)}</span>
            </button>
          ))}
        </div>
      </header>
      <div className="cv-body">
        <CalendarStrip cal={cal} cropsById={cropsById} />
        <ul className="legend cv-legend">
          <li><span className="key seq-cereal" /> {t("sp_k_cereal")}</li>
          <li><span className="key seq-legume" /> {t("sp_k_legume")}</li>
          <li><span className="key seq-other" /> {t("sp_k_other")}</li>
          <li><span className="key cal-key-flower" /> {t("sp_k_flower")}</li>
          <li><span className="key cal-key-gap" /> {t("sp_k_gap")}</li>
        </ul>
        <PlanList cal={cal} nutrients={chosen.nutrients} cropsById={cropsById} />
      </div>
      <p className="season-insight">
        <Icon name="info" />
        <span>{t("sp_note")}</span>
      </p>
      <footer className="panel-foot">
        <span className="stat-src">{t("sp_sources")}</span>
      </footer>
    </section>
  );
}
