// Covers the AI-002 usage-details work: requestDetails persists apiKey as a
// filterable column, getRequestDetails filters by it, and each returned detail
// is enriched with a human-readable keyName (configured name → masked prefix →
// local sentinel), matching the rule usageRepo uses for the usage charts.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { stringifyJson } from "@/lib/db/helpers/jsonCol.js";

const originalDataDir = process.env.DATA_DIR;
let tempDir;
let db;
let adapter;

// Insert a requestDetails row directly, mirroring the repo's INSERT shape, so
// the query/enrichment logic is exercised without the async write-buffer.
function insertDetail({ id, timestamp, apiKey, provider = "openai", model = "gpt-4" }) {
  const record = { id, timestamp, provider, model, connectionId: null, apiKey, project: null, status: "success", tokens: {}, latency: {} };
  adapter.run(
    `INSERT INTO requestDetails(id, timestamp, provider, model, connectionId, apiKey, project, status, data) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, timestamp, provider, model, null, apiKey, null, "success", stringifyJson(record)]
  );
}

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-rd-apikey-"));
  process.env.DATA_DIR = tempDir;
  vi.resetModules();
  db = await import("@/lib/db/index.js");
  await db.initDb();
  const { getAdapter } = await import("@/lib/db/driver.js");
  adapter = await getAdapter();
});

afterAll(() => {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

describe("requestDetails apiKey column + filter", () => {
  it("persists apiKey to a real column and filters rows by it", async () => {
    adapter.run(`DELETE FROM requestDetails`);
    insertDetail({ id: "r1", timestamp: "2026-06-15T10:00:00.000Z", apiKey: "sk-alpha-123456" });
    insertDetail({ id: "r2", timestamp: "2026-06-15T11:00:00.000Z", apiKey: "sk-beta-7890" });
    insertDetail({ id: "r3", timestamp: "2026-06-15T12:00:00.000Z", apiKey: "sk-alpha-123456" });

    const filtered = await db.getRequestDetails({ apiKey: "sk-alpha-123456" });
    expect(filtered.pagination.totalItems).toBe(2);
    expect(filtered.details.map((detail) => detail.id).sort()).toEqual(["r1", "r3"]);
    expect(filtered.details.every((detail) => detail.apiKey === "sk-alpha-123456")).toBe(true);

    const other = await db.getRequestDetails({ apiKey: "sk-beta-7890" });
    expect(other.pagination.totalItems).toBe(1);
    expect(other.details[0].id).toBe("r2");
  });
});

describe("requestDetails keyName enrichment", () => {
  it("uses the configured key name when the key exists", async () => {
    adapter.run(`DELETE FROM requestDetails`);
    adapter.run(`DELETE FROM apiKeys`);
    const created = await db.createApiKey("Production Key", "machine-1");
    insertDetail({ id: "k1", timestamp: "2026-06-15T10:00:00.000Z", apiKey: created.key });

    const result = await db.getRequestDetails({});
    expect(result.details[0].keyName).toBe("Production Key");
  });

  it("falls back to the masked prefix for an unknown key", async () => {
    adapter.run(`DELETE FROM requestDetails`);
    adapter.run(`DELETE FROM apiKeys`);
    insertDetail({ id: "k2", timestamp: "2026-06-15T10:00:00.000Z", apiKey: "sk-unknown-abcdef" });

    const result = await db.getRequestDetails({});
    expect(result.details[0].keyName).toBe("sk-unkno...");
  });

  it("uses the local sentinel when no apiKey is present", async () => {
    adapter.run(`DELETE FROM requestDetails`);
    adapter.run(`DELETE FROM apiKeys`);
    insertDetail({ id: "k3", timestamp: "2026-06-15T10:00:00.000Z", apiKey: null });

    const result = await db.getRequestDetails({});
    expect(result.details[0].keyName).toBe("Local (No API Key)");
  });
});

describe("saveRequestDetail end-to-end persists apiKey", () => {
  it("flushes an apiKey-bearing detail that getRequestDetails can filter", async () => {
    adapter.run(`DELETE FROM requestDetails`);
    adapter.run(`DELETE FROM apiKeys`);
    // Enable observability with an immediate flush (batchSize 1) for determinism.
    await db.updateSettings({ enableObservability: true, observabilityBatchSize: 1 });
    // Config is cached for 5s; wait out any prior cache from initDb.
    await new Promise((resolve) => setTimeout(resolve, 5100));

    await db.saveRequestDetail({
      id: "e1",
      timestamp: "2026-06-15T13:00:00.000Z",
      provider: "openai",
      model: "gpt-4",
      apiKey: "sk-e2e-999999",
      request: {},
      response: {},
    });

    // Poll for the async flush to land.
    let landed = null;
    for (let attempt = 0; attempt < 40; attempt++) {
      const result = await db.getRequestDetails({ apiKey: "sk-e2e-999999" });
      if (result.pagination.totalItems > 0) { landed = result; break; }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    expect(landed).not.toBeNull();
    expect(landed.details[0].id).toBe("e1");
    expect(landed.details[0].apiKey).toBe("sk-e2e-999999");
    expect(landed.details[0].keyName).toBe("sk-e2e-9...");
  }, 15000);
});
