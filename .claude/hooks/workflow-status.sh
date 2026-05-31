#!/usr/bin/env bash
# PostToolUse hook: show current workflow step in output.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
STATE_SCRIPT="${PLUGIN_ROOT}/bin/devkit-state.sh"

if [ ! -f ".devkit/STATE.md" ] || [ ! -x "$STATE_SCRIPT" ]; then
  exit 0
fi

# Only show status every 10 tool uses to avoid noise
COUNTER_FILE="/tmp/devkit-ctx-$(echo "${CLAUDE_SESSION_ID:-unknown}" | head -c 16).count"
COUNT=0
if [ -f "$COUNTER_FILE" ]; then
  COUNT=$(cat "$COUNTER_FILE")
fi

if [ $((COUNT % 10)) -ne 0 ]; then
  exit 0
fi

STATUS=$("$STATE_SCRIPT" status 2>/dev/null || echo '{}')
WORKFLOW=$(echo "$STATUS" | grep -o '"workflow"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*: *"//;s/"//')
STEP=$(echo "$STATUS" | grep -o '"current_step"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*: *"//;s/"//')
PCT=$(echo "$STATUS" | grep -o '"progress_pct"[[:space:]]*:[[:space:]]*[0-9]*' | head -1 | sed 's/.*: *//')

if [ -n "$WORKFLOW" ] && [ -n "$STEP" ]; then
  jq -nc --arg msg "Workflow: ${WORKFLOW} | Step: ${STEP} | Progress: ${PCT}%" \
    '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $msg}}'
fi

exit 0
