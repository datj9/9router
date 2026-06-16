import { beforeEach, describe, expect, it, vi } from "vitest";

const connections = [];
const usageById = new Map();
const updates = [];

vi.mock("@/lib/localDb", () => ({
  getProviderConnections: vi.fn(async () => connections.map((connection) => ({ ...connection }))),
  updateProviderConnection: vi.fn(async (id, data) => {
    updates.push({ id, data });
    const index = connections.findIndex((connection) => connection.id === id);
    if (index >= 0) {
      connections[index] = { ...connections[index], ...data };
      return connections[index];
    }
    return null;
  }),
}));

vi.mock("@/lib/usage/providerQuota", () => ({
  isUsageEligibleConnection: vi.fn((connection) => connection.authType === "oauth" || connection.provider === "minimax"),
  getUsageForConnection: vi.fn(async (connection) => {
    const value = usageById.get(connection.id);
    if (value instanceof Error) throw value;
    return { usage: value };
  }),
}));

const { runQuotaAutoToggleCheck } = await import("@/shared/services/quotaAutoToggle");

function resetFixtures() {
  connections.length = 0;
  usageById.clear();
  updates.length = 0;
}

function depletedUsage() {
  return {
    quotas: {
      primary: {
        used: 100,
        total: 100,
        resetAt: "2026-06-03T00:00:00.000Z",
      },
    },
  };
}

function recoveredUsage() {
  return {
    quotas: {
      primary: {
        used: 25,
        total: 100,
        resetAt: "2026-06-03T00:00:00.000Z",
      },
    },
  };
}

describe("quota auto-toggle scheduler", () => {
  beforeEach(() => {
    resetFixtures();
    vi.clearAllMocks();
  });

  it("auto-disables active depleted accounts and marks them", async () => {
    connections.push({ id: "conn-1", provider: "codex", authType: "oauth", isActive: true });
    usageById.set("conn-1", depletedUsage());

    const summary = await runQuotaAutoToggleCheck({
      now: new Date("2026-06-02T00:00:00.000Z"),
      logger: { log: vi.fn(), warn: vi.fn() },
    });

    expect(summary.disabled).toBe(1);
    expect(connections[0]).toMatchObject({
      isActive: false,
      autoDisabledByQuota: true,
      quotaAutoDisabledAt: "2026-06-02T00:00:00.000Z",
      quotaResetAt: "2026-06-03T00:00:00.000Z",
      quotaLastRemainingPercent: 0,
      quotaLastError: null,
    });
  });

  it("does not auto-enable manually disabled accounts", async () => {
    connections.push({ id: "conn-1", provider: "codex", authType: "oauth", isActive: false });
    usageById.set("conn-1", recoveredUsage());

    const summary = await runQuotaAutoToggleCheck({ logger: { log: vi.fn(), warn: vi.fn() } });

    expect(summary.checked).toBe(0);
    expect(summary.enabled).toBe(0);
    expect(updates).toHaveLength(0);
  });

  it("auto-enables only previously quota-disabled accounts after recovery", async () => {
    connections.push({
      id: "conn-1",
      provider: "codex",
      authType: "oauth",
      isActive: false,
      autoDisabledByQuota: true,
      quotaAutoDisabledAt: "2026-06-01T00:00:00.000Z",
    });
    usageById.set("conn-1", recoveredUsage());

    const summary = await runQuotaAutoToggleCheck({
      now: new Date("2026-06-02T00:00:00.000Z"),
      logger: { log: vi.fn(), warn: vi.fn() },
    });

    expect(summary.enabled).toBe(1);
    expect(connections[0]).toMatchObject({
      isActive: true,
      autoDisabledByQuota: false,
      quotaAutoDisabledAt: null,
      quotaResetAt: null,
      quotaLastRemainingPercent: 75,
      quotaLastError: null,
    });
  });

  it("clears stale quota marker on active recovered accounts", async () => {
    connections.push({
      id: "conn-1",
      provider: "codex",
      authType: "oauth",
      isActive: true,
      autoDisabledByQuota: true,
      quotaAutoDisabledAt: "2026-06-01T00:00:00.000Z",
    });
    usageById.set("conn-1", recoveredUsage());

    await runQuotaAutoToggleCheck({
      now: new Date("2026-06-02T00:00:00.000Z"),
      logger: { log: vi.fn(), warn: vi.fn() },
    });

    expect(connections[0]).toMatchObject({
      isActive: true,
      autoDisabledByQuota: false,
      quotaAutoDisabledAt: null,
      quotaResetAt: null,
    });
  });

  it("stores errors without toggling account state", async () => {
    connections.push({ id: "conn-1", provider: "codex", authType: "oauth", isActive: true });
    usageById.set("conn-1", new Error("quota API down"));

    const summary = await runQuotaAutoToggleCheck({
      now: new Date("2026-06-02T00:00:00.000Z"),
      logger: { log: vi.fn(), warn: vi.fn() },
    });

    expect(summary.errored).toBe(1);
    expect(connections[0]).toMatchObject({
      isActive: true,
      quotaLastCheckedAt: "2026-06-02T00:00:00.000Z",
      quotaLastError: "quota API down",
    });
  });
});
