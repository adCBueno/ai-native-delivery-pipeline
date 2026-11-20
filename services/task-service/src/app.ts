import express, { type Request, type Response } from "express";
import type { TaskStore } from "./store.js";

export function createApp(store: TaskStore) {
  const app = express();
  app.use(express.json());

  app.get("/health", async (_req: Request, res: Response) => {
    const ok = await store.ping().catch(() => false);
    res.status(ok ? 200 : 503).json({ status: ok ? "ok" : "unavailable" });
  });

  app.get("/tasks", async (_req, res) => {
    res.json(await store.list());
  });

  app.post("/tasks", async (req, res) => {
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    if (!title || title.length > 200) {
      res.status(400).json({ error: "title must be a non-empty string of at most 200 characters" });
      return;
    }
    res.status(201).json(await store.create(title));
  });

  app.patch("/tasks/:id", async (req, res) => {
    if (typeof req.body?.done !== "boolean") {
      res.status(400).json({ error: "done must be a boolean" });
      return;
    }
    const task = await store.setDone(req.params.id, req.body.done);
    if (!task) {
      res.status(404).json({ error: "task not found" });
      return;
    }
    res.json(task);
  });

  app.delete("/tasks/:id", async (req, res) => {
    const removed = await store.remove(req.params.id);
    res.status(removed ? 204 : 404).end();
  });

  return app;
}
