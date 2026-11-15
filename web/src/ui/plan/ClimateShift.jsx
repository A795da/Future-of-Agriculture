// Recent climate shift for this province (NASA POWER): last 5 years vs the earlier
// years, each measure marked clear / possible / no clear change, plus one tap to
// re-rank the rotations as if the recent warming and rain change continue.

import { useLang } from "../../i18n/LangContext.jsx";
import { shiftScenario } from "../../features/shift.js";

const ORDER = ["temp_c", "hot_days", "rain_mm", "heavy_rain_days", "dry_spell_days", "frost_nights", "last_spring_frost_doy", "spring_soil_wetness"];

export default function ClimateShift({ shift, onScenario }) {
  const { t } = useLang();
  if (!shift) return null;
  const m = shift.measures;
  const fmt = (k, v) => (k === "spring_soil_wetness" ? v.toFixed(2) : k === "temp_c" ? v.toFixed(1) : String(v));
  const change = (k, s) => {
    if (k === "rain_mm") return `${s.pct > 0 ? "+" : ""}${s.pct}%`;
    const d = k === "spring_soil_wetness" ? s.diff.toFixed(2) : s.diff;
    return `${s.diff > 0 ? "+" : ""}${d}`;
  };
  const sc = shiftScenario(shift);
  return (
    <details className="shift" open>
      <summary>
        <strong>{t("shift_title")}</strong>{" "}
        <span className="muted">{t("shift_period", { from: shift.recent_from, to: shift.years[1], a: shift.years[0], b: shift.recent_from - 1 })}</span>
      </summary>
      <table>
        <tbody>
          {ORDER.filter((k) => m[k]).map((k) => (
            <tr key={k} className={`lvl-${m[k].level}`}>
              <td>{t(`shift_${k}`)}</td>
              <td className="num">
                {fmt(k, m[k].early)} → {fmt(k, m[k].recent)}
              </td>
              <td className="num">{change(k, m[k])}</td>
              <td>
                <span className={`badge badge-${m[k].level}`}>{t(`shift_level_${m[k].level}`)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="chip-btn shift-btn" onClick={() => onScenario(sc)}>
        {t("shift_apply", { t: sc.tempC, r: `${sc.rainPct > 0 ? "+" : ""}${sc.rainPct}` })}
      </button>
      <p className="note">{t("shift_note")}</p>
    </details>
  );
}
