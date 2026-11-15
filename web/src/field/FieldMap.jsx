import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fieldFromPin, fieldFromVertices, formatArea } from "./geometry.js";

// Satellite basemap: Esri World Imagery (attribution required; check the
// terms before production use). NASA GIBS imagery is too coarse for field edges.
const IMAGERY =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const LABELS =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";

const vertexIcon = (closer) =>
  L.divIcon({ className: closer ? "vtx vtx-closer" : "vtx", iconSize: closer ? [24, 24] : [18, 18] });
const pinIcon = L.divIcon({ className: "pin", iconSize: [22, 22] });
const shapeStyle = { color: "#facc15", weight: 3, fillColor: "#facc15", fillOpacity: 0.2 };

export default function FieldMap({ center, onChange }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const [mode, setMode] = useState("draw"); // "draw" | "pin"
  const [verts, setVerts] = useState([]); // [[lat, lon], ...]
  const [closed, setClosed] = useState(false);
  const [pin, setPin] = useState(null);
  const [field, setField] = useState(null);
  const [locMsg, setLocMsg] = useState(null);

  // Create the map once.
  useEffect(() => {
    // Double-tap zoom is off: in draw mode each tap of a double tap would add a corner.
    const m = L.map(el.current, { zoomControl: true, doubleClickZoom: false }).setView([center.lat, center.lon], 11);
    L.tileLayer(IMAGERY, {
      maxZoom: 19,
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    }).addTo(m);
    L.tileLayer(LABELS, { maxZoom: 19 }).addTo(m);
    // Credit links open in a new tab so a stray tap near the corner never leaves the app.
    m.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    // Redraw tiles when the box changes size (phone rotation, window resize).
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      // Stop animations first: a fly or wheel zoom still running on a removed
      // map throws "_leaflet_pos" errors.
      m.stop();
      m.off();
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move to the chosen province (skip the first render: the map starts there).
  const lastCenter = useRef(`${center.lat},${center.lon}`);
  useEffect(() => {
    const key = `${center.lat},${center.lon}`;
    if (key === lastCenter.current) return;
    lastCenter.current = key;
    map.current?.flyTo([center.lat, center.lon], 11, { duration: 0.8 });
  }, [center.lat, center.lon]);

  // Map taps: add a corner, or place the pin.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const onClick = (e) => {
      const p = [e.latlng.lat, e.latlng.lng];
      if (mode === "pin") setPin(p);
      else if (!closed) setVerts((v) => [...v, p]);
    };
    m.on("click", onClick);
    return () => m.off("click", onClick);
  }, [mode, closed]);

  // Draw the current shape.
  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    if (mode === "pin") {
      if (pin) {
        L.marker(pin, { icon: pinIcon, draggable: true })
          .on("dragend", (e) => {
            const ll = e.target.getLatLng();
            setPin([ll.lat, ll.lng]);
          })
          .addTo(g);
      }
      return;
    }
    if (verts.length > 1) {
      (closed ? L.polygon(verts, shapeStyle) : L.polyline(verts, shapeStyle)).addTo(g);
    }
    verts.forEach((v, i) => {
      const canClose = i === 0 && !closed && verts.length >= 3;
      L.marker(v, { icon: vertexIcon(canClose), draggable: true })
        .on("dragend", (e) => {
          const ll = e.target.getLatLng();
          setVerts((vs) => vs.map((x, j) => (j === i ? [ll.lat, ll.lng] : x)));
        })
        .on("click", () => {
          if (canClose) setClosed(true);
        })
        .addTo(g);
    });
  }, [verts, closed, mode, pin]);

  // Build the Field object and report it.
  useEffect(() => {
    let f = null;
    if (mode === "pin") {
      f = pin ? fieldFromPin(pin) : null;
    } else if (closed) {
      f = fieldFromVertices(verts);
    } else if (verts.length > 0) {
      f = {
        kind: "polygon",
        valid: false,
        drawing: true,
        error:
          verts.length < 3
            ? `Tap ${3 - verts.length} more corner${verts.length === 2 ? "" : "s"}.`
            : "Tap the first corner (large dot) or press Close field.",
      };
    }
    setField(f);
    onChange(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verts, closed, pin, mode]);

  const undo = () => {
    if (closed) setClosed(false);
    else setVerts((v) => v.slice(0, -1));
  };
  const clear = () => {
    setVerts([]);
    setClosed(false);
    setPin(null);
  };
  const switchMode = (m) => {
    clear();
    setMode(m);
  };
  const locate = () => {
    if (!navigator.geolocation) return setLocMsg("Location is not available on this device.");
    setLocMsg("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.current.flyTo([pos.coords.latitude, pos.coords.longitude], 16, { duration: 0.8 });
        setLocMsg(null);
      },
      () => setLocMsg("Could not get your location. Pick a province and zoom in instead."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="field-map">
      <div className="seg" role="group" aria-label="How to mark your field">
        <button className={mode === "draw" ? "on" : ""} onClick={() => switchMode("draw")}>
          Draw field
        </button>
        <button className={mode === "pin" ? "on" : ""} onClick={() => switchMode("pin")}>
          Drop a pin
        </button>
      </div>

      <div ref={el} className="map" />

      <div className="toolbar">
        <button onClick={locate}>📍 My location</button>
        {mode === "draw" && (
          <>
            <button onClick={undo} disabled={verts.length === 0}>
              Undo
            </button>
            <button onClick={() => setClosed(true)} disabled={closed || verts.length < 3}>
              Close field
            </button>
          </>
        )}
        <button onClick={clear} disabled={verts.length === 0 && !pin}>
          Clear
        </button>
      </div>

      <p className="field-status" aria-live="polite">
        {locMsg ??
          (field == null
            ? mode === "draw"
              ? "Zoom in to your field and tap its corners."
              : "Tap your field to drop a pin."
            : field.valid
              ? field.kind === "pin"
                ? `Pin set at ${field.centroid[1]}, ${field.centroid[0]}. Draw the field outline for its area and a more precise slope.`
                : `Field: ${formatArea(field.area_ha)} · ${field.sample_points.length} terrain sample points`
              : field.error)}
      </p>
    </div>
  );
}
