// Farmer input: irrigation, current rotation (one crop per year), priorities
// and crops they will never grow. Pure UI; the parent owns the state.

import { useLang } from "../../i18n/LangContext.jsx";
import { cropLabel } from "../../i18n/strings.js";

const MAX_YEARS = 4;

const PRIORITIES = ["water", "soil", "income", "simplicity"];

export default function FarmerInputs({ crops, value, onChange, ratingCrops = [] }) {
  const { lang, t } = useLang();
  const cropName = (c) => cropLabel(c, null, lang);
  const set = (patch) => onChange({ ...value, ...patch, touched: true });
  const seq = value.current;

  const setYear = (i, id) => {
    const next = [...seq];
    if (id === "") next.splice(i, 1);
    else next[i] = id;
    set({ current: next.length ? next : ["wheat"] });
  };
  const ratings = value.ratings ?? {};
  const rate = (id, n) => {
    const next = { ...ratings };
    if (next[id] === n) delete next[id]; // tap the same value again to clear it
    else next[id] = n;
    set({ ratings: next });
  };
  const toggleNever = (id) =>
    set({ never: value.never.includes(id) ? value.never.filter((x) => x !== id) : [...value.never, id] });

  return (
    <div className="inputs">
      <fieldset>
        <legend>{t("water")}</legend>
        <div className="seg">
          <button className={value.irrigation === "rainfed" ? "on" : ""} onClick={() => set({ irrigation: "rainfed" })}>
            {t("rainfed")}
          </button>
          <button className={value.irrigation === "irrigated" ? "on" : ""} onClick={() => set({ irrigation: "irrigated" })}>
            {t("irrigated")}
          </button>
        </div>
      </fieldset>

      <fieldset>
        <legend>{t("rotation_legend")}</legend>
        <div className="years">
          {seq.map((id, i) => (
            <label key={i} className="year">
              <span>{t("year_n", { n: i + 1 })}</span>
              <select value={id} onChange={(e) => setYear(i, e.target.value)}>
                {i > 0 && <option value="">{t("remove_year")}</option>}
                <option value="fallow">{t("fallow_opt")}</option>
                {crops.map((c) => (
                  <option key={c.id} value={c.id}>
                    {cropName(c)}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {seq.length < MAX_YEARS && (
            <button className="add-year" onClick={() => set({ current: [...seq, "fallow"] })}>
              {t("add_year")}
            </button>
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend>{t("priorities")}</legend>
        {PRIORITIES.map((key) => (
          <label key={key} className="slider">
            <span>{t(`p_${key}`)}</span>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={value.priorities[key]}
              onChange={(e) => set({ priorities: { ...value.priorities, [key]: +e.target.value } })}
            />
            <output>{value.priorities[key]}</output>
          </label>
        ))}
      </fieldset>

      <details className="ratings" open={Object.keys(ratings).length > 0}>
        <summary>{t("ratings_h")}</summary>
        <p className="note">{t("ratings_note")}</p>
        {ratingCrops.map((c) => (
          <div key={c.id} className="rating-row">
            <span>{cropName(c)}</span>
            <span className="rating-btns" role="group" aria-label={t("rating_for", { crop: cropName(c) })}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  className={ratings[c.id] === n ? "on" : ""}
                  aria-pressed={ratings[c.id] === n}
                  onClick={() => rate(c.id, n)}
                >
                  {n}
                </button>
              ))}
            </span>
          </div>
        ))}
      </details>

      <fieldset>
        <legend>{t("never")}</legend>
        <div className="chips">
          {crops.map((c) => (
            <button
              key={c.id}
              className={`chip-btn ${value.never.includes(c.id) ? "on" : ""}`}
              aria-pressed={value.never.includes(c.id)}
              onClick={() => toggleNever(c.id)}
            >
              {cropName(c)}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
