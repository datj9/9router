#!/usr/bin/env bash
# PreToolUse:Bash — block destructive commands and pipe-to-shell patterns
# that have no safe agent-initiated use case.
#
# Blocks:
#   - rm -rf on / or $HOME or anything outside a short allowlist
#     (allowlist: /tmp, node_modules, build, dist, .next, .turbo,
#      __pycache__, .pytest_cache, .ruff_cache, .mypy_cache, coverage,
#      .devkit, .devkit-state)
#   - git reset --hard                     (loses uncommitted work)
#   - git clean -f(d)(x)                   (deletes untracked files)
#   - git checkout . / git restore .       (when there are uncommitted changes)
#   - git branch -D <protected>            (hard-delete a protected branch)
#   - sudo <anything>                      (agent should never escalate)
#   - curl|sh, wget|bash                   (supply-chain risk)

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_lib.sh
. "$SCRIPT_DIR/_lib.sh"

PAYLOAD=$(cat)
command -v jq >/dev/null 2>&1 || exit 0
COMMAND=$(printf '%s' "$PAYLOAD" | jq -r '.tool_input.command // ""' 2>/dev/null)
[ -z "$COMMAND" ] && exit 0

HOOK="block-dangerous-bash"
PROTECTED_BRANCHES="master main uat develop qc training"

deny() {
  hook_log "$HOOK" blocked "$1"
  emit_pretooluse_deny "$1"
  exit 0
}

# ── sudo anywhere ──────────────────────────────────────────────────
if printf '%s' "$COMMAND" | grep -qE '(^|[[:space:]])sudo([[:space:]]|$)'; then
  deny "Agent must not use sudo. Command: $COMMAND
If an operation genuinely requires elevated privileges, the engineer should run it manually."
fi

# ── curl/wget piped to a shell ────────────────────────────────────
if printf '%s' "$COMMAND" | grep -qE '(curl|wget)([^|]*)\|[[:space:]]*(sh|bash|zsh|ksh)([[:space:]]|$)'; then
  deny "Pipe-to-shell detected. Command: $COMMAND
Downloading and executing a remote script from the agent is a supply-chain risk.
If the user wants this, they should download, review, then run it themselves."
fi

# ── git reset --hard ──────────────────────────────────────────────
if printf '%s' "$COMMAND" | grep -qE 'git[[:space:]]+reset[[:space:]]+([^|;]*[[:space:]])?--hard'; then
  deny "git reset --hard discards uncommitted work. Command: $COMMAND
Use git stash, or create a rollback branch, or ask the user to run this manually."
fi

# ── git clean -f(d)(x) ────────────────────────────────────────────
if printf '%s' "$COMMAND" | grep -qE 'git[[:space:]]+clean[[:space:]]+(-[[:alnum:]]*f[[:alnum:]]*|[^|;]*--force)'; then
  deny "git clean -f deletes untracked files (often user's in-progress work). Command: $COMMAND
List what you want to remove with 'git clean -n' and ask the user to confirm."
fi

# ── git checkout . / git restore .  when dirty ────────────────────
if printf '%s' "$COMMAND" | grep -qE 'git[[:space:]]+(checkout|restore)[[:space:]]+([^|;]*[[:space:]])?(--[[:space:]]+)?\.[[:space:]]*($|[|;&])'; then
  if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    deny "git checkout . / git restore . would nuke uncommitted changes. Command: $COMMAND
git status shows there are uncommitted changes. Commit or stash first, or ask the user."
  fi
fi

# ── git branch -D <protected> ─────────────────────────────────────
if printf '%s' "$COMMAND" | grep -qE 'git[[:space:]]+branch[[:space:]]+(-D|--delete[[:space:]]+--force|-d[[:space:]]+--force)'; then
  # Extract tokens after -D / --delete
  TAIL="${COMMAND#*git branch}"
  # shellcheck disable=SC2086
  set -- $TAIL
  for tok in "$@"; do
    case "$tok" in
      -*) continue ;;
    esac
    for b in $PROTECTED_BRANCHES; do
      if [ "$tok" = "$b" ]; then
        deny "git branch -D $b would hard-delete a protected branch. Command: $COMMAND"
      fi
    done
  done
fi

# ── rm -rf on dangerous paths ─────────────────────────────────────
# Look for rm with -r or -R combined with -f, and inspect path args
if printf '%s' "$COMMAND" | grep -qE '(^|[[:space:]]|;|\|\||&&)rm[[:space:]]+([^|;]*-[rR][[:alnum:]]*f|[^|;]*-f[[:alnum:]]*[rR])'; then
  # Tokenize starting from rm
  TAIL=""
  # Split on &&, ||, ;, | to examine each clause separately
  IFS='|&;' read -ra CLAUSES <<< "$(echo "$COMMAND" | tr '\n' ' ')"
  for clause in "${CLAUSES[@]}"; do
    case "$clause" in
      *"rm "*-*r*) ;;
      *"rm -"*) ;;
      *) continue ;;
    esac
    # shellcheck disable=SC2086
    set -- $clause
    # Skip until "rm"
    found_rm=0
    paths=()
    for tok in "$@"; do
      if [ "$found_rm" = 0 ]; then
        case "$tok" in
          *rm) found_rm=1 ;;
        esac
        continue
      fi
      case "$tok" in
        -*) continue ;;
        *) paths+=("$tok") ;;
      esac
    done

    for p in "${paths[@]+"${paths[@]}"}"; do
      # Expand ~ for comparison
      resolved="${p/#\~/$HOME}"
      case "$resolved" in
        /|"$HOME"|"$HOME"/|/*[[:space:]]*) # root, literal home, or glob-ish
          deny "rm -rf targeting a critical path is forbidden. Command: $COMMAND"
          ;;
        "/tmp"|"/tmp/"*|./tmp|./tmp/*|"$PWD/tmp"|"$PWD/tmp/"*) continue ;;
        *node_modules|*node_modules/*) continue ;;
        *__pycache__|*__pycache__/*) continue ;;
        .pytest_cache|.pytest_cache/*|.ruff_cache|.ruff_cache/*|.mypy_cache|.mypy_cache/*) continue ;;
        build|build/*|dist|dist/*|.next|.next/*|.turbo|.turbo/*|coverage|coverage/*) continue ;;
        .devkit|.devkit/*|.devkit-state|.devkit-state/*) continue ;;
        /var/*|/etc/*|/usr/*|/bin/*|/sbin/*|/opt/*|/System/*|/Library/*)
          deny "rm -rf targeting a system path is forbidden. Command: $COMMAND"
          ;;
        .|..|*/..|*/../*|../*)
          deny "rm -rf targeting relative-parent (. / ..) is dangerous. Command: $COMMAND"
          ;;
        *)
          # Anything outside the allowlist — conservative block.
          deny "rm -rf on '$p' isn't in the safe-path allowlist (tmp, node_modules, build, dist, .next, __pycache__, caches, coverage).
Command: $COMMAND
If you really need to remove this, ask the user to run it manually."
          ;;
      esac
    done
  done
fi

hook_log "$HOOK" allowed ""
exit 0
