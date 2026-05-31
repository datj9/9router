#!/bin/bash
# Enforces configurable conventional commits:
#   <type>(scope?): [<ticket-id>] <subject>
# Ticket ID is optional at this layer but should be included when it exists.

if ! command -v jq &>/dev/null; then
  echo "Warning: jq not installed — commit message validation skipped. Install jq to enable this check." >&2
  exit 0
fi

PAYLOAD=$(cat)
COMMAND=$(echo "$PAYLOAD" | jq -r '.tool_input.command // ""' 2>/dev/null)

if ! echo "$COMMAND" | grep -q "git commit"; then
  exit 0
fi

MSG=$(echo "$COMMAND" | sed -n "s/.*-m '\([^']*\)'.*/\1/p" | head -1)
if [ -z "$MSG" ]; then
  MSG=$(echo "$COMMAND" | sed -n 's/.*-m "\([^"]*\)".*/\1/p' | head -1)
fi

if [ -z "$MSG" ]; then
  exit 0
fi

CONFIG_PATH="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/devkit-plan.json"
DEFAULT_COMMIT_TYPES="feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert"
DEFAULT_TICKET_PATTERN="(EP|LT|AI|DO)-[0-9]+"
DEFAULT_COMMIT_EXAMPLES="feat(auth): [EP-754] add JWT refresh token endpoint|fix: [AI-332] add nodejs to docker image for stdio mcp servers|chore: bump README version"
DEFAULT_PREFIX_DOC="EP- (PRD), LT- (eng), AI- (AI), DO- (devops)"

COMMIT_TYPES="$DEFAULT_COMMIT_TYPES"
TICKET_PATTERN="$DEFAULT_TICKET_PATTERN"
COMMIT_EXAMPLES="$DEFAULT_COMMIT_EXAMPLES"
PREFIX_DOC="$DEFAULT_PREFIX_DOC"

if [ -f "$CONFIG_PATH" ]; then
  if ! jq -e . "$CONFIG_PATH" >/dev/null 2>&1; then
    echo "Invalid git workflow config: $CONFIG_PATH"
    echo "Fix .claude/devkit-plan.json before committing."
    exit 1
  fi

  CONFIG_COMMIT_TYPES=$(jq -r '(.git_workflow.commit_types // []) | map(select(type == "string" and test("^[A-Za-z0-9_-]+$"))) | join("|")' "$CONFIG_PATH")
  INVALID_COMMIT_TYPES=$(jq -r '(.git_workflow.commit_types // []) | map(select(type != "string" or (test("^[A-Za-z0-9_-]+$") | not))) | join(", ")' "$CONFIG_PATH")
  CONFIG_TICKET_PATTERN=$(jq -r '.git_workflow.ticket_pattern // empty' "$CONFIG_PATH")
  CONFIG_COMMIT_EXAMPLES=$(jq -r '(.git_workflow.commit_examples // []) | map(select(type == "string" and length > 0)) | join("|")' "$CONFIG_PATH")
  CONFIG_PREFIX_DOC=$(jq -r '.git_workflow.ticket_prefixes_doc // empty' "$CONFIG_PATH")

  if [ -n "$INVALID_COMMIT_TYPES" ]; then
    echo "Invalid commit types in .claude/devkit-plan.json: $INVALID_COMMIT_TYPES"
    echo "Commit types may only contain letters, numbers, underscores, and hyphens."
    exit 1
  fi

  [ -n "$CONFIG_COMMIT_TYPES" ] && COMMIT_TYPES="$CONFIG_COMMIT_TYPES"
  [ -n "$CONFIG_TICKET_PATTERN" ] && TICKET_PATTERN="$CONFIG_TICKET_PATTERN"
  [ -n "$CONFIG_COMMIT_EXAMPLES" ] && COMMIT_EXAMPLES="$CONFIG_COMMIT_EXAMPLES"
  [ -n "$CONFIG_PREFIX_DOC" ] && PREFIX_DOC="$CONFIG_PREFIX_DOC"
fi

PATTERN="^($COMMIT_TYPES)(\([^)]+\))?: .{1,100}$"
echo "" | grep -qE "$PATTERN" >/dev/null 2>&1
GREP_RC=$?
if [ "$GREP_RC" -gt 1 ]; then
  echo "Invalid commit pattern derived from .claude/devkit-plan.json"
  exit 1
fi

if ! echo "$MSG" | grep -qE "$PATTERN"; then
  echo "Invalid commit message: '$MSG'"
  echo "Required: <type>(scope?): [<ticket-id>] <subject>"
  echo "Ticket pattern: $TICKET_PATTERN"
  echo "Examples:"
  echo "$COMMIT_EXAMPLES" | tr '|' '\n' | sed 's/^/  /'
  echo "Valid types: $(echo "$COMMIT_TYPES" | tr '|' ', ')"
  echo "Ticket prefixes: $PREFIX_DOC"
  echo "Edit .claude/devkit-plan.json git_workflow to customize."
  echo "See: .claude/rules/git-workflow.md"
  exit 1
fi

echo "Commit message is valid."
exit 0
