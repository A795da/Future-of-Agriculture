// Which field part the results show. Appears only when the field is split.

import { useLang } from "../../i18n/LangContext.jsx";
import { cropLabel } from "../../i18n/strings.js";
import { formatArea } from "../../field/geometry.js";
import Icon from "../components/Icon.jsx";

/** "North part", or "Part 2" when unnamed, or "My field" when there is only one part. */
export function partName(part, parts, t) {
  if (part.name?.trim()) return part.name.trim();
  if (parts.length === 1) return t("part_whole");
  return t("part_n", { n: parts.findIndex((p) => p.id === part.id) + 1 });
}

/** "Wheat + Maize › Fallow" with second crops. */
export function partRotation(part, cropsById, lang) {
  if (!cropsById) return "…";
  return part.current
    .map((id, i) => cropLabel(id, cropsById, lang) + (part.second?.[i] ? ` + ${cropLabel(part.second[i], cropsById, lang)}` : ""))
    .join(" › ");
}

export default function PartSwitcher({ farm, onPick, cropsById }) {
  const { lang, t } = useLang();
  if (farm.parts.length < 2) return null;
  return (
    <nav className="part-switcher" aria-label={t("part_showing")}>
      <span className="eyebrow">{t("part_showing")}</span>
      <div className="part-chips">
        {farm.parts.map((p) => (
          <button key={p.id} className={p.id === farm.activePart ? "on" : ""} aria-pressed={p.id === farm.activePart} onClick={() => onPick(p.id)}>
            <Icon name="map" size="1em" />
            <span className="pc-name">{partName(p, farm.parts, t)}</span>
            <small>
              {partRotation(p, cropsById, lang)}
              {p.area_ha ? ` · ${formatArea(p.area_ha).split(" · ")[0]}` : ""}
            </small>
          </button>
        ))}
      </div>
    </nav>
  );
}
