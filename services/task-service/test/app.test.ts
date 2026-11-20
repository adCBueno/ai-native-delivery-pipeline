import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { InMemoryTaskStore } from "../src/store.js";

describe("task-service", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp(new InMemoryTaskStore());
  });

  it("reports health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("creates, lists, completes and deletes a task", async () => {
    const created = await request(app).post("/tasks").send({ title: "Write thesis outline" });
    expect(created.status).toBe(201);
    const id = created.body.id;

    const list = await request(app).get("/tasks");
    expect(list.body).toHaveLength(1);

    const done = await request(app).patch(`/tasks/${id}`).send({ done: true });
    expect(done.body.done).toBe(true);

    expect((await request(app).delete(`/tasks/${id}`)).status).toBe(204);
    expect((await request(app).get("/tasks")).body).toHaveLength(0);
  });

  it("rejects an empty title", async () => {
    const res = await request(app).post("/tasks").send({ title: "   " });
    expect(res.status).toBe(400);
  });

  it("rejects a non-boolean done flag", async () => {
    const created = await request(app).post("/tasks").send({ title: "x" });
    const res = await request(app).patch(`/tasks/${created.body.id}`).send({ done: "yes" });
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown tasks", async () => {
    expect((await request(app).patch("/tasks/nope").send({ done: true })).status).toBe(404);
    expect((await request(app).delete("/tasks/nope")).status).toBe(404);
  });

  it("returns 503 when the store is down", async () => {
    const broken = new InMemoryTaskStore();
    broken.ping = async () => {
      throw new Error("db down");
    };
    const res = await request(createApp(broken)).get("/health");
    expect(res.status).toBe(503);
  });
});
