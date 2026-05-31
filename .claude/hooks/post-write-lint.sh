#!/bin/bash
# Fires after Claude writes or edits a file.
# Runs Ruff (Python) or ESLint (TypeScript) on the changed file.

if ! command -v jq &>/dev/null; then
  echo "Warning: jq not installed — post-write lint hook skipped. Install jq to enable auto-linting." >&2
  exit 0
fi

PAYLOAD=$(cat)
FILE=$(echo "$PAYLOAD" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null)

if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  exit 0
fi

EXT="${FILE##*.}"
ERRORS=0
LINTER_RAN=0

case "$EXT" in
  py)
    if command -v ruff &>/dev/null; then
      echo "Linting $FILE with Ruff..."
      ruff check "$FILE" || ERRORS=1
      ruff format --check "$FILE" || ERRORS=1
      LINTER_RAN=1
    else
      echo "Warning: ruff not installed — $FILE not linted. Run: pip install ruff" >&2
    fi
    ;;
  ts|tsx|js|jsx)
    if command -v npx &>/dev/null; then
      echo "Linting $FILE with ESLint..."
      npx eslint "$FILE" --max-warnings 0 || ERRORS=1
      LINTER_RAN=1
    else
      echo "Warning: npx not found — $FILE not linted. Install Node.js to enable ESLint." >&2
    fi
    ;;
esac

if [ "$ERRORS" -ne 0 ]; then
  echo "Lint errors in $FILE. Fix before continuing."
  exit 1
fi

exit 0
