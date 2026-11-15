import { useLang } from "../../i18n/LangContext.jsx";
import Icon from "../components/Icon.jsx";

export const DASHBOARD_TABS = [
  { id: "overview", icon: "home", labelKey: "tab_overview" },
  { id: "plan", icon: "rotate", labelKey: "tab_plan" },
  { id: "check", icon: "search", labelKey: "tab_check" },
  { id: "today", icon: "sun", labelKey: "tab_today" },
  { id: "climate", icon: "chart", labelKey: "tab_climate" },
  { id: "field", icon: "map", labelKey: "tab_field" },
];

export default function DashboardNav({ tab, onSelect }) {
  const { t } = useLang();

  return (
    <nav className="dashboard-nav" role="tablist" aria-label="FieldShift sections">
      {DASHBOARD_TABS.map(({ id, icon, labelKey }) => {
        const active = tab === id;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={active}
            className={`nav-item ${active ? "active" : ""}`}
            onClick={() => onSelect(id)}
          >
            <span className="nav-icon" aria-hidden="true"><Icon name={icon} /></span>
            <span className="nav-label">{t(labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}
