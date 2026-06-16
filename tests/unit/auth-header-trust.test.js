/**
 * Regression tests for the two proven auth findings in the security assessment:
 *
 *  - AUTH-VULN-01: Host-header spoofing must NOT grant local (no-auth) access to
 *    the public LLM API when the server is bound to a non-loopback interface.
 *  - AUTH-VULN-02: Rotating X-Forwarded-For / X-Real-IP must NOT reset the login
 *    lockout bucket when no trusted proxy is configured.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// dashboardGuard pulls in the DB / machine-id / session layers at import time.
// Stub them so the guard's pure locality logic can be exercised in isolation.
vi.mock("@/lib/localDb", () => ({
  getSettings: vi.fn(async () => ({ requireLogin: true })),
  validateApiKey: vi.fn(async () => false),
}));
vi.mock("@/shared/utils/machineId", () => ({
  getConsistentMachineId: vi.fn(async () => "machine-token"),
}));
vi.mock("@/lib/auth/dashboardSession", () => ({
  verifyDashboardAuthToken: vi.fn(async () => false),
}));

function makeRequest(headers = {}) {
  const lowerCased = new Map(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );
  return {
    headers: { get: (name) => lowerCased.get(name.toLowerCase()) ?? null },
  };
}

// ─── AUTH-VULN-01: Host header is not proof of locality ──────────────────────

describe("AUTH-VULN-01: Host-header locality", () => {
  let isLocalRequest;
  let isLoopbackBound;
  const originalHostname = process.env.HOSTNAME;

  beforeEach(async () => {
    vi.resetModules();
    const guard = await import("@/dashboardGuard");
    isLocalRequest = guard.__test__.isLocalRequest;
    isLoopbackBound = guard.__test__.isLoopbackBound;
  });

  afterEach(() => {
    if (originalHostname === undefined) delete process.env.HOSTNAME;
    else process.env.HOSTNAME = originalHostname;
  });

  it("treats a spoofed Host: localhost as remote when bound to 0.0.0.0", () => {
    process.env.HOSTNAME = "0.0.0.0";
    const spoofed = makeRequest({ host: "localhost:20128" });
    expect(isLocalRequest(spoofed)).toBe(false);
  });

  it("treats a spoofed Host: localhost as remote when bound to a routable IP", () => {
    process.env.HOSTNAME = "192.168.51.4";
    const spoofed = makeRequest({ host: "localhost:20128" });
    expect(isLocalRequest(spoofed)).toBe(false);
  });

  it("treats requests as remote when HOSTNAME is unset (Next defaults to 0.0.0.0)", () => {
    delete process.env.HOSTNAME;
    const spoofed = makeRequest({ host: "localhost:20128" });
    expect(isLocalRequest(spoofed)).toBe(false);
    expect(isLoopbackBound()).toBe(false);
  });

  it("allows local requests only when actually loopback-bound", () => {
    process.env.HOSTNAME = "127.0.0.1";
    const localRequest = makeRequest({ host: "localhost:20128" });
    expect(isLoopbackBound()).toBe(true);
    expect(isLocalRequest(localRequest)).toBe(true);
  });

  it("still rejects a cross-origin request even when loopback-bound", () => {
    process.env.HOSTNAME = "127.0.0.1";
    const crossOrigin = makeRequest({
      host: "localhost:20128",
      origin: "http://evil.example.com",
    });
    expect(isLocalRequest(crossOrigin)).toBe(false);
  });
});

// ─── AUTH-VULN-02: X-Forwarded-For must not reset the lockout ─────────────────

describe("AUTH-VULN-02: login limiter IP bucketing", () => {
  let getClientIp;
  let checkLock;
  let recordFail;
  let recordSuccess;
  const originalTrustedProxy = process.env.NINE_ROUTER_TRUSTED_PROXY;

  beforeEach(async () => {
    vi.resetModules();
    const limiter = await import("@/lib/auth/loginLimiter");
    ({ getClientIp, checkLock, recordFail, recordSuccess } = limiter);
  });

  afterEach(() => {
    if (originalTrustedProxy === undefined) delete process.env.NINE_ROUTER_TRUSTED_PROXY;
    else process.env.NINE_ROUTER_TRUSTED_PROXY = originalTrustedProxy;
  });

  it("ignores X-Forwarded-For when no trusted proxy is configured", () => {
    delete process.env.NINE_ROUTER_TRUSTED_PROXY;
    const first = makeRequest({ "x-forwarded-for": "203.0.113.10" });
    const second = makeRequest({ "x-forwarded-for": "203.0.113.11" });
    expect(getClientIp(first)).toBe(getClientIp(second));
  });

  it("does not let a rotated X-Forwarded-For escape the lockout bucket", () => {
    delete process.env.NINE_ROUTER_TRUSTED_PROXY;
    // Five fails with one spoofed IP triggers the lockout.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      recordFail(getClientIp(makeRequest({ "x-forwarded-for": "203.0.113.10" })));
    }
    // A different spoofed IP must still hit the locked bucket.
    const rotated = makeRequest({ "x-forwarded-for": "203.0.113.11" });
    expect(checkLock(getClientIp(rotated)).locked).toBe(true);
    recordSuccess(getClientIp(rotated)); // cleanup shared bucket
  });

  it("honors X-Forwarded-For when a trusted proxy is explicitly configured", () => {
    process.env.NINE_ROUTER_TRUSTED_PROXY = "1";
    const first = makeRequest({ "x-forwarded-for": "203.0.113.10" });
    const second = makeRequest({ "x-forwarded-for": "203.0.113.11" });
    expect(getClientIp(first)).toBe("203.0.113.10");
    expect(getClientIp(second)).toBe("203.0.113.11");
  });
});
