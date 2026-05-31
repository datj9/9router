#!/bin/bash
# PreToolUse:Bash hook — block direct pushes to protected branches.
#
# Protected branches (edit PROTECTED_BRANCHES to customize):
#   master, main, uat, develop, qc, training
#
# Detects two push patterns:
#   1. git push ... <remote> <branch>           → check <branch>
#   2. git push (no refspec) on current branch  → check current branch
#
# Also blocks --force / --force-with-lease anywhere (regardless of branch).
#
# Exit codes:
#   0  — safe, allow
#   1  — blocked with stderr explanation; Claude Code feeds it back to the agent

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_lib.sh
. "$SCRIPT_DIR/_lib.sh"
HOOK="block-protected-push"

PROTECTED_BRANCHES="master main uat develop qc training"

PAYLOAD=$(cat)

# Parse command without requiring jq — fall through silently if unavailable
if command -v jq >/dev/null 2>&1; then
  COMMAND=$(printf '%s' "$PAYLOAD" | jq -r '.tool_input.command // ""' 2>/dev/null)
else
  exit 0
fi

[ -z "$COMMAND" ] && exit 0

# Only inspect commands containing "git push"
case "$COMMAND" in
  *"git push"*) ;;
  *) exit 0 ;;
esac

# ── Always block --force / --force-with-lease ──────────────────────
if printf '%s' "$COMMAND" | grep -qE -- '(--force-with-lease|--force|[[:space:]]-f([[:space:]]|$))'; then
  REASON="Force-push detected. Command: $COMMAND
Force-pushing rewrites history. Never run this without explicit user consent.
If the user asked for it, have them run it themselves."
  hook_log "$HOOK" blocked "force-push"
  emit_pretooluse_deny "$REASON"
  exit 0
fi

# ── Determine target branch ────────────────────────────────────────
# Pattern: git push [opts] <remote> <branch>[:<dest>]
# We want the last non-flag token after "git push".
TARGET=""
# Strip everything up to and including "git push"
TAIL="${COMMAND##*git push}"
# shellcheck disable=SC2086
set -- $TAIL
# Collect non-flag tokens
POS=()
for tok in "$@"; do
  case "$tok" in
    -*) ;;
    *) POS+=("$tok") ;;
  esac
done
# <remote> <branch>  →  branch is second
# <remote>           →  no explicit branch (use current)
# (empty)            →  no explicit args (use current)
if [ "${#POS[@]}" -ge 2 ]; then
  TARGET="${POS[1]}"
  # Strip <src>:<dest> → keep dest
  case "$TARGET" in
    *:*) TARGET="${TARGET##*:}" ;;
  esac
  # HEAD and refs/heads/foo normalizations
  case "$TARGET" in
    refs/heads/*) TARGET="${TARGET#refs/heads/}" ;;
    HEAD) TARGET="" ;;  # fall through to current-branch check
  esac
fi

# No explicit branch → use current
if [ -z "$TARGET" ]; then
  TARGET=$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)
fi

[ -z "$TARGET" ] && exit 0

# ── Match against protected list ───────────────────────────────────
for b in $PROTECTED_BRANCHES; do
  if [ "$TARGET" = "$b" ]; then
    REASON="Direct push to protected branch \"$b\" is forbidden.
Command: $COMMAND

Ringkas workflow: all changes to {$PROTECTED_BRANCHES} must go through a merge request.
Open an MR from your feature branch instead:
  1. Push your feature branch:  git push -u origin <your-branch>
  2. Open MR targeting $b via GitLab UI, or run /git-workflow

If there's a legitimate emergency (e.g. hotfix approved by team lead),
the engineer — not the agent — should run the push manually."
    hook_log "$HOOK" blocked "direct push to $b"
    emit_pretooluse_deny "$REASON"
    exit 0
  fi
done

hook_log "$HOOK" allowed ""
exit 0
