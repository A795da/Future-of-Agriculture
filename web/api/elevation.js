// Serverless proxy (Vercel/Netlify style) for NASA SRTM elevations from OpenTopoData,
// which does not allow direct browser calls. Same URL shape as the dev proxy:
// GET /api/elevation?locations=lat,lon|lat,lon  (max 100 points)

const UPSTREAM = "https://api.opentopodata.org/v1/srtm30m";
const VALID = /^-?\d{1,3}(\.\d+)?,-?\d{1,3}(\.\d+)?(\|-?\d{1,3}(\.\d+)?,-?\d{1,3}(\.\d+)?){0,99}$/;

export default async function handler(req, res) {
  const locations = String(req.query?.locations ?? "");
  if (!VALID.test(locations)) {
    res.status(400).json({ error: "locations must be up to 100 'lat,lon' pairs separated by |" });
    return;
  }
  try {
    const upstream = await fetch(`${UPSTREAM}?locations=${encodeURIComponent(locations)}`, {
      signal: AbortSignal.timeout(15000),
    });
    res.status(upstream.status);
    res.setHeader("content-type", "application/json");
    res.setHeader("cache-control", "public, max-age=86400"); // terrain does not change
    res.send(await upstream.text());
  } catch (e) {
    res.status(502).json({ error: `elevation service unavailable: ${e.message}` });
  }
}
