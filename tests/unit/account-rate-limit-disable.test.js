import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalDataDir = process.env.DATA_DIR;
let tempDir;
let db;
let auth;

beforeEach(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-rate-limit-"));
  process.env.DATA_DIR = tempDir;
  global._dbAdapter = { instance: null, initPromise: null, logged: false };
  vi.resetModules();
  db = await import("@/lib/db/index.js");
  auth = await import("@/sse/services/auth.js");
  await db.initDb();
});

afterEach(() => {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
  global._dbAdapter = { instance: null, initPromise: null, logged: false };
});

describe("account rate-limit handling", () => {
  it("disables a provider connection after 429 so selection stops using it", async () => {
    const conn = await db.createProviderConnection({
      provider: "claude",
      authType: "apikey",
      name: "limited-key",
      apiKey: "sk-limited",
    });

    const result = await auth.markAccountUnavailable(
      conn.id,
      429,
      "Rate limit exceeded",
      "claude",
      "claude-sonnet-4",
    );

    expect(result.shouldFallback).toBe(true);
    const updated = await db.getProviderConnectionById(conn.id);
    expect(updated.isActive).toBe(false);
    expect(updated.testStatus).toBe("unavailable");

    const active = await db.getProviderConnections({ provider: "claude", isActive: true });
    expect(active.find((item) => item.id === conn.id)).toBeUndefined();
  });

  it("keeps non-rate-limit provider errors active", async () => {
    const conn = await db.createProviderConnection({
      provider: "claude",
      authType: "apikey",
      name: "transient-key",
      apiKey: "sk-transient",
    });

    await auth.markAccountUnavailable(conn.id, 502, "Bad gateway", "claude", "claude-sonnet-4");

    const updated = await db.getProviderConnectionById(conn.id);
    expect(updated.isActive).toBe(true);
  });
});
