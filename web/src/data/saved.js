// The farmer's choices, kept only in this browser (localStorage) so they survive
// closing and reopening the app. Nothing here is sent anywhere. Every read is
// checked; anything missing, old or broken falls back to the defaults.

const PREFIX = "fieldshift-v1-";
export const SAVED_KEYS = ["farm", "province", "field", "scenario"];

export function loadSaved(key, check, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw == null) return fallback;
    const value = JSON.parse(raw);
    return check(value) ? value : fallback;
  } catch {
    return fallback; // private mode, blocked storage or broken JSON
  }
}

export function saveLocal(key, value) {
  try {
    if (value == null) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: keep working for this visit */
  }
}

/** Remove every saved choice (the language setting has its own key and stays). */
export function forgetSaved() {
  for (const k of SAVED_KEYS) saveLocal(k, null);
}

// ---- shape checks
const isStrArr = (a) => Array.isArray(a) && a.length > 0 && a.length <= 8 && a.every((x) => typeof x === "string");
const isPart = (p) =>
  p &&
  typeof p.id === "string" &&
  typeof p.name === "string" &&
  (p.area_ha == null || (typeof p.area_ha === "number" && p.area_ha >= 0)) &&
  (p.irrigation === "rainfed" || p.irrigation === "irrigated") &&
  typeof p.soil === "string" &&
  isStrArr(p.current) &&
  p.second != null &&
  typeof p.second === "object";

export function isFarm(f) {
  return (
    f &&
    Array.isArray(f.parts) &&
    f.parts.length >= 1 &&
    f.parts.length <= 4 &&
    f.parts.every(isPart) &&
    f.parts.some((p) => p.id === f.activePart) &&
    f.priorities &&
    ["water", "soil", "income", "simplicity"].every((k) => typeof f.priorities[k] === "number") &&
    Array.isArray(f.never) &&
    f.ratings != null &&
    typeof f.ratings === "object"
  );
}

const isLatLon = (p) => Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === "number" && Number.isFinite(v));
export function isFieldShape(s) {
  return (
    s &&
    (s.mode === "draw" || s.mode === "pin") &&
    Array.isArray(s.verts) &&
    s.verts.length <= 200 &&
    s.verts.every(isLatLon) &&
    typeof s.closed === "boolean" &&
    (s.pin == null || isLatLon(s.pin))
  );
}

export const isProvinceId = (v) => typeof v === "string" && /^[a-z_]{2,30}$/.test(v);
export const isScenario = (s) => s && typeof s.rainPct === "number" && typeof s.tempC === "number";
