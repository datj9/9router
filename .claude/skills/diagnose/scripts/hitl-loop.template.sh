#!/usr/bin/env bash
# Human-in-the-loop reproduction loop — last-resort Phase 1 strategy.
# Copy this file, edit the steps below, and run it.
# The agent runs the script; the user follows prompts in their terminal.
# At the end, captured values are printed as KEY=VALUE for the agent to parse.
#
# Usage:
#   bash skills/diagnose/scripts/hitl-loop.template.sh
#
# Two helpers:
#   step "<instruction>"          → show instruction, wait for Enter
#   capture VAR "<question>"      → show question, read response into VAR

set -euo pipefail

step() {
  printf '\n>>> %s\n' "$1"
  read -r -p "    [Enter when done] " _
}

capture() {
  local var="$1" question="$2" answer
  printf '\n>>> %s\n' "$question"
  read -r -p "    > " answer
  printf -v "$var" '%s' "$answer"
}

# --- edit below ---------------------------------------------------------

step "Open jupiter at http://localhost:3000 and sign in as the test user."

capture ERRORED "Click the action that triggers the bug. Did it fail? (y/n)"

capture ERROR_MSG "Paste the exact error message from the console (or 'none'):"

capture NETWORK_STATUS "Open DevTools → Network tab. What status code did the failing request return?"

# --- edit above ---------------------------------------------------------

printf '\n--- Captured ---\n'
printf 'ERRORED=%s\n' "$ERRORED"
printf 'ERROR_MSG=%s\n' "$ERROR_MSG"
printf 'NETWORK_STATUS=%s\n' "$NETWORK_STATUS"
