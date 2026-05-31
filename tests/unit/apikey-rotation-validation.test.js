import { describe, expect, it } from "vitest";
import { validateKeyMetadata } from "../../src/lib/apiKeys/validation.js";
import { isApiKeyExpired } from "../../src/lib/db/repos/apiKeysRepo.js";

describe("validateKeyMetadata", () => {
  it("accepts empty/omitted optional fields", () => {
    expect(validateKeyMetadata({})).toBeNull();
    expect(validateKeyMetadata({ managerEmail: "", expiresAt: "" })).toBeNull();
    expect(validateKeyMetadata({ managerEmail: null, expiresAt: null })).toBeNull();
  });

  it("accepts a valid email and ISO date", () => {
    expect(validateKeyMetadata({ managerEmail: "jane@example.com" })).toBeNull();
    expect(validateKeyMetadata({ expiresAt: "2030-01-01T00:00:00.000Z" })).toBeNull();
  });

  it("rejects a malformed email", () => {
    expect(validateKeyMetadata({ managerEmail: "not-an-email" })).toMatch(/email/i);
    expect(validateKeyMetadata({ managerEmail: "missing@domain" })).toMatch(/email/i);
  });

  it("rejects an unparseable expiration date", () => {
    expect(validateKeyMetadata({ expiresAt: "soon" })).toMatch(/expiration/i);
  });
});

describe("isApiKeyExpired", () => {
  const now = new Date("2026-05-31T12:00:00.000Z").getTime();

  it("is false when no expiry is set", () => {
    expect(isApiKeyExpired({ expiresAt: null }, now)).toBe(false);
    expect(isApiKeyExpired({}, now)).toBe(false);
  });

  it("is false for a future expiry", () => {
    expect(isApiKeyExpired({ expiresAt: "2026-06-01T00:00:00.000Z" }, now)).toBe(false);
  });

  it("is true for a past expiry", () => {
    expect(isApiKeyExpired({ expiresAt: "2026-05-01T00:00:00.000Z" }, now)).toBe(true);
  });

  it("is false for an invalid expiry string (fail open on bad data, not lock out)", () => {
    expect(isApiKeyExpired({ expiresAt: "garbage" }, now)).toBe(false);
  });
});
