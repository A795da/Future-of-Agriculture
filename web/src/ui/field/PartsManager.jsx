// Split the field into parts (up to MAX_PARTS): name, optional area, add and
// delete. Each part keeps its own rotation, water and soil (edited below it).

import { useLang } from "../../i18n/LangContext.jsx";
import { MAX_PARTS, withNewPart } from "../../scoring/defaults.js";
import { DONUM_PER_HA } from "../../field/geometry.js";
import { partName } from "../layout/PartSwitcher.jsx";
import Icon from "../components/Icon.jsx";

export default function PartsManager({ farm, setFarm }) {
  const { t } = useLang();
  const active = farm.parts.find((p) => p.id === farm.activePart) ?? farm.parts[0];
  const update = (patch) =>
    setFarm((s) => ({ ...s, touched: true, parts: s.parts.map((p) => (p.id === active.id ? { ...p, ...patch } : p)) }));
  // A new part starts from the current part's water, soil and rotation; edit it below.
  const add = () => setFarm(withNewPart);
  const remove = () =>
    setFarm((s) => {
      const parts = s.parts.filter((p) => p.id !== active.id);
      return { ...s, parts, activePart: parts[0].id };
    });
  const donum = active.area_ha != null ? +(active.area_ha * DONUM_PER_HA).toFixed(1) : "";

  return (
    <div className="parts">
      <div className="parts-tabs" role="tablist" aria-label={t("parts_h")}>
        {farm.parts.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={p.id === active.id}
            className={p.id === active.id ? "on" : ""}
            onClick={() => setFarm((s) => ({ ...s, activePart: p.id }))}
          >
            {partName(p, farm.parts, t)}
          </button>
        ))}
        {farm.parts.length < MAX_PARTS && (
          <button className="parts-add" onClick={add}>
            + {t("part_add")}
          </button>
        )}
      </div>
      <p className="note">{t("parts_note")}</p>
      <div className="parts-fields">
        <label className="year">
          <span>{t("part_name")}</span>
          <input
            className="text-in"
            value={active.name}
            placeholder={partName({ ...active, name: "" }, farm.parts, t)}
            maxLength={30}
            onChange={(e) => update({ name: e.target.value })}
          />
        </label>
        <label className="year">
          <span>{t("part_area")}</span>
          <span className="area-in">
            <input
              className="text-in"
              type="number"
              min="0"
              step="0.1"
              inputMode="decimal"
              value={donum}
              placeholder="—"
              onChange={(e) => update({ area_ha: e.target.value === "" ? null : Math.max(0, +e.target.value) / DONUM_PER_HA })}
            />
            <small>{t("donum")}</small>
          </span>
        </label>
        {farm.parts.length > 1 && (
          <button className="parts-del" onClick={remove}>
            <Icon name="trash" size="1em" /> {t("part_delete")}
          </button>
        )}
      </div>
    </div>
  );
}
