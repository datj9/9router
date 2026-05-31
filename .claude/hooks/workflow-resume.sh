#!/usr/bin/env bash
# SessionStart hook: detect in-progress workflow and prompt to resume.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
STATE_SCRIPT="${PLUGIN_ROOT}/bin/devkit-state.sh"

if [ ! -f ".devkit/STATE.md" ] || [ ! -x "$STATE_SCRIPT" ]; then
  exit 0
fi

STATUS=$("$STATE_SCRIPT" status 2>/dev/null || echo '{"active": false}')
ACTIVE=$(echo "$STATUS" | grep -o '"active"[[:space:]]*:[[:space:]]*[a-z]*' | head -1 | sed 's/.*: *//')

if [ "$ACTIVE" != "true" ]; then
  exit 0
fi

WORKFLOW=$(echo "$STATUS" | grep -o '"workflow"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*: *"//;s/"//')
TICKET=$(echo "$STATUS" | grep -o '"ticket"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*: *"//;s/"//')
STEP=$(echo "$STATUS" | grep -o '"current_step"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*: *"//;s/"//')
COMPLETED=$(echo "$STATUS" | grep -o '"completed"[[:space:]]*:[[:space:]]*[0-9]*' | head -1 | sed 's/.*: *//')
TOTAL=$(echo "$STATUS" | grep -o '"total"[[:space:]]*:[[:space:]]*[0-9]*' | head -1 | sed 's/.*: *//')

escape_for_json() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  printf '%s' "$s"
}

MSG="Active workflow: ${WORKFLOW} (${TICKET}). Current step: ${STEP} (${COMPLETED}/${TOTAL}). Say /resume to continue or /abandon to discard."
MSG_ESCAPED=$(escape_for_json "$MSG")

if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ]; then
  printf '{\n  "hookSpecificOutput": {\n    "hookEventName": "SessionStart",\n    "additionalContext": "%s"\n  }\n}\n' "$MSG_ESCAPED"
else
  printf '{\n  "additional_context": "%s"\n}\n' "$MSG_ESCAPED"
fi

exit 0
