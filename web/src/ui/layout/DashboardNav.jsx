import { useLang } from "../../i18n/LangContext.jsx";

export const DASHBOARD_TABS = [
  { id: "today", icon: "☀️", labelKey: "tab_today" },
  { id: "plan", icon: "🌾", labelKey: "tab_plan" },
  { id: "check", icon: "🔍", labelKey: "tab_check" },
  { id: "field", icon: "🗺️", labelKey: "tab_field" },
  { id: "climate", icon: "📊", labelKey: "tab_climate" },
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
            <span className="nav-icon" aria-hidden="true">
              {icon}
            </span>
            <span className="nav-label">{t(labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}
