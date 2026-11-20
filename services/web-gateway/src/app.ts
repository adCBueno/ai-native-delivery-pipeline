import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

type FetchFn = typeof fetch;

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");

/**
 * The gateway serves the UI and forwards /api/* to task-service,
 * so the browser only ever talks to one origin.
 */
export function createApp(taskServiceUrl: string, fetchFn: FetchFn = fetch) {
  const app = express();
  app.use(express.json());

  app.get("/health", async (_req, res) => {
    try {
      const upstream = await fetchFn(`${taskServiceUrl}/health`);
      res.status(upstream.ok ? 200 : 503).json({ status: upstream.ok ? "ok" : "degraded" });
    } catch {
      res.status(503).json({ status: "degraded" });
    }
  });

  app.use("/api", async (req, res) => {
    try {
      const hasBody = !["GET", "HEAD", "DELETE"].includes(req.method);
      const upstream = await fetchFn(`${taskServiceUrl}${req.url}`, {
        method: req.method,
        headers: { "content-type": "application/json" },
        body: hasBody ? JSON.stringify(req.body ?? {}) : undefined,
      });
      const text = await upstream.text();
      res.status(upstream.status);
      if (text) res.type("application/json").send(text);
      else res.end();
    } catch {
      res.status(502).json({ error: "task-service unreachable" });
    }
  });

  app.use(express.static(publicDir));
  return app;
}
