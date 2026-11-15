import { useEffect, useMemo, useState } from "react";
import { fetchPowerDaily } from "./data/power.js";
import { loadPointFeatures, loadProvinceData, loadTables, loadTerrain, withSowingCalendar } from "./data/loader.js";
import { DEFAULT_FARM, defaultRotation, effectiveInputs, withNewPart } from "./scoring/defaults.js";
import { partFeatures, scorePart } from "./scoring/parts.js";
import PartsManager from "./ui/field/PartsManager.jsx";
import PartSwitcher from "./ui/layout/PartSwitcher.jsx";
import { forgetSaved, isFarm, isProvinceId, isScenario, loadSaved, saveLocal } from "./data/saved.js";
import PowerChart from "./ui/components/PowerChart.jsx";
import FieldMap from "./field/FieldMap.jsx";
import FarmerInputs from "./ui/plan/FarmerInputs.jsx";
import PlanTab from "./ui/plan/PlanTab.jsx";
import CropCheck from "./ui/check/CropCheck.jsx";
import TodayTab from "./ui/today/TodayTab.jsx";
import GlossaryList from "./ui/components/Glossary.jsx";
import { LangProvider } from "./i18n/LangContext.jsx";
import { translate } from "./i18n/strings.js";
import { formatArea, formatLatLon, nearestProvince } from "./field/geometry.js";
import DashboardNav from "./ui/layout/DashboardNav.jsx";
import Icon from "./ui/components/Icon.jsx";
import FieldSidebar from "./ui/layout/FieldSidebar.jsx";
import Overview from "./ui/overview/Overview.jsx";
import ClimateView from "./ui/climate/ClimateView.jsx";

const VALID_TABS = ["overview", "today", "plan", "check", "field", "climate"];
const DEFAULT_TAB = "overview";

function getInitialTab() {
  if (typeof window !== "undefined") {
    const h = window.location.hash.replace(/^#/, "");
    if (VALID_TABS.includes(h)) return h;
  }
  return DEFAULT_TAB;
}

export default function App() {
  const [tables, setTables] = useState(null);
  // Choices are kept in this browser only (localStorage) and restored on the next visit.
  const [pointId, setPointId] = useState(() => loadSaved("province", isProvinceId, "konya"));
  const [field, setField] = useState(null);
  // Farm: farm-wide settings plus one or more field parts (each with its own
  // rotation, second crops, water and soil). `inputs` is the active part, flat.
  const [farm, setFarm] = useState(() => {
    const saved = loadSaved("farm", isFarm, null);
    return saved ? { ...DEFAULT_FARM, ...saved } : DEFAULT_FARM;
  });
  const inputs = useMemo(() => effectiveInputs(farm), [farm]);
  // Older components hand back a whole flat inputs object: split it into part and farm fields.
  const setInputs = (next) =>
    setFarm((s) => ({
      ...s,
      priorities: next.priorities,
      never: next.never,
      ratings: next.ratings,
      touched: next.touched ?? s.touched,
      parts: s.parts.map((p) =>
        p.id === s.activePart ? { ...p, irrigation: next.irrigation, soil: next.soil, current: next.current, second: next.second ?? p.second } : p
      ),
    }));
  const pickPart = (id) => setFarm((s) => ({ ...s, activePart: id }));
  const [scenario, setScenario] = useState(() => loadSaved("scenario", isScenario, { rainPct: 0, tempC: 0 }));
  useEffect(() => saveLocal("farm", farm), [farm]);
  useEffect(() => saveLocal("province", pointId), [pointId]);
  useEffect(() => saveLocal("scenario", scenario.rainPct || scenario.tempC ? scenario : null), [scenario]);
  const forgetChoices = () => {
    if (!window.confirm(translate(lang, "forget_confirm"))) return;
    forgetSaved();
    window.location.reload();
  };
  const [tab, setTabState] = useState(getInitialTab);

  const setTab = (nextTab) => {
    setTabState(nextTab);
    if (typeof window !== "undefined") {
      window.location.hash = nextTab;
    }
  };

  useEffect(() => {
    const onHashChange = () => {
      const h = window.location.hash.replace(/^#/, "");
      if (VALID_TABS.includes(h)) {
        setTabState(h);
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem("fieldshift-lang") === "tr" ? "tr" : "en";
    } catch {
      return "en";
    }
  });
  const t = (key, vars) => translate(lang, key, vars);
  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem("fieldshift-lang", lang);
    } catch {
      /* private mode: keep it for this visit only */
    }
  }, [lang]);
  const cropsById = useMemo(() => (tables ? Object.fromEntries(tables.cropTable.crops.map((c) => [c.id, c])) : null), [tables]);

  const [provinceData, setProvinceData] = useState(null);
  const [fieldFeatures, setFieldFeatures] = useState(null);
  const [terrain, setTerrain] = useState(null);
  const [dataStatus, setDataStatus] = useState("loading");

  const [chart, setChart] = useState({ status: "idle", conditions: null });

  useEffect(() => {
    loadTables().then(setTables).catch(() => setDataStatus("error"));
  }, []);

  const provinces = useMemo(
    () => (tables ? [...tables.provinces].sort((a, b) => a.name.localeCompare(b.name, "tr")) : []),
    [tables]
  );
  const point = provinces.find((p) => p.id === pointId);
  // A saved province that no longer exists falls back to Konya.
  useEffect(() => {
    if (provinces.length && !point) setPointId("konya");
  }, [provinces, point]);
  const onField = field?.valid === true;

  // Province: cached features; a region default rotation until the farmer edits it.
  useEffect(() => {
    if (!point || !tables) return;
    let live = true;
    setDataStatus("loading");
    loadProvinceData(point)
      .then((d) => {
        if (!live) return;
        setProvinceData(d);
        setDataStatus("ready");
        const f = withSowingCalendar(d.features, point, tables.tagem, "rainfed");
        setFarm((s) => (s.touched ? s : { ...s, parts: s.parts.map((p, i) => (i === 0 ? { ...p, current: defaultRotation(tables, point.region, f) } : p)) }));
      })
      .catch(() => live && setDataStatus("error"));
    return () => (live = false);
  }, [point, tables]);

  // Drawn field: live NASA POWER history at its centroid, and SRTM slope.
  const fLat = onField ? field.centroid[1] : null;
  const fLon = onField ? field.centroid[0] : null;
  useEffect(() => {
    setFieldFeatures(null);
    if (fLat == null) return;
    let live = true;
    loadPointFeatures(fLat, fLon)
      .then((f) => live && setFieldFeatures(f))
      .catch(() => live && setFieldFeatures({ error: true }));
    return () => (live = false);
  }, [fLat, fLon]);

  const terrainKey = onField ? JSON.stringify(field.sample_points) : null;
  useEffect(() => {
    setTerrain(null);
    if (!terrainKey) return;
    let live = true;
    loadTerrain(field)
      .then((t) => live && setTerrain(t))
      .catch(() => live && setTerrain(null));
    return () => (live = false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terrainKey]);

  // Which features drive the scoring right now.
  const usingField = onField && fieldFeatures && !fieldFeatures.error;
  const rawFeatures = usingField ? fieldFeatures : provinceData?.features;
  // A drawn field uses its province's TAGEM climate zone for sowing dates; soil texture
  // is the part's own choice, else NASA HWSD (rice seepage). One code path for every part.
  const scoreArgs = { farm, rawFeatures, point, tables, terrain: onField ? terrain : null, vegetation: provinceData?.vegetation ?? null, scenario };
  const activePart = farm.parts.find((p) => p.id === farm.activePart) ?? farm.parts[0];
  // Features change only with the place, the part's water and its soil (kept stable for Today and Crop check).
  const activeFeatures = useMemo(
    () => (rawFeatures && tables && point ? partFeatures(rawFeatures, point, tables, activePart) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawFeatures, point, tables, activePart.irrigation, activePart.soil]
  );
  const active = useMemo(
    () => scorePart({ ...scoreArgs, part: activePart, features: activeFeatures }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [farm, activeFeatures, terrain, provinceData, scenario, onField]
  );
  const features = activeFeatures;
  const localYields = active?.localYields ?? null;
  const outcome = active?.outcome ?? null;
  const planStatus = dataStatus === "error" ? "error" : !features || (onField && !fieldFeatures) ? "loading" : "ready";

  // Every part, for the Overview summary (only when the field is split).
  const partResults = useMemo(
    () =>
      farm.parts.length > 1
        ? farm.parts.map((p) => ({ part: p, result: p.id === activePart.id ? active : scorePart({ ...scoreArgs, part: p }) }))
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [farm, active]
  );

  // Crops worth rating: those that pass the checks here, plus the farmer's own rotation.
  const ratingCrops = useMemo(() => {
    if (!tables) return [];
    const removed = new Set((outcome?.removed ?? []).map((r) => r.id));
    return tables.cropTable.crops.filter((c) => !removed.has(c.id) || inputs.current.includes(c.id));
  }, [tables, outcome, inputs.current]);

  // Last 12 months chart (live POWER) for the field or province.
  const cLat = onField ? +field.centroid[1].toFixed(2) : point?.lat;
  const cLon = onField ? +field.centroid[0].toFixed(2) : point?.lon;
  useEffect(() => {
    if (cLat == null) return;
    const ctrl = new AbortController();
    const end = new Date(new Date().toISOString().slice(0, 10));
    const start = new Date(end);
    start.setFullYear(end.getFullYear() - 1);
    setChart((c) => ({ ...c, status: "loading" }));
    fetchPowerDaily({ lat: cLat, lon: cLon, start, end, signal: ctrl.signal })
      .then((conditions) => setChart({ status: "ready", conditions }))
      .catch((e) => e.name !== "AbortError" && setChart({ status: "error", conditions: null }));
    return () => ctrl.abort();
  }, [cLat, cLon]);

  const place = usingField ? t("your_field") : point?.name ?? "…";

  const locPill = useMemo(() => {
    if (onField && field?.centroid) {
      const near = nearestProvince(field.centroid[1], field.centroid[0], provinces)?.name ?? point?.name;
      const nearText = t("pill_near", { place: near });
      return `${nearText}${field.area_ha ? ` · ${formatArea(field.area_ha)}` : ""}`;
    }
    return point?.name ?? "…";
  }, [onField, field, provinces, point, t]);

  return (
    <LangProvider lang={lang}>
    <div className="app">
      <header className="top">
        <div className="top-brand">
          <span className="brand-mark">
            <Icon name="leaf" size="1.1em" />
          </span>
          <div>
            <h1>FieldShift</h1>
            <p className="tag">{t("tagline")}</p>
          </div>
        </div>
        <DashboardNav tab={tab} onSelect={setTab} />
        <div className="top-actions">
          <span className="data-status">
            <span className="dot" /> {t("top_data")}
          </span>
          <div className="lang" role="group" aria-label="Language / Dil">
            {[["en", "English"], ["tr", "Türkçe"]].map(([id, label]) => (
              <button key={id} className={lang === id ? "on" : ""} aria-pressed={lang === id} onClick={() => setLang(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="layout">
      <FieldSidebar
        provinces={provinces}
        pointId={pointId}
        onPoint={setPointId}
        point={point}
        field={field}
        onField={onField}
        inputs={inputs}
        onInputs={setInputs}
        farm={farm}
        onPickPart={pickPart}
        onAddPart={() => {
          setFarm(withNewPart);
          setTab("field");
        }}
        cropsById={cropsById}
        locLabel={onField ? `${locPill}` : `${point?.name ?? "…"} · ${t("sb_province_centre")}`}
        onEdit={() => setTab("field")}
        onForget={forgetChoices}
      />

      <main className="dashboard-content">
        {["overview", "plan", "check", "today"].includes(tab) && <PartSwitcher farm={farm} onPick={pickPart} cropsById={cropsById} />}

        {tab === "overview" && (
          <Overview
            outcome={outcome}
            status={planStatus}
            features={features}
            shift={tables?.climateShift?.provinces?.[point?.id] ?? null}
            water={tables?.waterStorage?.provinces?.[point?.id] ?? null}
            place={place === t("your_field") ? (point?.name ?? "…") : place}
            cropsById={cropsById}
            onNavigate={setTab}
            partResults={partResults}
            farm={farm}
            onPickPart={pickPart}
          />
        )}

        {/* 1. Plan View (Default) */}
        {tab === "plan" && (
          <section className="card view-plan">
            <h2>{t("plan_h")} <span className="muted">{place}</span></h2>
            <PlanTab outcome={outcome} scenario={scenario} onScenario={setScenario} status={planStatus} cropsById={cropsById} shift={tables?.climateShift?.provinces?.[point?.id] ?? null} />
          </section>
        )}

        {/* 2. Today View */}
        {tab === "today" && tables && (
          <section className="card view-today">
            <h2>{t("today_h")} <span className="muted">{place}</span></h2>
            <TodayTab tables={tables} features={features} inputs={inputs} lat={cLat} lon={cLon} provinceId={point?.id} place={place} status={planStatus} lang={lang} />
          </section>
        )}

        {/* 3. Crop Check View */}
        {tab === "check" && tables && (
          <section className="card view-check">
            <h2>{t("check_h")} <span className="muted">{place}</span></h2>
            <CropCheck tables={tables} features={features} inputs={inputs} status={planStatus} place={place} lang={lang} localYields={localYields} />
          </section>
        )}

        {/* 4. Field & Farm Profile View (ALWAYS MOUNTED to preserve drawing & coordinates) */}
        <div className={`view-field-wrap ${tab !== "field" ? "view-hidden" : ""}`} aria-hidden={tab !== "field"}>
          {point && (
            <section className="card">
              <h2>{t("field_h")}</h2>
              <FieldMap center={point} provinces={provinces} onChange={setField} visible={tab === "field"} />
              <p className="note">
                {t("field_note")}
                {onField && terrain && ` ${t("slope_note", { v: terrain.mean_slope_pct.value })}`}
                {onField &&
                  field.area_ha &&
                  ` ${t("area_note", {
                    v: formatArea(field.area_ha),
                    loc: t("map_loc", {
                      coords: formatLatLon(field.centroid[1], field.centroid[0]),
                      place: nearestProvince(field.centroid[1], field.centroid[0], provinces)?.name ?? "?",
                    }),
                  })}`}
              </p>
            </section>
          )}

          {tables && (
            <section className="card">
              <h2>{t("parts_h")}</h2>
              <PartsManager farm={farm} setFarm={setFarm} />
              <FarmerInputs crops={tables.cropTable.crops} value={inputs} onChange={setInputs} ratingCrops={ratingCrops} section="part" />
            </section>
          )}
          {tables && (
            <section className="card">
              <h2>{t("farm_h")}</h2>
              <p className="note">{t("farm_wide_note")}</p>
              <FarmerInputs crops={tables.cropTable.crops} value={inputs} onChange={setInputs} ratingCrops={ratingCrops} section="farm" />
            </section>
          )}
        </div>

        {/* 5. Climate & Historical Trends View */}
        {tab === "climate" && (
          <div className="view-climate-wrap">
            <ClimateView
              features={features}
              conditions={chart.conditions}
              chartStatus={chart.status}
              status={planStatus}
              shift={tables?.climateShift?.provinces?.[point?.id] ?? null}
              onApplyShift={(sc) => {
                setScenario(sc);
                setTab("plan");
              }}
              chart={
            <section className="card">
              <h2>{t("chart_h")} <span className="muted">({place})</span></h2>
              {chart.status === "loading" && <p className="muted">{t("chart_loading")}</p>}
              {chart.status === "error" && <p className="warn">{t("chart_error")}</p>}
              {chart.conditions && chart.status === "ready" && (
                <>
                  <PowerChart conditions={chart.conditions} />
                  <p className="source">
                    <span className="chip nasa">NASA POWER</span>
                    {chart.conditions.period.start} {t("to")} {chart.conditions.period.end} · {chart.conditions.resolution}
                  </p>
                </>
              )}
            </section>
              }
            />

            <section className="card">
              <GlossaryList />
            </section>
          </div>
        )}

      </main>
      </div>
    </div>
    </LangProvider>
  );
}
