// Farmer input. section="part": water, soil and the rotation of the selected
// field part (one main crop a year plus an optional second crop after the
// harvest). section="farm": priorities, income ratings and never-grow crops,
// which apply to the whole farm. Pure UI; the parent owns the state.

import { useMemo } from "react";
import { useLang } from "../../i18n/LangContext.jsx";
import { cropLabel } from "../../i18n/strings.js";
import Icon from "../components/Icon.jsx";

const MAX_YEARS = 4;

const PRIORITIES = ["water", "soil", "income", "simplicity"];
const SOILS = ["unknown", "clay", "loam", "sandy"];

export const PRESETS = {
  balanced: { water: 50, soil: 50, income: 50, simplicity: 50 },
  water: { water: 80, soil: 50, income: 40, simplicity: 50 },
  income: { water: 40, soil: 40, income: 90, simplicity: 40 },
  soil: { water: 50, soil: 90, income: 40, simplicity: 50 },
};
const PRESET_ICONS = { balanced: "scale", water: "droplet", income: "coins", soil: "leaf" };

/** Crops that can follow the main crop in the same year: summer crops after a
 * winter crop; autumn-sown crops after a spring or summer crop. */
export function secondOptions(main, crops) {
  const m = crops.find((c) => c.id === main);
  if (!m || m.season === "perennial") return [];
  return m.season === "winter"
    ? crops.filter((c) => c.season === "summer" && c.id !== "rice")
    : crops.filter((c) => c.season === "winter");
}

export default function FarmerInputs({ crops, value, onChange, ratingCrops = [], section = "all" }) {
  const { lang, t } = useLang();
  const cropName = (c) => cropLabel(c, null, lang);
  const set = (patch) => onChange({ ...value, ...patch, touched: true });
  const seq = value.current;
  const second = value.second ?? {};
  const byId = useMemo(() => Object.fromEntries(crops.map((c) => [c.id, c])), [crops]);
  const showPart = section !== "farm";
  const showFarm = section !== "part";

  const activePreset = useMemo(() => {
    for (const [key, preset] of Object.entries(PRESETS)) {
      if (PRIORITIES.every((p) => value.priorities[p] === preset[p])) return key;
    }
    return "custom";
  }, [value.priorities]);

  // Year edits keep second crops on the right year; a removed year takes its second crop with it.
  const setYear = (i, id) => {
    const next = [...seq];
    const nextSecond = {};
    if (id === "") {
      next.splice(i, 1);
      for (const [k, v] of Object.entries(second)) {
        if (+k < i) nextSecond[k] = v;
        else if (+k > i) nextSecond[+k - 1] = v;
      }
    } else {
      next[i] = id;
      Object.assign(nextSecond, second);
      const ok = secondOptions(id, crops).some((c) => c.id === second[i]);
      if (!ok) delete nextSecond[i];
    }
    set({ current: next.length ? next : ["wheat"], second: nextSecond });
  };
  const setSecond = (i, id) => {
    const next = { ...second };
    if (id) next[i] = id;
    else delete next[i];
    set({ second: next });
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

  const seasonHint = (id) => (id === "fallow" ? t("hint_fallow") : t(`hint_${byId[id]?.season ?? "summer"}`));

  return (
    <div className="inputs">
      {showPart && (
        <>
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
            <legend>{t("soil_legend")}</legend>
            <div className="seg">
              {SOILS.map((s) => (
                <button key={s} className={(value.soil ?? "unknown") === s ? "on" : ""} onClick={() => set({ soil: s })}>
                  {t(`soil_${s}`)}
                </button>
              ))}
            </div>
            <p className="note">{t("soil_hint")}</p>
          </fieldset>

          <fieldset>
            <legend>{t("rotation_legend")}</legend>
            <div className="years">
              {seq.map((id, i) => {
                const opts = secondOptions(id, crops);
                const after = byId[id]?.season === "winter" ? "summer" : "autumn";
                return (
                  <div key={i} className="year-card">
                    <span className="year-n">{t("year_n", { n: i + 1 })}</span>
                    <label className="year">
                      <span>{t("main_crop")}</span>
                      <select value={id} onChange={(e) => setYear(i, e.target.value)}>
                        {i > 0 && <option value="">{t("remove_year")}</option>}
                        <option value="fallow">{t("fallow_opt")}</option>
                        {crops.map((c) => (
                          <option key={c.id} value={c.id}>
                            {cropName(c)}
                          </option>
                        ))}
                      </select>
                      <small className="hint">{seasonHint(id)}</small>
                    </label>
                    {opts.length > 0 &&
                      (second[i] ? (
                        <label className="year second">
                          <span>{t("second_crop")}</span>
                          <select value={second[i]} onChange={(e) => setSecond(i, e.target.value)}>
                            <option value="">{t("second_remove")}</option>
                            {opts.map((c) => (
                              <option key={c.id} value={c.id}>
                                {cropName(c)}
                              </option>
                            ))}
                          </select>
                          <small className="hint">{t(`second_after_${after}`)}</small>
                        </label>
                      ) : (
                        <button className="add-second" onClick={() => setSecond(i, opts[0].id)}>
                          {t(`second_add_${after}`)}
                        </button>
                      ))}
                  </div>
                );
              })}
              {seq.length < MAX_YEARS && (
                <button className="add-year" onClick={() => set({ current: [...seq, "fallow"] })}>
                  {t("add_year")}
                </button>
              )}
            </div>
            {Object.keys(second).length > 0 && <p className="note">{t("second_note")}</p>}
          </fieldset>
        </>
      )}

      {showFarm && (
        <>
          <fieldset>
            <legend>{t("priorities")}</legend>
            <div className="preset-btns" role="group" aria-label={t("priorities")}>
              {Object.keys(PRESETS).map((k) => (
                <button key={k} type="button" className={activePreset === k ? "on" : ""} onClick={() => set({ priorities: { ...PRESETS[k] } })}>
                  <Icon name={PRESET_ICONS[k]} /> {t(`preset_${k}`)}
                </button>
              ))}
            </div>

            <details className="custom-sliders" open={activePreset === "custom"}>
              <summary>{t("preset_custom")}</summary>
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
            </details>
          </fieldset>

          <details className="ratings" open={Object.keys(ratings).length > 0}>
            <summary>{t("ratings_h")}</summary>
            <p className="note">{t("ratings_note")}</p>
            {ratingCrops.map((c) => (
              <div key={c.id} className="rating-row">
                <span>{cropName(c)}</span>
                <span className="rating-btns" role="group" aria-label={t("rating_for", { crop: cropName(c) })}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} className={ratings[c.id] === n ? "on" : ""} aria-pressed={ratings[c.id] === n} onClick={() => rate(c.id, n)}>
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
        </>
      )}
    </div>
  );
}
