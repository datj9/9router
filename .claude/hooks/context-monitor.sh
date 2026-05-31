#!/usr/bin/env bash
# PostToolUse hook: warn when the ACTUAL context window is nearly full.
#
# Prefers context_window.used_percentage from the most recent statusline
# stdin snapshot — that's the real number Claude Code / CCS reports.
# Falls back to a tool-use-count heuristic with generous thresholds only
# when no statusline telemetry is available yet (e.g. before the first
# statusline invocation of a fresh session).
#
# Historical note: this hook previously warned at 80 tool-uses using a
# proxy that was calibrated for 200K contexts. On Opus 4.7 (1M context)
# a single prompt with two parallel research agents could trip the proxy
# while actual context usage was <20%, causing the agent to wind down
# unnecessarily.

set -euo pipefail

# Drain stdin (Claude Code sends hook event data; we don't need it here
# but must consume it so the pipe doesn't back up).
cat >/dev/null 2>&1 || true

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
STATE_SCRIPT="${PLUGIN_ROOT}/bin/devkit-state.sh"

emit() {
  jq -nc --arg msg "$1" \
    '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $msg}}'
}

# ── Preferred: read actual context percentage from statusline cache ──
LAST_IN="/tmp/devkit-statusline-last-input.json"
CTX_PCT=""
if [ -f "$LAST_IN" ]; then
  CTX_PCT="$(jq -r '.context_window.used_percentage // empty' "$LAST_IN" 2>/dev/null || true)"
fi

if [ -n "$CTX_PCT" ] && [ "$CTX_PCT" != "null" ]; then
  # Integer-coerce (handles "7", "7.3", or weird floats like "14.000...2")
  CTX_INT="$(awk -v v="$CTX_PCT" 'BEGIN{printf "%d", v+0}')"
  if [ "$CTX_INT" -ge 95 ]; then
    if [ -f ".devkit/STATE.md" ] && [ -x "$STATE_SCRIPT" ]; then
      "$STATE_SCRIPT" checkpoint "context at ${CTX_INT}%" >/dev/null 2>&1 &
    fi
    emit "CRITICAL: Context window at ${CTX_INT}% — wrap up now or start a fresh session."
  elif [ "$CTX_INT" -ge 80 ]; then
    emit "WARNING: Context window at ${CTX_INT}% — consider wrapping up the current step."
  fi
  exit 0
fi

# ── Fallback: no statusline data yet. Use tool-use-count heuristic with
# thresholds scaled conservatively for 1M-context models.
COUNTER_FILE="/tmp/devkit-ctx-$(echo "${CLAUDE_SESSION_ID:-unknown}" | head -c 16).count"
COUNT=1
if [ -f "$COUNTER_FILE" ]; then
  COUNT="$(cat "$COUNTER_FILE" 2>/dev/null || echo 0)"
  COUNT=$((COUNT + 1))
fi
echo "$COUNT" > "$COUNTER_FILE" 2>/dev/null || true

# Raised from 80/120 — those were calibrated for 200K contexts and fired
# spuriously with parallel subagents on long-context models.
if [ "$COUNT" -gt 600 ]; then
  if [ -f ".devkit/STATE.md" ] && [ -x "$STATE_SCRIPT" ]; then
    "$STATE_SCRIPT" checkpoint "~${COUNT} tool uses" >/dev/null 2>&1 &
  fi
  emit "CRITICAL: ~${COUNT} tool uses (no context telemetry available). Consider wrapping up."
elif [ "$COUNT" -gt 400 ]; then
  emit "WARNING: ~${COUNT} tool uses (no context telemetry available). Monitor your window."
fi

exit 0
