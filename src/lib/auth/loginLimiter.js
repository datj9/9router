// In-memory progressive lockout for dashboard login. Resets on process restart.

const MAX_FAILS_BEFORE_LOCK = 5;
const LOCK_STEPS_MS = [30_000, 120_000, 600_000, 1_800_000]; // 30s, 2m, 10m, 30m
const FAIL_WINDOW_MS = 60 * 60 * 1000; // 1h since last fail → auto reset

const attempts = new Map(); // ip → { fails, lockUntil, lockLevel, lastFailAt }

function now() { return Date.now(); }

function getEntry(ip) {
  const e = attempts.get(ip);
  if (!e) return null;
  // Auto reset if window expired and not currently locked
  if (e.lastFailAt && now() - e.lastFailAt > FAIL_WINDOW_MS && (!e.lockUntil || now() >= e.lockUntil)) {
    attempts.delete(ip);
    return null;
  }
  return e;
}

export function checkLock(ip) {
  const e = getEntry(ip);
  if (!e || !e.lockUntil) return { locked: false };
  const remaining = e.lockUntil - now();
  if (remaining <= 0) return { locked: false };
  return { locked: true, retryAfter: Math.ceil(remaining / 1000) };
}

export function recordFail(ip) {
  const e = getEntry(ip) || { fails: 0, lockUntil: 0, lockLevel: 0, lastFailAt: 0 };
  e.fails += 1;
  e.lastFailAt = now();
  if (e.fails >= MAX_FAILS_BEFORE_LOCK) {
    const step = LOCK_STEPS_MS[Math.min(e.lockLevel, LOCK_STEPS_MS.length - 1)];
    e.lockUntil = now() + step;
    e.lockLevel += 1;
    e.fails = 0;
  }
  attempts.set(ip, e);
  return { remainingBeforeLock: Math.max(0, MAX_FAILS_BEFORE_LOCK - e.fails) };
}

export function recordSuccess(ip) {
  attempts.delete(ip);
}

// Identifier used to bucket login attempts when the client IP cannot be
// trusted. All untrusted attempts share this single bucket so an attacker
// cannot reset their own lockout by rotating X-Forwarded-For / X-Real-IP.
const UNTRUSTED_BUCKET = "untrusted";

// X-Forwarded-For / X-Real-IP are client-controlled and spoofable. They are
// only meaningful when a trusted reverse proxy sets them, so honor them solely
// when NINE_ROUTER_TRUSTED_PROXY is explicitly enabled for such a deployment.
function trustsProxyHeaders() {
  const trustedProxy = process.env.NINE_ROUTER_TRUSTED_PROXY;
  return trustedProxy === "1" || trustedProxy === "true";
}

export function getClientIp(request) {
  if (!trustsProxyHeaders()) return UNTRUSTED_BUCKET;
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") || UNTRUSTED_BUCKET;
}
