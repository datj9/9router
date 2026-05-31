#!/usr/bin/env bash
# SessionStart hook: check Claude Code auth status and cache result.
# If the session is expired / not logged in, inject a warning into the
# session context and write a cache file that devkit-statusline reads.

set -euo pipefail

AUTH_CACHE="/tmp/devkit-auth-status.json"

# Run `claude auth status` — returns JSON with loggedIn, authMethod, etc.
AUTH_JSON="$(claude auth status 2>/dev/null || echo '{"loggedIn": false}')"

LOGGED_IN="$(printf '%s' "$AUTH_JSON" | jq -r '.loggedIn // false' 2>/dev/null || echo 'false')"

# Cache result for the statusline to consume (cheap file read vs spawning
# `claude auth status` on every statusline refresh).
printf '%s' "$AUTH_JSON" > "$AUTH_CACHE" 2>/dev/null || true

if [ "$LOGGED_IN" = "true" ]; then
  # Session is valid — nothing to report.
  exit 0
fi

# Session expired — inject warning into session context.
escape_for_json() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  printf '%s' "$s"
}

MSG="WARNING: Claude Code login session is EXPIRED. Run \`claude login\` to re-authenticate before proceeding."
MSG_ESCAPED="$(escape_for_json "$MSG")"

if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ]; then
  printf '{\n  "hookSpecificOutput": {\n    "hookEventName": "SessionStart",\n    "additionalContext": "%s"\n  }\n}\n' "$MSG_ESCAPED"
else
  printf '{\n  "additional_context": "%s"\n}\n' "$MSG_ESCAPED"
fi

exit 0
