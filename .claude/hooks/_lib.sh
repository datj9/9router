#!/usr/bin/env bash
# Shared helpers for devkit hooks. Sourced, not executed.
#
# Provides:
#   hook_log <hook-name> <verdict> <reason>
#     Append one JSONL entry to .claude/.devkit/hook-log.jsonl.
#     Caps log at 500 entries. Best-effort: never fails the caller.
#
#   emit_posttooluse <message>
#     Emit a PostToolUse hookSpecificOutput JSON with hookEventName set.
#
#   emit_pretooluse_deny <reason>
#     Emit a PreToolUse decision JSON that blocks the tool call.
#     Exit 1 after calling this to ensure Claude Code rejects.

_devkit_hook_log_file() {
  local base
  base="${HOOK_LOG_FILE:-${CLAUDE_PROJECT_DIR:-$PWD}/.claude/.devkit/hook-log.jsonl}"
  printf '%s' "$base"
}

hook_log() {
  command -v jq >/dev/null 2>&1 || return 0
  local file
  file="$(_devkit_hook_log_file)"
  local dir="${file%/*}"
  mkdir -p "$dir" 2>/dev/null || return 0
  jq -nc \
    --arg ts "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
    --arg hook "$1" \
    --arg verdict "$2" \
    --arg reason "$3" \
    '{ts:$ts, hook:$hook, verdict:$verdict, reason:$reason}' \
    >> "$file" 2>/dev/null || return 0
  # Trim to last 500 entries
  if [ -f "$file" ]; then
    tail -n 500 "$file" > "$file.tmp" 2>/dev/null && mv "$file.tmp" "$file" 2>/dev/null || true
  fi
}

emit_posttooluse() {
  jq -nc --arg msg "$1" \
    '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $msg}}'
}

emit_pretooluse_deny() {
  jq -nc --arg reason "$1" \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $reason}}'
}
