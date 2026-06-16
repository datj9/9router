// Guards the AI-002 review fix: PUT /api/keys/[id] must reject an explicit
// empty/whitespace rename (a key's name is required), while still allowing a
// valid rename and leaving the name untouched when it is omitted.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const originalDataDir = process.env.DATA_DIR;
let tempDir;
let db;
let PUT;

function putRequest(id, body) {
  const request = new Request(`http://localhost/api/keys/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return PUT(request, { params: Promise.resolve({ id }) });
}

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-key-update-"));
  process.env.DATA_DIR = tempDir;
  vi.resetModules();
  db = await import("@/lib/db/index.js");
  await db.initDb();
  ({ PUT } = await import("@/app/api/keys/[id]/route.js"));
});

afterAll(() => {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

describe("PUT /api/keys/[id] name validation", () => {
  it("rejects an empty/whitespace rename with 400", async () => {
    const created = await db.createApiKey("Original", "machine-1");
    const response = await putRequest(created.id, { name: "   " });
    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error).toMatch(/name/i);

    // Name is unchanged in the DB.
    const after = await db.getApiKeyById(created.id);
    expect(after.name).toBe("Original");
  });

  it("accepts a valid rename and trims it", async () => {
    const created = await db.createApiKey("Before", "machine-1");
    const response = await putRequest(created.id, { name: "  After  " });
    expect(response.status).toBe(200);
    const after = await db.getApiKeyById(created.id);
    expect(after.name).toBe("After");
  });

  it("leaves the name unchanged when name is omitted", async () => {
    const created = await db.createApiKey("Keep", "machine-1");
    const response = await putRequest(created.id, { isActive: false });
    expect(response.status).toBe(200);
    const after = await db.getApiKeyById(created.id);
    expect(after.name).toBe("Keep");
    expect(after.isActive).toBe(false);
  });
});
