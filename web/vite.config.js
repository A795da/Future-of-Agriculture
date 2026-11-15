import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/** Runs web/api/explain.js inside the dev server, so /api/explain works locally
 * exactly as the deployed serverless function does. */
function explainApi() {
  return {
    name: "fieldshift-explain-api",
    configureServer(server) {
      server.middlewares.use("/api/explain", async (req, res) => {
        let raw = "";
        for await (const chunk of req) raw += chunk;
        const { default: handler } = await server.ssrLoadModule("/api/explain.js");
        const shim = {
          status(code) {
            res.statusCode = code;
            return shim;
          },
          json(obj) {
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify(obj));
          },
        };
        await handler({ method: req.method, body: raw }, shim);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Server-only settings for /api/explain (web/.env.local, never committed, never
  // sent to the browser: none has a VITE_ prefix). See web/.env.example.
  const env = loadEnv(mode, process.cwd(), "");
  for (const k of ["AI_PROVIDER", "GEMINI_API_KEY", "GEMINI_MODEL", "ANTHROPIC_API_KEY"]) {
    if (env[k] && !process.env[k]) process.env[k] = env[k];
  }

  return {
    plugins: [react(), explainApi()],
    server: {
      port: 5173,
      proxy: {
        // OpenTopoData (NASA SRTM) does not allow browser calls (no CORS), so the
        // app calls /api/elevation. In production, web/api/elevation.js does the same.
        "/api/elevation": {
          target: "https://api.opentopodata.org",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/elevation/, "/v1/srtm30m"),
        },
      },
    },
  };
});
