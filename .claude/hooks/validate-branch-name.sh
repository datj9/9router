#!/bin/bash
# Enforces configurable branch naming: <type>/<ticket-id>

if ! command -v jq &>/dev/null; then
  echo "Warning: jq not installed — branch name validation skipped. Install jq to enable this check." >&2
  exit 0
fi

PAYLOAD=$(cat)
COMMAND=$(echo "$PAYLOAD" | jq -r '.tool_input.command // ""' 2>/dev/null)

if ! echo "$COMMAND" | grep -qE "git (checkout -b|switch -c)"; then
  exit 0
fi

BRANCH=$(echo "$COMMAND" | grep -oE "(checkout -b|switch -c)\s+\S+" | awk '{print $NF}')

if [ -z "$BRANCH" ]; then
  exit 0
fi

CONFIG_PATH="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/devkit-plan.json"
DEFAULT_BRANCH_TYPES="feat|cr|fix|bugfix|test|chore|docs|devops|release|refactor|revert|hotfix"
DEFAULT_TICKET_PATTERN="(EP|LT|AI|DO)-[0-9]+"
DEFAULT_BRANCH_EXAMPLES="feat/EP-754, fix/LT-8451, feat/AI-269, chore/DO-152"
DEFAULT_PREFIX_DOC="EP- (PRD), LT- (eng), AI- (AI), DO- (devops). See: .claude/rules/glossary.md"

BRANCH_TYPES="$DEFAULT_BRANCH_TYPES"
TICKET_PATTERN="$DEFAULT_TICKET_PATTERN"
BRANCH_EXAMPLES="$DEFAULT_BRANCH_EXAMPLES"
PREFIX_DOC="$DEFAULT_PREFIX_DOC"

if [ -f "$CONFIG_PATH" ]; then
  if ! jq -e . "$CONFIG_PATH" >/dev/null 2>&1; then
    echo "Invalid git workflow config: $CONFIG_PATH"
    echo "Fix .claude/devkit-plan.json before creating branches."
    exit 1
  fi

  CONFIG_BRANCH_TYPES=$(jq -r '(.git_workflow.branch_types // []) | map(select(type == "string" and test("^[A-Za-z0-9_-]+$"))) | join("|")' "$CONFIG_PATH")
  INVALID_BRANCH_TYPES=$(jq -r '(.git_workflow.branch_types // []) | map(select(type != "string" or (test("^[A-Za-z0-9_-]+$") | not))) | join(", ")' "$CONFIG_PATH")
  CONFIG_TICKET_PATTERN=$(jq -r '.git_workflow.ticket_pattern // empty' "$CONFIG_PATH")
  CONFIG_BRANCH_EXAMPLES=$(jq -r '(.git_workflow.branch_examples // []) | map(select(type == "string" and length > 0)) | join(", ")' "$CONFIG_PATH")
  CONFIG_PREFIX_DOC=$(jq -r '.git_workflow.ticket_prefixes_doc // empty' "$CONFIG_PATH")

  if [ -n "$INVALID_BRANCH_TYPES" ]; then
    echo "Invalid branch types in .claude/devkit-plan.json: $INVALID_BRANCH_TYPES"
    echo "Branch types may only contain letters, numbers, underscores, and hyphens."
    exit 1
  fi

  [ -n "$CONFIG_BRANCH_TYPES" ] && BRANCH_TYPES="$CONFIG_BRANCH_TYPES"
  [ -n "$CONFIG_TICKET_PATTERN" ] && TICKET_PATTERN="$CONFIG_TICKET_PATTERN"
  [ -n "$CONFIG_BRANCH_EXAMPLES" ] && BRANCH_EXAMPLES="$CONFIG_BRANCH_EXAMPLES"
  [ -n "$CONFIG_PREFIX_DOC" ] && PREFIX_DOC="$CONFIG_PREFIX_DOC"
fi

PATTERN="^($BRANCH_TYPES)/($TICKET_PATTERN)$"
echo "" | grep -qE "$PATTERN" >/dev/null 2>&1
GREP_RC=$?
if [ "$GREP_RC" -gt 1 ]; then
  echo "Invalid ticket pattern in .claude/devkit-plan.json: $TICKET_PATTERN"
  exit 1
fi

if ! echo "$BRANCH" | grep -qE "$PATTERN"; then
  echo "Invalid branch name: '$BRANCH'"
  echo "Required: <type>/<ticket-id>"
  echo "Ticket pattern: $TICKET_PATTERN"
  echo "Examples: $BRANCH_EXAMPLES"
  echo "Valid types: $(echo "$BRANCH_TYPES" | tr '|' ', ')"
  echo "Ticket prefixes: $PREFIX_DOC"
  echo "Edit .claude/devkit-plan.json git_workflow to customize."
  exit 1
fi

echo "Branch '$BRANCH' is valid."
exit 0
