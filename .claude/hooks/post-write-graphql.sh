#!/bin/bash
# PostToolUse hook — fires after Write|Edit on .gql files in saturn.
# Reminds the agent to run codegen and check remote_schemas.yaml.

if ! command -v jq &>/dev/null; then
  exit 0
fi

PAYLOAD=$(cat)
FILE=$(echo "$PAYLOAD" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null)

if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  exit 0
fi

EXT="${FILE##*.}"

# Only act on .gql / .graphql files
case "$EXT" in
  gql|graphql) ;;
  *) exit 0 ;;
esac

# Only act if we're in a project that has Hasura remote schemas (saturn-like)
REMOTE_SCHEMAS=""
PROJECT_ROOT=$(git -C "$(dirname "$FILE")" rev-parse --show-toplevel 2>/dev/null || echo "")
if [ -n "$PROJECT_ROOT" ]; then
  REMOTE_SCHEMAS=$(find "$PROJECT_ROOT/src" -name "remote_schemas.yaml" -maxdepth 5 2>/dev/null | head -1)
fi

echo "GraphQL schema changed: $FILE"
echo ""
echo "Checklist:"
echo "  1. Run \`yarn codegen\` to regenerate TypeScript types"

if [ -n "$REMOTE_SCHEMAS" ]; then
  echo "  2. Check if remote_schemas.yaml needs updating:"
  echo "     $REMOTE_SCHEMAS"
  echo "     (required if this change adds/removes/modifies queries, mutations,"
  echo "      or types visible to Hasura roles)"
  echo "  3. If updated, run \`yarn hasura:migrate\`"
fi

exit 0
