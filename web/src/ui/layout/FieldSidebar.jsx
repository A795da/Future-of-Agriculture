// Left sidebar: the one province picker, a summary of the active field and farm,
// the priority presets, the NASA data card and the disclaimer.

import { useLang } from "../../i18n/LangContext.jsx";
import { PRESETS } from "../plan/FarmerInputs.jsx";
import { formatArea } from "../../field/geometry.js";
import Icon from "../components/Icon.jsx";
import { partName, partRotation } from "./PartSwitcher.jsx";

const PRESET_ICONS = { balanced: "scale", water: "droplet", income: "coins", soil: "leaf" };
const KEYS = ["water", "soil", "income", "simplicity"];

export default function FieldSidebar({ provinces, pointId, onPoint, point, field, onField, inputs, onInputs, farm, onPickPart, onAddPart, cropsById, locLabel, onEdit, onForget }) {
  const part = farm.parts.find((p) => p.id === farm.activePart) ?? farm.parts[0];
  const { lang, t } = useLang();
  const active = Object.keys(PRESETS).find((k) => KEYS.every((p) => inputs.priorities[p] === PRESETS[k][p])) ?? "custom";
  // Priorities do not change the default rotation, so they leave `touched` alone.
  const setPreset = (k) => onInputs({ ...inputs, priorities: { ...PRESETS[k] } });

  return (
    <aside className="sidebar">
      <section className="sb-block">
        <p className="eyebrow">{t("sb_active")}</p>
        <label className="sb-select">
          <Icon name="pin" />
          <select value={pointId} onChange={(e) => onPoint(e.target.value)} aria-label={t("province")}>
            {provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {String(p.plate).padStart(2, "0")} · {p.name}
              </option>
            ))}
          </select>
        </label>
        <p className="sb-place">{locLabel}</p>
        {farm.parts.length > 1 && (
          <div className="sb-parts" role="group" aria-label={t("parts_h")}>
            {farm.parts.map((p) => (
              <button key={p.id} className={p.id === part.id ? "on" : ""} aria-pressed={p.id === part.id} onClick={() => onPickPart(p.id)}>
                {partName(p, farm.parts, t)}
              </button>
            ))}
          </div>
        )}
        <dl className="kv">
          <div>
            <dt>{t("sb_area")}</dt>
            <dd>
              {part.area_ha
                ? formatArea(part.area_ha)
                : onField && field.area_ha
                  ? formatArea(field.area_ha)
                  : t("sb_province_centre")}
            </dd>
          </div>
          <div>
            <dt>{t("sb_water")}</dt>
            <dd>{t(inputs.irrigation)}</dd>
          </div>
          <div>
            <dt>{t("sb_soil")}</dt>
            <dd>{t(`soil_${inputs.soil}`)}</dd>
          </div>
          <div>
            <dt>{t("sb_rotation")}</dt>
            <dd>{partRotation(part, cropsById, lang)}</dd>
          </div>
        </dl>
        <button className="sb-edit" onClick={onEdit}>
          <Icon name="edit" /> {t("sb_edit")}
        </button>
        {farm.parts.length < 4 && (
          <button className="sb-add-part" onClick={onAddPart}>
            <Icon name="map" /> {t("sb_add_part")}
          </button>
        )}
        {farm.parts.length === 1 && <p className="sb-sub">{t("sb_add_part_hint")}</p>}
      </section>

      <section className="sb-block">
        <p className="eyebrow">{t("sb_priorities")}</p>
        <p className="sb-sub">{t("sb_priorities_sub")}</p>
        <div className="sb-presets" role="radiogroup" aria-label={t("sb_priorities")}>
          {Object.keys(PRESETS).map((k) => (
            <button key={k} role="radio" aria-checked={active === k} className={active === k ? "on" : ""} onClick={() => setPreset(k)}>
              <Icon name={PRESET_ICONS[k]} />
              <span>{t(`preset_${k}`)}</span>
              <span className="sb-check">{active === k && <Icon name="check" size="0.9em" />}</span>
            </button>
          ))}
        </div>
        {active === "custom" && <p className="sb-sub">{t("preset_custom")}</p>}
      </section>

      <section className="sb-data">
        <span className="sb-data-icon">
          <Icon name="satellite" size="1.3em" />
        </span>
        <div>
          <strong>{t("sb_data_h")}</strong>
          <p>{t("sb_data_list")}</p>
        </div>
      </section>
      <p className="sb-disclaimer">{t("disclaimer")}</p>
      <div className="sb-saved">
        <p>
          <Icon name="check" size="1em" /> {t("saved_note")}
        </p>
        <button className="link" onClick={onForget}>
          {t("forget_btn")}
        </button>
      </div>
    </aside>
  );
}
