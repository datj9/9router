# Recon: Live Surface Mapping

## Runtime

Started local dev server with isolated test state:

```bash
DATA_DIR=/home/dat/apps/9router/.codex-pentest/data \
INITIAL_PASSWORD=<test-password> \
JWT_SECRET=<test-jwt-secret> \
AUTH_COOKIE_SECURE=false \
PORT=20129 \
npx next dev --webpack --port 20129
```

Observed server output:

```text
Local:   http://localhost:20129
Network: http://192.168.51.4:20129
Ready in 372ms
```

## Anonymous Surface

- `GET /api/health` returned `200` with `{"ok":true}` and CORS allow-origin `*`.
- `GET /dashboard` returned `307` redirect to `/login` when unauthenticated.
- `GET /api/settings` returned `401 {"error":"Unauthorized"}` when unauthenticated.
- `GET /api/v1/models` over network host without spoofing returned `401 {"error":"API key required for remote API access"}`.
- `GET /api/v1/models` over network host with `Host: localhost:20129` returned `200` and model list without API key.

## Authenticated Surface

Authenticated using test password and redacted cookie.

- `POST /api/auth/login` returned `200 {"success":true}` and set `auth_token=<redacted>; HttpOnly; SameSite=lax`.
- `GET /api/settings` returned settings with `requireLogin:true`, `tunnelDashboardAccess:true`, `enableRequestLogs:true`, `hasPassword:false`.
- `GET /api/keys` returned empty key list in isolated data dir.
- `GET /api/providers` returned empty connection list in isolated data dir.

## Route Inventory Summary

Major API groups observed by `find src/app/api -name route.js` and method grep:

- Auth: `/api/auth/login`, `/api/auth/logout`, `/api/auth/status`, `/api/auth/oidc/*`.
- Dashboard management: `/api/settings`, `/api/keys`, `/api/providers`, `/api/provider-nodes`, `/api/proxy-pools`, `/api/combos`, `/api/models`, `/api/pricing`, `/api/tags`.
- Usage/observability: `/api/usage/*`.
- OAuth imports: `/api/oauth/*`.
- Local tools/tunnel: `/api/cli-tools/*`, `/api/mcp/*`, `/api/tunnel/*`.
- Public OpenAI-compatible APIs: `/v1/*`, `/api/v1/*`, `/v1beta/*`, `/api/v1beta/*`.
- Media/web APIs: `/api/v1/chat/completions`, `/api/v1/messages`, `/api/v1/responses`, `/api/v1/embeddings`, `/api/v1/images/generations`, `/api/v1/audio/*`, `/api/v1/search`, `/api/v1/web/fetch`.

## Negative Checks

- SQL injection probe against authenticated `GET /api/usage/request-details?provider=' OR 1=1--&page=1&pageSize=1` returned `200` with empty result, matching parameterized query behavior.
- Unauthenticated protected APIs remained blocked by `401` unless covered by public API prefixes.
- No live HR portal routes were identified.
