# Pre-Recon: Code Intelligence

Assessment date: 2026-05-31  
Repo: `/home/dat/apps/9router`  
Requested target: "hr portal". No HR-domain files, employee/payroll/leave routes, or HR portal app were found in this repository. Current project is the 9Router web dashboard/API, so local testing scoped to that app.

## Scope And Rules

- Target URL: `http://localhost:20129`
- Network-bound URL observed from Next dev server: `http://192.168.51.4:20129`
- Test environment: local dev server, isolated `DATA_DIR=.codex-pentest/data`, test password set by env.
- Vulnerability classes: injection, XSS, auth, authz, SSRF.
- Destructive testing: not performed. Mutations limited to failed-login counters and local isolated session cookie.
- Sensitive data: cookies/tokens redacted in evidence.

## Framework And Routing

- Next.js application, version from `package.json`: `next ^16.1.6`.
- Dev script binds to port `20128` by default: `package.json:6`.
- Local test used `npx next dev --webpack --port 20129` because `20128` was already bound.
- Middleware/proxy entry point: `src/proxy.js:1` exports `proxy` from `src/dashboardGuard.js`.
- Proxy matcher applies to all paths except `_next/static`, `_next/image`, and favicon: `src/proxy.js:3`.

## Auth And Trust Boundaries

- Dashboard JWT cookie verification uses `auth_token` cookie: `src/dashboardGuard.js:131` to `src/dashboardGuard.js:133`.
- Dashboard session JWT secret comes from `JWT_SECRET` or a file under `DATA_DIR`: `src/lib/auth/dashboardSession.js:7` to `src/lib/auth/dashboardSession.js:16`.
- Dashboard auth cookie is `HttpOnly`, `SameSite=Lax`, and secure only when forced or HTTPS is inferred: `src/lib/auth/dashboardSession.js:56` to `src/lib/auth/dashboardSession.js:63`.
- Password login uses bcrypt when a stored hash exists, otherwise `INITIAL_PASSWORD` or fallback `123456`: `src/app/api/auth/login/route.js:44` to `src/app/api/auth/login/route.js:50`.
- Login limiter keys attempts by `getClientIp(request)`: `src/app/api/auth/login/route.js:20` to `src/app/api/auth/login/route.js:25`.
- Client IP is taken directly from `X-Forwarded-For` or `X-Real-IP`: `src/lib/auth/loginLimiter.js:48` to `src/lib/auth/loginLimiter.js:51`.
- Public LLM/API prefixes are `/v1`, `/v1beta`, `/api/v1`, `/api/v1beta`: `src/dashboardGuard.js:34` to `src/dashboardGuard.js:35`.
- Public LLM/API access allows requests considered local by `isLocalRequest`, CLI token, or configured API key: `src/dashboardGuard.js:118` to `src/dashboardGuard.js:121`.
- `isLocalRequest` determines loopback by `Host` header and optional `Origin`, not by socket remote address: `src/dashboardGuard.js:91` to `src/dashboardGuard.js:99`.

## Security Controls

- Protected dashboard routes redirect to `/login` if no valid JWT and `requireLogin` is true: `src/dashboardGuard.js:195` to `src/dashboardGuard.js:233`.
- Deny-by-default `/api/*` logic protects non-public APIs: `src/dashboardGuard.js:187` to `src/dashboardGuard.js:192`.
- Local-only routes cover process-spawning and host-secret paths: `src/dashboardGuard.js:68` to `src/dashboardGuard.js:81`.
- Settings default `requireLogin: true`: `src/lib/db/repos/settingsRepo.js:18`.
- SQL repo code uses parameter arrays for user filters, e.g. request details filters: `src/lib/db/repos/requestDetailsRepo.js:146` to `src/lib/db/repos/requestDetailsRepo.js:170`.
- Provider list redacts sensitive tokens before returning dashboard data: `src/app/api/providers/route.js:63` to `src/app/api/providers/route.js:76`.
- Translator file load/save restrict file names to a fixed allowlist: `src/app/api/translator/load/route.js:14` to `src/app/api/translator/load/route.js:28`, `src/app/api/translator/save/route.js:13` to `src/app/api/translator/save/route.js:27`.

## Risk-Relevant Sinks

- Server-side upstream calls exist for chat, web fetch, web search, TTS/STT, model validation, proxy deployment, OAuth, and tunnel flows.
- User-controlled provider node `baseUrl` exists for custom compatible providers: `src/app/api/provider-nodes/route.js:35` to `src/app/api/provider-nodes/route.js:59`; endpoint is protected by dashboard auth.
- Web fetch endpoint validates URL format but sends target URL to upstream fetch providers, not direct internal fetch for current providers: `src/sse/handlers/fetch.js:73` to `src/sse/handlers/fetch.js:79`, `open-sse/handlers/fetch/index.js:122` to `open-sse/handlers/fetch/index.js:218`.
- Only `dangerouslySetInnerHTML` occurrences found are static app script and changelog rendering, not externally supplied live target input during this assessment: `src/app/layout.js:35`, `src/shared/components/ChangelogModal.js:84`.

