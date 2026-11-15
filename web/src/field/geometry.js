// Field geometry: turns map taps into the Field shape the rest of the app reads.
// Coordinates inside the app's map state are [lat, lon]; GeoJSON and the Field
// object use [lon, lat], as GeoJSON requires.

import { area } from "@turf/area";
import { centroid } from "@turf/centroid";
import { kinks } from "@turf/kinks";
import { pointGrid } from "@turf/point-grid";
import { bbox } from "@turf/bbox";
import { polygon as turfPolygon } from "@turf/helpers";

export const DONUM_PER_HA = 10; // 1 dönüm = 1000 m² = 0.1 ha
const MAX_SAMPLES = 100;
const TARGET_SAMPLES = 25;
const MIN_SPACING_KM = 0.03; // SRTM is ~30 m; denser sampling adds nothing

const round = (v, d = 5) => +v.toFixed(d);

export function fieldFromPin([lat, lon]) {
  return {
    kind: "pin",
    valid: true,
    polygon: null,
    centroid: [round(lon), round(lat)],
    area_ha: null,
    sample_points: [[round(lon), round(lat)]],
  };
}

export function fieldFromVertices(vertices) {
  if (vertices.length < 3) {
    return { kind: "polygon", valid: false, error: "Tap at least 3 corners." };
  }
  const ring = vertices.map(([lat, lon]) => [lon, lat]);
  ring.push(ring[0]);
  const poly = turfPolygon([ring]);

  if (kinks(poly).features.length > 0) {
    return {
      kind: "polygon",
      valid: false,
      error: "The edges cross each other. Drag a corner or undo.",
    };
  }

  const m2 = area(poly);
  const c = centroid(poly).geometry.coordinates;
  const spacingKm = Math.max(MIN_SPACING_KM, Math.sqrt(m2 / 1e6 / TARGET_SAMPLES));
  let samples = pointGrid(bbox(poly), spacingKm, { units: "kilometers", mask: poly })
    .features.map((f) => f.geometry.coordinates.map((v) => round(v)));
  if (samples.length === 0) samples = [c.map((v) => round(v))];

  return {
    kind: "polygon",
    valid: true,
    polygon: poly.geometry,
    centroid: c.map((v) => round(v)),
    area_ha: m2 / 1e4,
    sample_points: samples.slice(0, MAX_SAMPLES),
  };
}

export function formatArea(ha) {
  if (ha == null) return null;
  const fmt = (v) =>
    v >= 100 ? Math.round(v).toLocaleString("tr-TR") : v.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
  return `${fmt(ha)} ha · ${fmt(ha * DONUM_PER_HA)} dönüm`;
}
