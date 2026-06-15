"use strict";

// Standalone maintenance server for 9router.
//
// Runs ONLY during a deploy window, in its own tiny container, holding the same
// host port the app normally binds. While the real app container is being
// rebuilt and recreated the port would otherwise refuse connections; this server
// keeps it answering with a friendly "under maintenance" response instead.
//
// Content negotiation is the whole point: 9router is an API proxy, so we must
// not hand HTML to programmatic clients.
//   - API clients (/v1*, /v1beta*, JSON Accept, or any non-GET) get a 503 with a
//     Retry-After header and a small JSON body they can parse and back off on.
//   - Browsers hitting the dashboard get a styled HTML maintenance page.

const http = require("node:http");

const LISTEN_PORT = Number(process.env.MAINTENANCE_PORT || process.env.PORT || 20128);
const LISTEN_HOST = process.env.MAINTENANCE_HOST || "0.0.0.0";
const RETRY_AFTER_SECONDS = Number(process.env.MAINTENANCE_RETRY_AFTER || 60);
const HEALTH_PATH = "/__maint_health";

const API_PREFIXES = ["/v1", "/v1beta", "/codex", "/api/"];

const HTML_BODY = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="${RETRY_AFTER_SECONDS}" />
  <title>9Router - Maintenance</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      background: radial-gradient(1200px 600px at 50% -10%, #1e293b 0%, #0b1120 60%, #060912 100%);
      color: #e2e8f0;
    }
    .card {
      max-width: 480px;
      padding: 48px 40px;
      text-align: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border: 1px solid #334155;
      border-radius: 999px;
      font-size: 13px;
      color: #94a3b8;
      margin-bottom: 28px;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #f59e0b;
      animation: pulse 1.4s ease-in-out infinite;
    }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
    h1 { font-size: 26px; margin: 0 0 14px; color: #f8fafc; }
    p { font-size: 15px; line-height: 1.6; color: #94a3b8; margin: 0; }
    .note { margin-top: 24px; font-size: 13px; color: #64748b; }
  </style>
</head>
<body>
  <main class="card">
    <span class="badge"><span class="dot"></span>Deploying an update</span>
    <h1>9Router is briefly offline</h1>
    <p>We're rolling out a new version. The dashboard will be back in a moment.</p>
    <p class="note">This page refreshes automatically every ${RETRY_AFTER_SECONDS} seconds.</p>
  </main>
</body>
</html>
`;

const JSON_BODY = JSON.stringify({
  error: {
    type: "service_unavailable",
    code: "maintenance",
    message: "9Router is temporarily unavailable for a deploy. Retry shortly.",
  },
});

function wantsHtml(request) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const requestPath = request.url || "/";
  if (API_PREFIXES.some((prefix) => requestPath === prefix || requestPath.startsWith(`${prefix}`))) {
    return false;
  }
  const acceptHeader = String(request.headers.accept || "");
  return acceptHeader.includes("text/html");
}

const server = http.createServer((request, response) => {
  if (request.url === HEALTH_PATH) {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ maintenance: true }));
    return;
  }

  if (wantsHtml(request)) {
    response.writeHead(503, {
      "Content-Type": "text/html; charset=utf-8",
      "Retry-After": String(RETRY_AFTER_SECONDS),
      "Cache-Control": "no-store",
    });
    response.end(request.method === "HEAD" ? undefined : HTML_BODY);
    return;
  }

  response.writeHead(503, {
    "Content-Type": "application/json",
    "Retry-After": String(RETRY_AFTER_SECONDS),
    "Cache-Control": "no-store",
  });
  response.end(request.method === "HEAD" ? undefined : JSON_BODY);
});

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(`[maintenance] listening on ${LISTEN_HOST}:${LISTEN_PORT}`);
});

function shutdown() {
  server.close(() => process.exit(0));
  // Force-exit if connections linger past the grace period.
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
