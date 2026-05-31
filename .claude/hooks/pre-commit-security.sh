#!/bin/bash
# Fires before git commit.
# Scans staged files for hardcoded secrets. Blocks if found.

if ! command -v jq &>/dev/null; then
  echo "Warning: jq not installed — pre-commit-security hook skipped. Install jq to enable secret scanning." >&2
  exit 0
fi

PAYLOAD=$(cat)
COMMAND=$(echo "$PAYLOAD" | jq -r '.tool_input.command // ""' 2>/dev/null)

if ! echo "$COMMAND" | grep -q "git commit"; then
  exit 0
fi

echo "Running security scan on staged files..."
ERRORS=0
STAGED=$(git diff --cached --name-only 2>/dev/null)

if [ -z "$STAGED" ]; then
  exit 0
fi

# Use detect-secrets if available (preferred — handles base64, entropy, etc.)
if command -v detect-secrets &>/dev/null; then
  echo "Using detect-secrets for scan..."
  if ! detect-secrets scan --list-all-plugins --only-allowlisted 2>/dev/null | grep -q .; then
    # Baseline scan on staged content
    TMPFILE=$(mktemp)
    for FILE in $STAGED; do
      [ -f "$FILE" ] || continue
      git show ":$FILE" 2>/dev/null > "$TMPFILE"
      if detect-secrets scan "$TMPFILE" 2>/dev/null | python3 -c "
import sys, json
d = json.load(sys.stdin)
results = d.get('results', {})
if any(v for v in results.values()):
    sys.exit(1)
" 2>/dev/null; then
        :
      else
        echo "Potential secret detected in $FILE (detect-secrets)"
        ERRORS=1
      fi
    done
    rm -f "$TMPFILE"
  fi
else
  # Fallback: regex-based scan covering common secret patterns
  ALLOWLIST="test|mock|example|placeholder|your_|<[^>]+>|os\.environ|getenv|get_settings|process\.env|config\."

  for FILE in $STAGED; do
    if [ ! -f "$FILE" ]; then continue; fi

    FILE_CONTENT=$(git show ":$FILE" 2>/dev/null)

    # key=value style secrets
    if echo "$FILE_CONTENT" | \
      grep -nEi "(api_key|secret_key|password|passwd|token|private_key|access_key|secret)\s*[=:]\s*['\"][^'\"]{8,}['\"]" | \
      grep -vEi "$ALLOWLIST"; then
      echo "Potential hardcoded secret in $FILE"
      ERRORS=1
    fi

    # AWS access key IDs
    if echo "$FILE_CONTENT" | grep -nE "AKIA[0-9A-Z]{16}"; then
      echo "Potential AWS access key in $FILE"
      ERRORS=1
    fi

    # AWS secret access keys (40-char base62 after known field names)
    if echo "$FILE_CONTENT" | \
      grep -nEi "aws_secret_access_key\s*[=:]\s*['\"]?[A-Za-z0-9/+]{40}['\"]?" | \
      grep -vEi "$ALLOWLIST"; then
      echo "Potential AWS secret key in $FILE"
      ERRORS=1
    fi

    # GCP API keys
    if echo "$FILE_CONTENT" | grep -nE "AIza[0-9A-Za-z_-]{35}"; then
      echo "Potential GCP API key in $FILE"
      ERRORS=1
    fi

    # GitHub tokens (classic and fine-grained)
    if echo "$FILE_CONTENT" | grep -nE "gh[pors]_[A-Za-z0-9]{36,}"; then
      echo "Potential GitHub token in $FILE"
      ERRORS=1
    fi

    # Private key headers
    if echo "$FILE_CONTENT" | grep -nE "-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----"; then
      echo "Potential private key in $FILE"
      ERRORS=1
    fi

    # URL-embedded tokens/passwords
    if echo "$FILE_CONTENT" | \
      grep -nEi "https?://[^@\s]{8,}:[^@\s]{8,}@" | \
      grep -vEi "$ALLOWLIST"; then
      echo "Potential credentials in URL in $FILE"
      ERRORS=1
    fi
  done
fi

if [ "$ERRORS" -ne 0 ]; then
  echo "Security scan FAILED. Use environment variables for secrets."
  echo "See: .claude/rules/security.md"
  exit 1
fi

echo "Security scan passed."
exit 0
