// Regression guard for the /dashboard/projects cost mismatch: legacy usageDaily
// rows written before the per-project feature shipped carry day.cost / byModel /
// byApiKey but omit byProject / byApiKeyProject. In daily-summary periods
// (7d/30d/60d/all) the Est. Cost card summed day.cost while Usage-by-Project
// summed byProject → undercount. Migration v2 rebuilds usageDaily from the
// authoritative usageHistory so every day regains the project maps.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

let tempDir;
const originalDataDir = process.env.DATA_DIR;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-backfill-"));
  process.env.DATA_DIR = tempDir;
  delete global._dbAdapter;
  vi.resetModules();
});

afterEach(() => {
  try { global._dbAdapter?.instance?.close?.(); } catch {}
  delete global._dbAdapter;
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

const DATE_KEY = "2026-05-23";
const insertHistory = (db, { project, model, provider, prompt, completion, cost, apiKey }) =>
  db.run(
    `INSERT INTO usageHistory(timestamp, provider, model, connectionId, apiKey, endpoint, project, promptTokens, completionTokens, cost, status, tokens, meta) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `${DATE_KEY}T10:00:00.000Z`, provider, model, "conn-1", apiKey, "/v1/messages",
      project, prompt, completion, cost, "ok",
      JSON.stringify({ prompt_tokens: prompt, completion_tokens: completion }), "{}",
    ]
  );

const sumCost = (mapObject) =>
  Object.values(mapObject || {}).reduce((total, entry) => total + (entry.cost || 0), 0);

describe("usageDaily project backfill (migration v2)", () => {
  it("rebuilds byProject / byApiKeyProject so sums reconcile with day.cost", async () => {
    // Boot 1 — fresh DB applies the full migration chain (no history → no-op).
    const { getAdapter } = await import("@/lib/db/driver.js");
    const db = await getAdapter();

    // Seed history rows directly (NOT saveRequestUsage, which would write a
    // correct daily row and defeat the legacy simulation).
    insertHistory(db, { project: "alpha", model: "claude-opus-4-8", provider: "anthropic", prompt: 1000, completion: 200, cost: 1.5, apiKey: "sk-a" });
    insertHistory(db, { project: "beta", model: "claude-opus-4-8", provider: "anthropic", prompt: 500, completion: 100, cost: 0.75, apiKey: "sk-b" });
    insertHistory(db, { project: null, model: "gpt-5", provider: "openai", prompt: 300, completion: 50, cost: 0.25, apiKey: null });
    const historyTotal = 1.5 + 0.75 + 0.25;

    // Overwrite that date's daily row with a legacy-shaped blob: has cost +
    // byModel + byApiKey, but NO byProject / byApiKeyProject.
    const legacyDay = {
      requests: 3, promptTokens: 1800, completionTokens: 350, cost: historyTotal,
      byProvider: { anthropic: { requests: 2, cost: 2.25 }, openai: { requests: 1, cost: 0.25 } },
      byModel: { "claude-opus-4-8|anthropic": { requests: 2, cost: 2.25 }, "gpt-5|openai": { requests: 1, cost: 0.25 } },
      byApiKey: { "sk-a|claude-opus-4-8|anthropic": { requests: 1, cost: 1.5 } },
      byEndpoint: {},
    };
    db.run(
      `INSERT INTO usageDaily(dateKey, data) VALUES(?, ?) ON CONFLICT(dateKey) DO UPDATE SET data = excluded.data`,
      [DATE_KEY, JSON.stringify(legacyDay)]
    );

    // A daily-only date with no underlying history — must survive untouched.
    const orphanDay = { requests: 9, cost: 9.99, byProject: {} };
    db.run(`INSERT INTO usageDaily(dateKey, data) VALUES(?, ?)`, ["2020-01-01", JSON.stringify(orphanDay)]);

    // Roll schemaVersion back so the next boot re-applies v2.
    db.run(`UPDATE _meta SET value = '1' WHERE key = 'schemaVersion'`);
    db.close?.();

    // Boot 2 — simulate restart; v2 re-runs and backfills.
    delete global._dbAdapter;
    vi.resetModules();
    const { getAdapter: getAdapter2 } = await import("@/lib/db/driver.js");
    const db2 = await getAdapter2();

    const rebuilt = JSON.parse(db2.get(`SELECT data FROM usageDaily WHERE dateKey = ?`, [DATE_KEY]).data);

    expect(Object.keys(rebuilt.byProject).length).toBeGreaterThan(0);
    expect(Object.keys(rebuilt.byApiKeyProject).length).toBeGreaterThan(0);

    // The whole point: every dimension reconciles with the same day total.
    expect(rebuilt.cost).toBeCloseTo(historyTotal, 9);
    expect(sumCost(rebuilt.byProject)).toBeCloseTo(historyTotal, 9);
    expect(sumCost(rebuilt.byApiKeyProject)).toBeCloseTo(historyTotal, 9);
    expect(sumCost(rebuilt.byModel)).toBeCloseTo(historyTotal, 9);
    expect(sumCost(rebuilt.byApiKey)).toBeCloseTo(historyTotal, 9);

    // Project meta is carried onto the keys.
    const projectNames = Object.values(rebuilt.byProject).map((entry) => entry.project);
    expect(projectNames).toEqual(expect.arrayContaining(["alpha", "beta"]));
    // Untagged request lands under the null project bucket.
    expect(projectNames).toContain(null);

    // Orphan daily-only date untouched.
    const orphan = JSON.parse(db2.get(`SELECT data FROM usageDaily WHERE dateKey = ?`, ["2020-01-01"]).data);
    expect(orphan).toEqual(orphanDay);
  });

  it("does not crash when usageHistory predates the project column", async () => {
    // Versioned migrations run before the additive column sync, so a DB upgrading
    // from a build without the `project` column must not throw in v2's SELECT.
    const { getAdapter } = await import("@/lib/db/driver.js");
    const m2 = (await import("@/lib/db/migrations/002-backfill-usage-daily-projects.js")).default;

    const db = await getAdapter();
    // Drop the project column to simulate a pre-feature schema (SQLite ≥ 3.35).
    db.exec(`ALTER TABLE usageHistory DROP COLUMN project`);
    expect(db.all(`PRAGMA table_info(usageHistory)`).map((column) => column.name)).not.toContain("project");

    db.run(
      `INSERT INTO usageHistory(timestamp, provider, model, connectionId, apiKey, endpoint, promptTokens, completionTokens, cost, status, tokens, meta) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [`${DATE_KEY}T10:00:00.000Z`, "anthropic", "claude-opus-4-8", "conn-1", "sk-a", "/v1/messages", 1000, 200, 1.5, "ok", JSON.stringify({ prompt_tokens: 1000, completion_tokens: 200 }), "{}"]
    );

    expect(() => m2.up(db)).not.toThrow();

    const rebuilt = JSON.parse(db.get(`SELECT data FROM usageDaily WHERE dateKey = ?`, [DATE_KEY]).data);
    // Rows from before the feature are correctly bucketed as untagged.
    expect(sumCost(rebuilt.byProject)).toBeCloseTo(1.5, 9);
    expect(Object.values(rebuilt.byProject).map((entry) => entry.project)).toEqual([null]);
  });
});
