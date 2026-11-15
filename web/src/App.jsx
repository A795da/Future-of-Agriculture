import { useEffect, useMemo, useState } from "react";
import { fetchPowerDaily } from "./data/power.js";
import { loadPointFeatures, loadProvinceData, loadTables, loadTerrain, withSoilTexture, withSowingCalendar, withWaterStorage } from "./data/loader.js";
import { runScoring } from "./scoring/index.js";
import { localYields as buildLocalYields } from "./scoring/yields.js";
import { DEFAULT_INPUTS, defaultRotation } from "./scoring/defaults.js";
import PowerChart from "./ui/components/PowerChart.jsx";
import FieldMap from "./field/FieldMap.jsx";
import FarmerInputs from "./ui/plan/FarmerInputs.jsx";
import PlanTab from "./ui/plan/PlanTab.jsx";
import CropCheck from "./ui/check/CropCheck.jsx";
import TodayTab from "./ui/today/TodayTab.jsx";
import GlossaryList from "./ui/components/Glossary.jsx";
import { LangProvider } from "./i18n/LangContext.jsx";
import { translate } from "./i18n/strings.js";
import { formatArea } from "./field/geometry.js";

export default function App() {
  const [tables, setTables] = useState(null);
  const [pointId, setPointId] = useState("konya");
  const [field, setField] = useState(null);
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [scenario, setScenario] = useState({ rainPct: 0, tempC: 0 });
  const [tab, setTab] = useState("plan");
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
        setInputs((s) => (s.touched ? s : { ...s, current: defaultRotation(tables, point.region, f) }));
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
  // A drawn field uses its province's TAGEM climate zone for sowing dates.
  // Soil texture: the farmer's choice, else NASA HWSD for the province (rice seepage).
  const features = useMemo(
    () =>
      withWaterStorage(
        withSoilTexture(withSowingCalendar(rawFeatures, point, tables?.tagem, inputs.irrigation), point, tables?.soilTexture, inputs.soil),
        point,
        tables?.waterStorage
      ),
    [rawFeatures, point, tables, inputs.irrigation, inputs.soil]
  );
  const planStatus = dataStatus === "error" ? "error" : !features || (onField && !fieldFeatures) ? "loading" : "ready";

  // TÜİK yields for this province and water regime (a drawn field uses its province).
  const localYields = useMemo(
    () => buildLocalYields(tables?.tuikYields, point?.id, inputs.irrigation),
    [tables, point, inputs.irrigation]
  );

  const outcome = useMemo(() => {
    if (!features || !tables || !point) return null;
    try {
      return runScoring({
        features,
        terrain: onField ? terrain : null,
        vegetation: provinceData?.vegetation ?? null,
        cropTable: tables.cropTable,
        rotationTable: tables.rotationTable,
        nutrientTable: tables.nutrientTable,
        ruleTable: tables.ruleTable,
        localYields,
        farmer: {
          region: point.region,
          irrigation: inputs.irrigation,
          current_sequence: inputs.current,
          history: inputs.current,
          priorities: inputs.priorities,
          never_grow: inputs.never,
          income_ratings: inputs.ratings ?? {},
        },
        scenario,
        dataStatus: { power: true, soil: false },
      });
    } catch (e) {
      return { error: e.message };
    }
  }, [features, terrain, provinceData, tables, point, inputs, scenario, onField, localYields]);

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

  return (
    <LangProvider lang={lang}>
    <div className="app">
      <header className="top">
        <h1>FieldShift</h1>
        <p className="tag">{t("tagline")}</p>
        <div className="lang" role="group" aria-label="Language / Dil">
          <span className="muted">{t("language")}</span>
          {[["en", "English"], ["tr", "Türkçe"]].map(([id, label]) => (
            <button key={id} className={lang === id ? "on" : ""} aria-pressed={lang === id} onClick={() => setLang(id)}>
              {label}
            </button>
          ))}
        </div>
      </header>

      <main>
        <section className="card">
          <label className="field-label" htmlFor="point">{t("province")}</label>
          <select id="point" value={pointId} onChange={(e) => setPointId(e.target.value)}>
            {provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {String(p.plate).padStart(2, "0")} · {p.name}
              </option>
            ))}
          </select>
        </section>

        {point && (
          <section className="card">
            <h2>{t("field_h")}</h2>
            <FieldMap center={point} onChange={setField} />
            <p className="note">
              {t("field_note")}
              {onField && terrain && ` ${t("slope_note", { v: terrain.mean_slope_pct.value })}`}
              {onField && field.area_ha && ` ${t("area_note", { v: formatArea(field.area_ha) })}`}
            </p>
          </section>
        )}

        {tables && (
          <section className="card">
            <h2>{t("farm_h")}</h2>
            <FarmerInputs crops={tables.cropTable.crops} value={inputs} onChange={setInputs} ratingCrops={ratingCrops} />
          </section>
        )}

        <nav className="tabs" role="tablist" aria-label="FieldShift tools">
          {[
            ["today", t("tab_today")],
            ["plan", t("tab_plan")],
            ["check", t("tab_check")],
          ].map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>

        {tab === "plan" && (
          <section className="card">
            <h2>{t("plan_h")} <span className="muted">({place})</span></h2>
            <PlanTab outcome={outcome} scenario={scenario} onScenario={setScenario} status={planStatus} cropsById={cropsById} shift={tables?.climateShift?.provinces?.[point?.id] ?? null} />
          </section>
        )}

        {tab === "today" && tables && (
          <section className="card">
            <h2>{t("today_h")} <span className="muted">({place})</span></h2>
            <TodayTab tables={tables} features={features} inputs={inputs} lat={cLat} lon={cLon} provinceId={point?.id} place={place} status={planStatus} lang={lang} />
          </section>
        )}

        {tab === "check" && tables && (
          <section className="card">
            <h2>{t("check_h")} <span className="muted">({place})</span></h2>
            <CropCheck tables={tables} features={features} inputs={inputs} status={planStatus} place={place} lang={lang} localYields={localYields} />
          </section>
        )}

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

        <section className="card">
          <GlossaryList />
        </section>

        <p className="disclaimer">{t("disclaimer")}</p>
      </main>
    </div>
    </LangProvider>
  );
}
