import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

const upstream = "http://task-service:3001";

function fakeFetch(status: number, body = "") {
  return vi.fn(async () => new Response(body || null, { status }));
}

describe("web-gateway", () => {
  it("is healthy when task-service is healthy", async () => {
    const res = await request(createApp(upstream, fakeFetch(200, "{}"))).get("/health");
    expect(res.status).toBe(200);
  });

  it("is degraded when task-service is down", async () => {
    const failing = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const res = await request(createApp(upstream, failing)).get("/health");
    expect(res.status).toBe(503);
  });

  it("forwards API calls with method and body", async () => {
    const fetchFn = fakeFetch(201, JSON.stringify({ id: "1", title: "Hi", done: false }));
    const res = await request(createApp(upstream, fetchFn)).post("/api/tasks").send({ title: "Hi" });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Hi");
    expect(fetchFn).toHaveBeenCalledWith(
      `${upstream}/tasks`,
      expect.objectContaining({ method: "POST", body: JSON.stringify({ title: "Hi" }) }),
    );
  });

  it("passes through empty responses", async () => {
    const res = await request(createApp(upstream, fakeFetch(204))).delete("/api/tasks/1");
    expect(res.status).toBe(204);
  });

  it("returns 502 when task-service is unreachable", async () => {
    const failing = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const res = await request(createApp(upstream, failing)).get("/api/tasks");
    expect(res.status).toBe(502);
  });

  it("serves the UI", async () => {
    const res = await request(createApp(upstream, fakeFetch(200))).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("TaskManager");
  });
});
