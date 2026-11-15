// Hourly strip for the day picked in the 7-day forecast: every 3 hours, plus
// spray hours (wind 3-15 km/h, daylight, no rain soon). Open-Meteo, not NASA.

import { useMemo } from "react";
import Icon from "../components/Icon.jsx";
import { useLang } from "../../i18n/LangContext.jsx";
import { dayLabel } from "../../i18n/strings.js";
import { sprayDay } from "../../scoring/spray.js";

const STEP = 3; // show one column every 3 hours
const hh = (h) => `${String(h).padStart(2, "0")}:00`;

export function skyIcon(sky, isDay = true) {
  if (sky === "clear") return isDay === false ? "moon" : "sun";
  if (sky === "partly") return isDay === false ? "moon" : "partly";
  if (sky === "cloudy") return "cloud";
  if (sky === "showers") return "rain";
  return sky;
}

export default function HourlyStrip({ days, index }) {
  const { lang, t } = useLang();
  const day = days[index];
  const all = useMemo(() => days.flatMap((d) => d.hours ?? []), [days]);
  const spray = useMemo(() => (day?.hours?.length ? sprayDay(all, day.date) : null), [all, day]);

  const skyWord = (h) => t(h.sky === "clear" && h.is_day === false ? "sky_clear_night" : `sky_${h.sky}`);
  if (!day) return null;
  if (!day.hours?.length) return <p className="note">{t("hourly_none")}</p>;

  const dl = dayLabel(day.date, lang);
  const shown = day.hours.filter((h) => h.hour % STEP === 0);
  const ranges = spray.windows.map((w) => `${hh(w.from)}–${hh(w.to)}`).join(", ");

  return (
    <section className="hourly" aria-label={t("hourly_title", { d: `${dl.day} ${dl.date}` })}>
      <header className="week-head">
        <h3>{t("hourly_title", { d: `${dl.day} ${dl.date}` })}</h3>
        <span>°C · mm · km/h</span>
      </header>
      <ol className="hours">
        {shown.map((h) => (
          <li key={h.time} className={`hour${spray.verdicts[h.hour] === "ok" ? " is-spray" : ""}`}>
            <span className="hour-time">{hh(h.hour)}</span>
            {h.sky && (
              <span className={`hour-sky sky-${h.sky}`} title={skyWord(h)}>
                <Icon name={skyIcon(h.sky, h.is_day)} size="22" />
                <span className="sr-only">{skyWord(h)}</span>
              </span>
            )}
            <span className="hour-temp">{Math.round(h.temp)}°</span>
            <span className="hour-rain">
              {h.rain >= 0.1 ? `${h.rain.toFixed(1)} mm` : h.rain_prob != null && h.rain_prob >= 20 ? `${h.rain_prob}%` : "–"}
            </span>
            <span className="hour-wind" title={h.gust != null ? t("gusts", { g: Math.round(h.gust) }) : undefined}>
              <Icon name="wind" size="14" /> {h.wind != null ? Math.round(h.wind) : "–"}
            </span>
          </li>
        ))}
      </ol>
      <p className={`spray-note${spray.windows.length ? " is-ok" : ""}`}>
        <Icon name={spray.windows.length ? "check" : "info"} />
        <span>
          {spray.windows.length ? (
            <>
              <b>{t("spray_ok")}</b> {ranges}
            </>
          ) : (
            <>
              <b>{t("spray_none")}</b> {t(`spray_why_${spray.reason}`)}
            </>
          )}
          <span className="muted"> · {t("spray_rule")}</span>
        </span>
      </p>
    </section>
  );
}
