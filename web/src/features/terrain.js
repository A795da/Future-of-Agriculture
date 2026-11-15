// Terrain features from elevation samples inside the field (SRTM via an
// elevation API). A plane is fitted to the samples; its tilt is the field's
// mean slope, which is robust to the ~5 m vertical noise of SRTM.

import { round } from "./stats.js";

/** A 3x3 grid at ~30 m spacing around a pin, so a pin still gets a slope estimate. */
export function gridAroundPin([lon, lat], spacingM = 30) {
  const dLat = spacingM / 110540;
  const dLon = spacingM / (111320 * Math.cos((lat * Math.PI) / 180));
  const pts = [];
  for (const i of [-1, 0, 1]) for (const j of [-1, 0, 1]) pts.push([lon + i * dLon, lat + j * dLat]);
  return pts;
}

/** points: [[lon, lat], ...]; elevations: metres, same order. */
export function computeTerrainFeatures(points, elevations) {
  const rows = points
    .map(([lon, lat], i) => ({ lon, lat, z: elevations[i] }))
    .filter((r) => Number.isFinite(r.z));
  if (rows.length < 3) return null;

  const lat0 = rows.reduce((s, r) => s + r.lat, 0) / rows.length;
  const lon0 = rows.reduce((s, r) => s + r.lon, 0) / rows.length;
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const pts = rows.map((r) => [(r.lon - lon0) * kx, (r.lat - lat0) * 110540, r.z]);

  // Least squares for z = a*x + b*y + c (normal equations, 3x3).
  let sxx = 0, sxy = 0, syy = 0, sx = 0, sy = 0, sxz = 0, syz = 0, sz = 0;
  for (const [x, y, z] of pts) {
    sxx += x * x; sxy += x * y; syy += y * y; sx += x; sy += y;
    sxz += x * z; syz += y * z; sz += z;
  }
  const n = pts.length;
  const A = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]];
  const B = [sxz, syz, sz];
  const sol = solve3(A, B);
  if (!sol) return null;
  const [a, b] = sol;
  const slopePct = 100 * Math.hypot(a, b);
  const aspectDeg = (Math.atan2(-a, -b) * 180) / Math.PI; // direction the slope faces
  const zs = rows.map((r) => r.z);

  const F = (value, unit) => ({
    value,
    unit,
    source: "SRTM elevation (NASA) via OpenTopoData",
    kind: "NASA observation",
    period: "static",
  });
  return {
    mean_slope_pct: F(round(slopePct, 1), "%"),
    aspect_deg: F(round((aspectDeg + 360) % 360, 0), "°"),
    elevation_m: F(round(zs.reduce((s, v) => s + v, 0) / zs.length, 0), "m"),
    relief_m: F(round(Math.max(...zs) - Math.min(...zs), 0), "m"),
    terrain_samples: F(rows.length, "points"),
  };
}

function solve3(A, B) {
  const det = (m) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(A);
  if (Math.abs(D) < 1e-9) return null;
  return [0, 1, 2].map((col) => det(A.map((row, i) => row.map((v, j) => (j === col ? B[i] : v)))) / D);
}
