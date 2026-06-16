import { describe, expect, it } from "vitest";

import {
  evaluateQuotaState,
  getRemainingPercentage,
  parseQuotaData,
} from "@/lib/usage/quotaState";

describe("quotaState", () => {
  it("detects depleted Codex quota at 0% remaining", () => {
    const usage = {
      limitReached: true,
      quotas: {
        primary: {
          used: 100,
          total: 100,
          remaining: 0,
          resetAt: "2026-06-03T00:00:00.000Z",
        },
      },
    };

    const state = evaluateQuotaState("codex", usage, {
      now: new Date("2026-06-02T00:00:00.000Z"),
    });

    expect(state).toMatchObject({
      hasActionableQuota: true,
      isDepleted: true,
      remainingPercent: 0,
      quotaResetAt: "2026-06-03T00:00:00.000Z",
    });
  });

  it("detects Qoder quota exceeded without treating absolute remaining as percent", () => {
    const usage = {
      isQuotaExceeded: true,
      quotas: {
        user: {
          used: 10,
          total: 10,
          remaining: 348,
          unit: "credits",
        },
        organization: {
          used: 0,
          total: 0,
          remaining: 0,
        },
      },
    };

    const rows = parseQuotaData("qoder", usage);
    expect(rows).toHaveLength(1);
    expect(rows[0].remaining).toBeUndefined();
    expect(getRemainingPercentage(rows[0])).toBe(0);

    const state = evaluateQuotaState("qoder", usage);
    expect(state.isDepleted).toBe(true);
    expect(state.remainingPercent).toBe(0);
  });

  it("detects recovered MiniMax quota from remainingPercentage", () => {
    const usage = {
      quotas: {
        "MiniMax Text": {
          used: 50,
          total: 100,
          remainingPercentage: 50,
        },
      },
    };

    const state = evaluateQuotaState("minimax", usage);
    expect(state).toMatchObject({
      hasActionableQuota: true,
      isDepleted: false,
      remainingPercent: 50,
      reason: "quota_available",
    });
  });

  it("detects Antigravity-style 0% remainingPercentage as depleted", () => {
    const usage = {
      quotas: {
        default: {
          displayName: "Default",
          used: 100,
          total: 100,
          remainingPercentage: 0,
        },
      },
    };

    const state = evaluateQuotaState("antigravity", usage);
    expect(state.isDepleted).toBe(true);
    expect(state.remainingPercent).toBe(0);
  });

  it("does not disable unknown or non-actionable quota data", () => {
    expect(evaluateQuotaState("unknown", null)).toMatchObject({
      hasActionableQuota: false,
      isDepleted: false,
      remainingPercent: null,
    });

    expect(evaluateQuotaState("claude", { quotas: { foo: { total: 0, used: 0 } } })).toMatchObject({
      hasActionableQuota: false,
      isDepleted: false,
      remainingPercent: null,
    });
  });
});
