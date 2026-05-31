#!/usr/bin/env bash
# PreToolUse:Bash — run tests before `git push`. Block on failure.
#
# Detects framework + package manager and runs a sensible fast command
# with a timeout.
#
# Escape hatches:
#   - export DEVKIT_PREPUSH_SKIP=1 in your shell rc
#   - prefix the command: `DEVKIT_PREPUSH_SKIP=1 git push ...` (parsed
#     from the command string itself, since hook env doesn't always
#     receive inline VAR=val from Claude Code)
#   - touch .devkit/prepush-skip in the project root for a one-off
#
# Timeout default: 90s (override via DEVKIT_PREPUSH_TIMEOUT).
#
# Design:
#   - Fail-CLOSED when tests run and fail.
#   - Fail-OPEN when we can't determine a test command (no config found,
#     no lockfile), so greenfield / non-test repos don't break.
#   - Fail-OPEN with a logged WARNING when the test runner binary isn't
#     on PATH and we can't find it in the augmented search list. Blocking
#     the push because Claude Code's hook env can't see pnpm/yarn/etc is
#     the devkit's environment problem, not the user's mistake.
#   - Fail-CLOSED on timeout (with explicit escape hatch), so a slow
#     test suite doesn't become a silent bypass.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_lib.sh
. "$SCRIPT_DIR/_lib.sh"

HOOK="pre-push-tests"

PAYLOAD=$(cat)
command -v jq >/dev/null 2>&1 || exit 0
COMMAND=$(printf '%s' "$PAYLOAD" | jq -r '.tool_input.command // ""' 2>/dev/null)
[ -z "$COMMAND" ] && exit 0

# Only act on "git push"
case "$COMMAND" in
  *"git push"*) ;;
  *) exit 0 ;;
esac

# ── Escape hatches ────────────────────────────────────────────────
# 1. Process env (from user's shell rc)
# 2. Inline prefix: `DEVKIT_PREPUSH_SKIP=1 git push ...` parsed from the
#    command itself — Claude Code's hook may not propagate inline
#    VAR=val env vars to the hook process.
# 3. Project flag: .devkit/prepush-skip file
SKIP=0
[ "${DEVKIT_PREPUSH_SKIP:-0}" = "1" ] && SKIP=1
case "$COMMAND" in
  *"DEVKIT_PREPUSH_SKIP=1"*) SKIP=1 ;;
  *"DEVKIT_PREPUSH_SKIP=true"*) SKIP=1 ;;
esac

ROOT="${CLAUDE_PROJECT_DIR:-$PWD}"
cd "$ROOT" || exit 0

[ -f ".devkit/prepush-skip" ] && SKIP=1

if [ "$SKIP" = "1" ]; then
  hook_log "$HOOK" allowed "skipped via DEVKIT_PREPUSH_SKIP or .devkit/prepush-skip"
  exit 0
fi

TIMEOUT="${DEVKIT_PREPUSH_TIMEOUT:-90}"

deny() {
  hook_log "$HOOK" blocked "$1"
  emit_pretooluse_deny "$1"
  exit 0
}

# ── Augment PATH so hook can find user-installed tools ────────────
# Claude Code launched from a GUI gets a stripped PATH. Add common
# install locations so we can find pnpm/yarn/bun/npm/python/pytest etc.
augment_path() {
  local extra
  extra="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin"
  extra="$extra:$HOME/.volta/bin"
  extra="$extra:$HOME/.local/share/pnpm"
  extra="$extra:$HOME/Library/pnpm"
  extra="$extra:$HOME/.local/share/fnm/aliases/default/bin"
  extra="$extra:$HOME/.fnm/aliases/default/bin"
  extra="$extra:$HOME/.asdf/shims"
  extra="$extra:$HOME/.nvm/versions/node/$(ls -1 "$HOME/.nvm/versions/node" 2>/dev/null | sort -V | tail -1)/bin"
  extra="$extra:$HOME/.npm-global/bin"
  extra="$extra:$HOME/.bun/bin"
  extra="$extra:$HOME/.cargo/bin"
  PATH="$PATH:$extra"
  export PATH
}
augment_path

# ── Detect package manager (Node.js projects) ─────────────────────
# Priority: lockfile presence first (most reliable), then packageManager
# field in package.json, then fall back to npm. Critical because pnpm /
# yarn workspaces and turbo refuse to run when invoked through npm.
detect_node_pm() {
  if [ -f "pnpm-lock.yaml" ]; then echo "pnpm"; return; fi
  if [ -f "yarn.lock" ]; then echo "yarn"; return; fi
  if [ -f "bun.lockb" ] || [ -f "bun.lock" ]; then echo "bun"; return; fi
  if [ -f "package-lock.json" ]; then echo "npm"; return; fi
  if [ -f "package.json" ] && command -v jq >/dev/null 2>&1; then
    pm_field=$(jq -r '.packageManager // empty' package.json 2>/dev/null)
    case "$pm_field" in
      pnpm@*) echo "pnpm"; return ;;
      yarn@*) echo "yarn"; return ;;
      bun@*)  echo "bun"; return ;;
      npm@*)  echo "npm"; return ;;
    esac
  fi
  echo "npm"
}

# ── Detect test command ───────────────────────────────────────────
TEST_CMD=""
TEST_LABEL=""
RUNNER_BIN=""

if [ -f "package.json" ]; then
  PM="$(detect_node_pm)"
  # Prefer test:fast / test:quick / test:unit; else fall back to test
  for script in test:fast test:quick test:unit test; do
    if jq -e ".scripts[\"$script\"]" package.json >/dev/null 2>&1; then
      case "$PM" in
        pnpm) TEST_CMD="pnpm run --silent $script"; RUNNER_BIN="pnpm" ;;
        yarn) TEST_CMD="yarn --silent $script"; RUNNER_BIN="yarn" ;;
        bun)  TEST_CMD="bun run --silent $script"; RUNNER_BIN="bun" ;;
        *)    TEST_CMD="npm run --silent $script"; RUNNER_BIN="npm" ;;
      esac
      TEST_LABEL="$PM run $script"
      break
    fi
  done
fi

if [ -z "$TEST_CMD" ]; then
  if [ -f "pyproject.toml" ] && grep -qE '(\[tool\.pytest|\[tool\.poetry|pytest)' pyproject.toml 2>/dev/null; then
    TEST_CMD="pytest -x --ff -q --no-header"
    TEST_LABEL="pytest"
    RUNNER_BIN="pytest"
  elif [ -f "pytest.ini" ] || { [ -f "setup.cfg" ] && grep -qE '\[tool:pytest\]' setup.cfg 2>/dev/null; }; then
    TEST_CMD="pytest -x --ff -q --no-header"
    TEST_LABEL="pytest"
    RUNNER_BIN="pytest"
  elif [ -f "manage.py" ]; then
    TEST_CMD="python manage.py test --failfast -v 0"
    TEST_LABEL="manage.py test"
    RUNNER_BIN="python"
  fi
fi

# Nothing detected → allow (don't block pushes in repos without tests)
if [ -z "$TEST_CMD" ]; then
  hook_log "$HOOK" allowed "no test framework detected"
  exit 0
fi

# ── Fail-OPEN if the runner binary isn't reachable ────────────────
# This is the devkit's environment problem (Claude Code launched from a
# GUI without the user's full PATH), not the user's mistake. Better to
# warn loudly than to block their push for a non-test reason.
if [ -n "$RUNNER_BIN" ] && ! command -v "$RUNNER_BIN" >/dev/null 2>&1; then
  warning_msg="WARNING: pre-push-tests can't find '$RUNNER_BIN' on PATH.
Skipping the test run — the push will go through.

Why: Claude Code's hook process inherits its parent's PATH. When
launched from Spotlight/dock/IDE, the parent shell's PATH (with your
nvm/fnm/volta/asdf/pnpm install) is not loaded.

Fixes (any one of these):
  1. Launch Claude Code from a terminal where '$RUNNER_BIN' is on PATH
  2. Set the runner's path explicitly in your ~/.zshrc and re-launch:
       export PATH=\"\$HOME/Library/pnpm:\$PATH\"
  3. Run the tests yourself before pushing: $TEST_CMD
  4. Persistently skip this hook: touch .devkit/prepush-skip"
  hook_log "$HOOK" allowed "runner '$RUNNER_BIN' not on PATH — failing open"
  printf '%s\n' "$warning_msg" >&2
  exit 0
fi

# ── Run with timeout ──────────────────────────────────────────────
echo "Running tests before push: $TEST_LABEL (timeout ${TIMEOUT}s — set DEVKIT_PREPUSH_SKIP=1 to skip)" >&2

# Cross-platform timeout: use `gtimeout` or `timeout` if available,
# else fall back to a background-kill shim.
run_with_timeout() {
  if command -v gtimeout >/dev/null 2>&1; then
    gtimeout "${TIMEOUT}s" bash -c "$TEST_CMD"
  elif command -v timeout >/dev/null 2>&1; then
    timeout "${TIMEOUT}s" bash -c "$TEST_CMD"
  else
    # Shim: background + sleep + kill. Exit code 124 on timeout.
    bash -c "$TEST_CMD" &
    local pid=$!
    (sleep "$TIMEOUT" && kill -TERM "$pid" 2>/dev/null) &
    local watcher=$!
    if wait "$pid"; then
      # Silence "Terminated" jobs message when we kill the watcher
      kill -TERM "$watcher" 2>/dev/null
      wait "$watcher" 2>/dev/null
      return 0
    else
      local rc=$?
      kill -TERM "$watcher" 2>/dev/null
      wait "$watcher" 2>/dev/null
      # If watcher killed the process, exit 124 to mimic timeout(1)
      if ! kill -0 "$pid" 2>/dev/null; then
        return "$rc"
      fi
      return 124
    fi
  fi
}

TMPOUT=$(mktemp -t devkit-prepush.XXXXXX)
set +e
run_with_timeout > "$TMPOUT" 2>&1
RC=$?
set -e

if [ "$RC" = 0 ]; then
  hook_log "$HOOK" allowed "tests passed ($TEST_LABEL)"
  rm -f "$TMPOUT"
  exit 0
fi

OUTPUT=$(tail -n 40 "$TMPOUT" 2>/dev/null)
rm -f "$TMPOUT"

# Exit 127 = command not found despite our PATH augmentation. Treat as
# environment failure, not test failure. Fail open with the same warning.
if [ "$RC" = 127 ]; then
  warning_msg="WARNING: pre-push-tests ran '$TEST_CMD' but got exit 127 (command not found).
Skipping the test run — the push will go through.

Last output:
$OUTPUT

This means the test runner couldn't be found in the hook's PATH.
Fix: launch Claude Code from a terminal where the runner is on PATH,
or touch .devkit/prepush-skip to silence this hook permanently for
this project."
  hook_log "$HOOK" allowed "exit 127 from runner — failing open"
  printf '%s\n' "$warning_msg" >&2
  exit 0
fi

if [ "$RC" = 124 ]; then
  deny "Tests timed out after ${TIMEOUT}s ($TEST_LABEL). Push blocked.
Last output:
$OUTPUT

If this is expected (slow suite, you're pushing WIP), prefix the push:
  DEVKIT_PREPUSH_SKIP=1 git push ...
…or touch .devkit/prepush-skip to silence this hook for this project."
fi

deny "Tests failed ($TEST_LABEL, exit $RC). Push blocked.
Last output:
$OUTPUT

Fix the failing tests before pushing. If you must push WIP:
  DEVKIT_PREPUSH_SKIP=1 git push ...
…or touch .devkit/prepush-skip to silence this hook for this project."
