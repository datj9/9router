import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";

function rowToKey(row) {
  if (!row) return null;
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    machineId: row.machineId,
    isActive: row.isActive === 1 || row.isActive === true,
    createdAt: row.createdAt,
    managerEmail: row.managerEmail || null,
    managerName: row.managerName || null,
    expiresAt: row.expiresAt || null,
    rotatedAt: row.rotatedAt || null,
    lastNotifiedAt: row.lastNotifiedAt || null,
  };
}

// A key is expired when expiresAt is set and in the past.
export function isApiKeyExpired(apiKey, now = Date.now()) {
  if (!apiKey?.expiresAt) return false;
  const expiry = new Date(apiKey.expiresAt).getTime();
  if (Number.isNaN(expiry)) return false;
  return expiry <= now;
}

export async function getApiKeys() {
  const db = await getAdapter();
  const rows = db.all(`SELECT * FROM apiKeys ORDER BY createdAt ASC`);
  return rows.map(rowToKey);
}

export async function getApiKeyById(id) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
  return rowToKey(row);
}

export async function getApiKeyByKey(key) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM apiKeys WHERE key = ?`, [key]);
  return rowToKey(row);
}

export async function createApiKey(name, machineId, options = {}) {
  if (!machineId) throw new Error("machineId is required");
  const db = await getAdapter();
  const { generateApiKeyWithMachine } = await import("@/shared/utils/apiKey");
  const result = generateApiKeyWithMachine(machineId);
  const apiKey = {
    id: uuidv4(),
    name,
    key: result.key,
    machineId,
    isActive: true,
    createdAt: new Date().toISOString(),
    managerEmail: options.managerEmail || null,
    managerName: options.managerName || null,
    expiresAt: options.expiresAt || null,
    rotatedAt: null,
    lastNotifiedAt: null,
  };
  db.run(
    `INSERT INTO apiKeys(id, key, name, machineId, isActive, createdAt, managerEmail, managerName, expiresAt, rotatedAt, lastNotifiedAt) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [apiKey.id, apiKey.key, apiKey.name, apiKey.machineId, 1, apiKey.createdAt, apiKey.managerEmail, apiKey.managerName, apiKey.expiresAt, null, null]
  );
  return apiKey;
}

// Updatable metadata fields (the key value itself is only changed via rotateApiKey).
const UPDATABLE_FIELDS = ["name", "isActive", "managerEmail", "managerName", "expiresAt"];

export async function updateApiKey(id, data) {
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const row = db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
    if (!row) return;
    const current = rowToKey(row);
    const merged = { ...current };
    for (const field of UPDATABLE_FIELDS) {
      if (data[field] !== undefined) merged[field] = data[field];
    }
    db.run(
      `UPDATE apiKeys SET name = ?, isActive = ?, managerEmail = ?, managerName = ?, expiresAt = ? WHERE id = ?`,
      [merged.name, merged.isActive ? 1 : 0, merged.managerEmail, merged.managerName, merged.expiresAt, id]
    );
    result = merged;
  });
  return result;
}

/**
 * Rotate an API key: generate a fresh key value for the same machineId, keeping
 * all metadata. Returns { previous, current } so callers can notify the manager.
 */
export async function rotateApiKey(id) {
  const db = await getAdapter();
  const { generateApiKeyWithMachine } = await import("@/shared/utils/apiKey");
  let result = null;
  let machineId = null;

  // Read first to obtain machineId, then generate outside the transaction
  const existingRow = db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
  if (!existingRow) return null;
  machineId = existingRow.machineId;
  const generated = generateApiKeyWithMachine(machineId);
  const rotatedAt = new Date().toISOString();

  db.transaction(() => {
    const row = db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
    if (!row) return;
    const previous = rowToKey(row);
    db.run(
      `UPDATE apiKeys SET key = ?, rotatedAt = ? WHERE id = ?`,
      [generated.key, rotatedAt, id]
    );
    const current = { ...previous, key: generated.key, rotatedAt };
    result = { previous, current };
  });
  return result;
}

export async function markApiKeyNotified(id, notifiedAt = new Date().toISOString()) {
  const db = await getAdapter();
  db.run(`UPDATE apiKeys SET lastNotifiedAt = ? WHERE id = ?`, [notifiedAt, id]);
  return notifiedAt;
}

export async function deleteApiKey(id) {
  const db = await getAdapter();
  const res = db.run(`DELETE FROM apiKeys WHERE id = ?`, [id]);
  return (res?.changes ?? 0) > 0;
}

export async function validateApiKey(key) {
  const db = await getAdapter();
  const row = db.get(`SELECT isActive, expiresAt FROM apiKeys WHERE key = ?`, [key]);
  if (!row) return false;
  const active = row.isActive === 1 || row.isActive === true;
  if (!active) return false;
  if (isApiKeyExpired({ expiresAt: row.expiresAt })) return false;
  return true;
}
