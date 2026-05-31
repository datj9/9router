# Security Assessment Report

Assessment date: 2026-05-31  
Assessed target: local 9Router dashboard/API at `http://localhost:20129`  
Requested target label: HR portal. No HR portal code was present in `/home/dat/apps/9router`; assessment covered current repository application.  
Method: Shannon-style code-grounded recon, live route mapping, vulnerability queueing, and proof-based validation. No proof, no main finding.

## Executive Summary

Two proven auth findings were identified:

- `AUTH-VULN-01` High: network clients can bypass the public LLM API key requirement by spoofing `Host: localhost` when the app is reachable on a non-loopback interface.
- `AUTH-VULN-02` Medium: login lockout can be bypassed by rotating client-controlled `X-Forwarded-For` values.

No exploitable SQL injection, XSS, or SSRF was proven in scoped testing.

## Findings

### AUTH-VULN-01: Host Header Spoofing Bypasses API Key Requirement For Public LLM API

**Severity:** High  
**Confidence:** High  
**Affected endpoint:** `GET /api/v1/models`; same gate protects `/v1/*`, `/v1beta/*`, `/api/v1/*`, `/api/v1beta/*`  
**Code pointer:** `src/dashboardGuard.js:91`, `src/dashboardGuard.js:118`, `src/dashboardGuard.js:182`, `src/app/api/v1/models/route.js:433`

**Summary:** The public LLM API auth gate treats a request as local when the client supplies `Host: localhost`. Because `Host` is attacker-controlled and the dev server exposed `http://192.168.51.4:20129`, a network client could bypass the API-key requirement.

**Proof:**

Control request to network address without spoofed Host was blocked:

```http
GET /api/v1/models HTTP/1.1
Host: 192.168.51.4:20129

HTTP/1.1 401 Unauthorized
{"error":"API key required for remote API access"}
```

Same network address with spoofed Host was allowed without API key:

```http
GET /api/v1/models HTTP/1.1
Host: localhost:20129

HTTP/1.1 200 OK
{"object":"list","data":[{"id":"cc/claude-opus-4-8","object":"model","owned_by":"cc"}, ...]}
```

**Impact:** In a configured instance, a network attacker who can reach the service can call public LLM-compatible APIs without an API key. This can expose model inventory and may consume configured provider accounts or proxy user traffic through the service.

**Root cause:** `isLocalRequest()` trusts the HTTP `Host` header to prove loopback origin. `Host` only names the requested virtual host; it does not identify the remote peer.

**Remediation:**

- Do not use `Host` as proof of loopback. Validate the socket remote address from trusted runtime/proxy metadata where available.
- Bind local no-auth mode to `127.0.0.1` only, or require API keys for all `/v1*` traffic whenever the server listens on non-loopback interfaces.
- If proxy headers are needed, trust them only from an explicit trusted proxy allowlist.
- Add regression tests where a request to a network interface with `Host: localhost` is still treated as remote.

**Verification notes and cleanup:** Proof stopped at `GET /api/v1/models`; no provider credentials were configured or consumed. Temporary isolated runtime data was removed after report generation.

### AUTH-VULN-02: Login Lockout Bypass Via Spoofed X-Forwarded-For

**Severity:** Medium  
**Confidence:** High  
**Affected endpoint:** `POST /api/auth/login`  
**Code pointer:** `src/app/api/auth/login/route.js:20`, `src/lib/auth/loginLimiter.js:48`

**Summary:** Login lockout keys attempts by `X-Forwarded-For` when present. An unauthenticated client can rotate this header to avoid the lockout bucket.

**Proof:**

Five failed attempts with one spoofed IP triggered lockout:

```http
POST /api/auth/login HTTP/1.1
X-Forwarded-For: 203.0.113.10
Content-Type: application/json

{"password":"wrong-pentest"}

HTTP/1.1 429 Too Many Requests
{"error":"Too many failed attempts. Try again in 30s. ...","retryAfter":30}
```

Changing only the header avoided the locked bucket:

```http
POST /api/auth/login HTTP/1.1
X-Forwarded-For: 203.0.113.11
Content-Type: application/json

{"password":"wrong-pentest"}

HTTP/1.1 401 Unauthorized
{"error":"Invalid password. 4 attempt(s) left before lockout.","remainingBeforeLock":4}
```

**Impact:** Attackers can continue online password guessing despite lockout. This weakens protection for default, weak, or reused dashboard passwords, especially when dashboard access is exposed through tunnels or proxies.

**Root cause:** `getClientIp()` trusts unvalidated `X-Forwarded-For` and `X-Real-IP` headers from every request.

**Remediation:**

- Use framework/runtime remote address by default.
- Honor `X-Forwarded-For` only when the immediate peer is a configured trusted proxy.
- Consider adding account/global lockout dimensions in addition to IP.
- Persist rate-limit state or use a shared store if multiple server processes are possible.
- Add tests proving arbitrary `X-Forwarded-For` does not reset the limiter.

**Verification notes and cleanup:** Proof used wrong test passwords only. Lockout state is in memory and expires automatically.

## Appendix: Tested But Not Proven

### Injection

Authenticated SQL probe against `GET /api/usage/request-details?provider=' OR 1=1--&page=1&pageSize=1` returned normal empty JSON. Code uses fixed condition fragments plus bound parameters in reviewed repos.

### XSS

Reviewed raw HTML sinks were static or not connected to attacker-controlled live input in scope. No reflected/stored/DOM XSS proof produced.

### SSRF

Reviewed URL-controlled web-fetch paths either require configured credentials or send target URLs to third-party extraction APIs. No direct internal fetch primitive was proven.

## Artifacts

- Pre-recon: `.codex-pentest/pre_recon.md`
- Live recon: `.codex-pentest/recon.md`
- Queues: `.codex-pentest/*_queue.json`
- Evidence: `.codex-pentest/*_evidence.md`

