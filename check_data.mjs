// FieldShift data feasibility check. Needs Node 18 or newer (built-in fetch).
// Run: node check_data.mjs
// Endpoints and parameter names are from memory and untested: if one fails,
// read the printed status, then check that service's documentation.

const LAT = 37.87; // Konya
const LON = 32.49;

const tests = [
  {
    name: "NASA POWER (daily, AG community)",
    url:
      "https://power.larc.nasa.gov/api/temporal/daily/point" +
      "?parameters=T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,GWETROOT,GWETTOP" +
      `&community=AG&longitude=${LON}&latitude=${LAT}` +
      "&start=20240101&end=20240110&format=JSON",
    check: (j) => Object.keys(j?.properties?.parameter ?? {}).join(", "),
  },
  {
    name: "Open-Meteo forecast (not NASA)",
    url:
      "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${LAT}&longitude=${LON}` +
      "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=7",
    check: (j) => `${j?.daily?.time?.length ?? 0} forecast days`,
  },
  {
    name: "SoilGrids (modeled soil, can be slow)",
    url:
      "https://rest.isric.org/soilgrids/v2.0/properties/query" +
      `?lon=${LON}&lat=${LAT}&property=clay&property=soc&property=phh2o&depth=0-5cm&value=mean`,
    check: (j) =>
      (j?.properties?.layers ?? []).map((l) => l.name).join(", ") || "no layers",
  },
  {
    name: "Elevation (OpenTopoData SRTM 30m)",
    url: `https://api.opentopodata.org/v1/srtm30m?locations=${LAT},${LON}`,
    check: (j) => `elevation ${j?.results?.[0]?.elevation} m`,
  },
  {
    name: "NASA GIBS NDVI map tile",
    url:
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/" +
      "MODIS_Terra_NDVI_8Day/default/2024-06-01/GoogleMapsCompatible_Level9/6/24/37.png",
    image: true,
  },
];

for (const t of tests) {
  const started = Date.now();
  try {
    const res = await fetch(t.url, { signal: AbortSignal.timeout(30000) });
    const ms = Date.now() - started;
    if (!res.ok) {
      console.log(`FAIL  ${t.name}: HTTP ${res.status} (${ms} ms)`);
      continue;
    }
    if (t.image) {
      const type = res.headers.get("content-type");
      console.log(`OK    ${t.name}: ${type} (${ms} ms)`);
    } else {
      const j = await res.json();
      console.log(`OK    ${t.name}: ${t.check(j)} (${ms} ms)`);
    }
  } catch (e) {
    console.log(`FAIL  ${t.name}: ${e.message}`);
  }
}

console.log("\nPaste this whole output back into the chat.");
