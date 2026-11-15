// Satellite view of the field: real NASA GIBS (Global Imagery Browse Services)
// tiles in a Leaflet map (drag, scroll or pinch to zoom). A true-colour base
// sits under one switchable layer (vegetation, root-zone wetness, land surface
// heat). Tiles are images: they are shown, never scored.

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLang } from "../../i18n/LangContext.jsx";
import Icon from "../components/Icon.jsx";
import { GIBS_PALETTES } from "../../data/gibsPalettes.js";

const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";

// maxZ is the finest zoom the layer has (Leaflet stretches tiles beyond it);
// lag is how many days behind today it is safe to ask (processing delay).
// Legend gradients are sampled from the official GIBS colormaps (palettes
// MODIS_NDVI, SMAP_Analyzed_Soil_Moisture, MODIS_Land_Surface_Temp); lo/hi are
// the values at the two ends of those colormaps.
const LAYERS = [
  {
    id: "ndvi",
    gibs: "VIIRS_NOAA21_NDVI_8Day",
    maxZ: 8,
    lag: 4,
    src: "NASA VIIRS (NOAA-21) NDVI · 8-day · 500 m",
    lo: "0",
    hi: "1",
    grad: "linear-gradient(90deg,rgb(241,236,236),rgb(225,210,198),rgb(180,165,150),rgb(161,128,99),rgb(150,186,32),rgb(86,161,1),rgb(46,128,0),rgb(0,100,0),rgb(0,24,1))",
  },
  {
    id: "soil",
    gibs: "SMAP_L4_Analyzed_Root_Zone_Soil_Moisture",
    maxZ: 6,
    lag: 6,
    src: "NASA SMAP L4 root-zone soil moisture · daily · 9 km",
    lo: "0",
    hi: "0.7+ m³/m³",
    grad: "linear-gradient(90deg,rgb(255,162,0),rgb(255,238,0),rgb(125,190,0),rgb(0,158,62),rgb(0,255,255),rgb(0,71,255),rgb(0,0,183),rgb(16,16,100))",
  },
  {
    id: "heat",
    gibs: "VIIRS_NOAA21_Land_Surface_Temp_Day",
    maxZ: 7,
    lag: 3,
    src: "NASA VIIRS (NOAA-21) land surface temperature · daytime · 750 m",
    lo: "−73 °C",
    hi: "77 °C",
    grad: "linear-gradient(90deg,rgb(201,0,255),rgb(77,0,255),rgb(0,71,255),rgb(0,230,255),rgb(102,255,18),rgb(219,255,0),rgb(255,193,0),rgb(255,94,0),rgb(255,1,0))",
  },
];
const BASE = { gibs: "MODIS_Terra_CorrectedReflectance_TrueColor", maxZ: 9, lag: 2 };
const START_ZOOM = 7;
const MAX_ZOOM = 11;

const isoDaysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

const tileLayer = (layer, date, ext, opts = {}) =>
  L.tileLayer(`${GIBS}/${layer.gibs}/default/${date}/GoogleMapsCompatible_Level${layer.maxZ}/{z}/{y}/{x}.${ext}`, {
    maxNativeZoom: layer.maxZ,
    maxZoom: MAX_ZOOM,
    minZoom: 3,
    tileSize: 256,
    crossOrigin: true,
    ...opts,
  });

// Palette lookups: exact "r,g,b" first, nearest colour as a fallback.
const LOOKUP = Object.fromEntries(
  Object.entries(GIBS_PALETTES).map(([id, list]) => [id, new Map(list.map(([r, g, b, v]) => [`${r},${g},${b}`, v]))]),
);
function valueFromRgb(id, r, g, b) {
  const exact = LOOKUP[id].get(`${r},${g},${b}`);
  if (exact != null) return exact;
  let best = null;
  let bd = 400; // squared RGB distance; beyond it the pixel is not a palette colour
  for (const [pr, pg, pb, v] of GIBS_PALETTES[id]) {
    const d = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2;
    if (d < bd) {
      bd = d;
      best = v;
    }
  }
  return best;
}

// Read the data value under a point by sampling the very tile the map shows.
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
async function readValue(map, layer, date, ll) {
  const z = Math.min(Math.round(map.getZoom()), layer.maxZ);
  const n = 2 ** z;
  const p = map.project(ll.wrap(), z);
  const tx = Math.floor(p.x / 256);
  const ty = Math.floor(p.y / 256);
  const url = `${GIBS}/${layer.gibs}/default/${date}/GoogleMapsCompatible_Level${layer.maxZ}/${z}/${ty}/${((tx % n) + n) % n}.png`;
  const img = await loadImage(url);
  const cv = document.createElement("canvas");
  cv.width = cv.height = 256;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const [r, g, b, a] = ctx.getImageData(Math.min(255, Math.floor(p.x - tx * 256)), Math.min(255, Math.floor(p.y - ty * 256)), 1, 1).data;
  if (a < 10) return null; // transparent: cloud, water or no pass
  const v = valueFromRgb(layer.id, r, g, b);
  if (v == null) return null;
  return layer.id === "heat" ? v - 273.15 : v;
}

const bandKey = (id, v) =>
  id === "ndvi" ? (v < 0.2 ? 0 : v < 0.4 ? 1 : v < 0.6 ? 2 : 3) : id === "soil" ? (v < 0.15 ? 0 : v < 0.3 ? 1 : 2) : null;
const fmtValue = (id, v) => (id === "heat" ? `${v.toFixed(1)} °C` : id === "soil" ? `${v.toFixed(2)} m³/m³` : `NDVI ${v.toFixed(2)}`);

export default function SatelliteMap({ lat, lon, place }) {
  const { t } = useLang();
  const [layerId, setLayerId] = useState("ndvi");
  const [failed, setFailed] = useState(false);
  const layer = LAYERS.find((l) => l.id === layerId);
  const date = isoDaysAgo(layer.lag);

  const elRef = useRef(null);
  const mapRef = useRef(null);
  const overRef = useRef(null);
  const pinRef = useRef(null);
  const hasPoint = lat != null && lon != null;
  const clickRef = useRef(null);
  const [pick, setPick] = useState(null); // { lat, lon }
  const [result, setResult] = useState(null); // { state: "loading" | "ok" | "nodata" | "error", v? }

  // Create the map once.
  useEffect(() => {
    if (!hasPoint || !elRef.current) return;
    const map = L.map(elRef.current, { center: [lat, lon], zoom: START_ZOOM, minZoom: 3, maxZoom: MAX_ZOOM, worldCopyJump: true, zoomControl: false });
    L.control.zoom({ position: "topright" }).addTo(map);
    tileLayer(BASE, isoDaysAgo(BASE.lag), "jpg").addTo(map);
    map.on("click", (e) => setPick({ lat: e.latlng.lat, lon: e.latlng.wrap().lng }));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      overRef.current = null;
      pinRef.current = null;
      clickRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPoint]);

  // Follow the field and keep its pin.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hasPoint) return;
    map.setView([lat, lon], map.getZoom());
    pinRef.current?.remove();
    pinRef.current = L.circleMarker([lat, lon], { radius: 8, color: "#fff", weight: 3, fillColor: "#26402f", fillOpacity: 0.9, interactive: false }).addTo(map);
  }, [lat, lon, hasPoint]);

  // Swap the data layer on top of the base.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    overRef.current?.remove();
    setFailed(false);
    let ok = 0;
    let bad = 0;
    const over = tileLayer(layer, date, "png", { opacity: 0.8, zIndex: 5 });
    over.on("tileload", () => ok++);
    over.on("tileerror", () => bad++);
    over.on("load", () => setFailed(ok === 0 && bad > 0));
    over.addTo(map);
    overRef.current = over;
  }, [layerId, date, hasPoint]); // eslint-disable-line react-hooks/exhaustive-deps

  // Read the clicked spot for the current layer (again when the layer changes).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pick) return;
    clickRef.current?.remove();
    clickRef.current = L.circleMarker([pick.lat, pick.lon], { radius: 6, color: "#26402f", weight: 3, fillColor: "#fff", fillOpacity: 1, interactive: false }).addTo(map);
    let stale = false;
    setResult({ state: "loading" });
    readValue(map, layer, date, L.latLng(pick.lat, pick.lon))
      .then((v) => !stale && setResult(v == null ? { state: "nodata" } : { state: "ok", v }))
      .catch(() => !stale && setResult({ state: "error" }));
    return () => {
      stale = true;
    };
  }, [pick, layerId, date]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hasPoint) return null;

  const band = result?.state === "ok" ? bandKey(layer.id, result.v) : null;

  return (
    <section className="panel cv-block cv-wide sat">
      <header className="panel-head">
        <div>
          <p className="eyebrow">{t("sat_tag")}</p>
          <h3 className="display-sm">{t("sat_h")}</h3>
        </div>
        <div className="sat-tabs" role="tablist" aria-label={t("sat_h")}>
          {LAYERS.map((l) => (
            <button key={l.id} role="tab" aria-selected={l.id === layerId} className={`sat-tab ${l.id === layerId ? "on" : ""}`} onClick={() => setLayerId(l.id)}>
              {t(`sat_${l.id}`)}
            </button>
          ))}
        </div>
      </header>

      <div className="sat-map" aria-label={`${t(`sat_${layer.id}`)} · ${place ?? ""}`}>
        <div className="sat-leaflet" ref={elRef} />
        <span className="sat-chip">
          <Icon name="map" /> {place ?? ""} · {t(`sat_${layer.id}`)}
        </span>
        <span className="sat-legend">
          <span>{layer.lo}</span>
          <i style={{ background: layer.grad }} />
          <span>{layer.hi}</span>
        </span>
        <button className="sat-recenter" onClick={() => mapRef.current?.setView([lat, lon], START_ZOOM)} title={t("sat_recenter")}>
          <Icon name="map" />
        </button>
      </div>

      <div className="sat-result" aria-live="polite">
        {!pick && <span className="muted">{t("sat_hint")}</span>}
        {pick && (
          <>
            <span className="sat-coords">
              {Math.abs(pick.lat).toFixed(3)}°{pick.lat >= 0 ? "N" : "S"} {Math.abs(pick.lon).toFixed(3)}°{pick.lon >= 0 ? "E" : "W"}
            </span>
            {result?.state === "loading" && <span className="muted">…</span>}
            {result?.state === "ok" && (
              <>
                <strong className="sat-val">{fmtValue(layer.id, result.v)}</strong>
                {band != null && <span>{t(`sat_${layer.id}_b${band}`)}</span>}
              </>
            )}
            {result?.state === "nodata" && <span>{t("sat_nodata")}</span>}
            {result?.state === "error" && <span className="warn">{t("sat_unavailable")}</span>}
          </>
        )}
      </div>
      {failed && <p className="note">{t("sat_unavailable")}</p>}
      <p className="season-insight">
        <Icon name="info" />
        <span>{t(`sat_${layer.id}_take`)}</span>
      </p>
      <footer className="panel-foot">
        <span className="stat-src">
          {layer.src} · NASA GIBS · {date}
        </span>
      </footer>
    </section>
  );
}
