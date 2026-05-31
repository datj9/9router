#!/bin/bash
# Fires on session end. Prints PR checklist if there are unpushed commits.

if ! git rev-parse --git-dir &>/dev/null; then
  exit 0
fi

AHEAD=$(git rev-list --count "@{u}..HEAD" 2>/dev/null || echo "0")

if [ "$AHEAD" -eq 0 ]; then
  exit 0
fi

echo ""
echo "================================================"
echo "RINGKAS PR CHECKLIST"
echo "================================================"
echo "  Branch: $(git branch --show-current)"
echo "  Commits ahead: $AHEAD"
echo ""
echo "Before opening a PR:"
echo "  [ ] Run /code-review"
echo "  [ ] Run /security-audit if touching auth, PII, or financial data"
echo ""
echo "PR requirements:"
echo "  [ ] Title: [<ticket-id>] <summary>"
echo "  [ ] Label: feat / fix / bugfix / chore / docs / devops"
echo "  [ ] At least 2 reviewers assigned"
echo "  [ ] Squash commits decision made"
echo "  [ ] Source branch NOT deleted on merge"
echo "  [ ] Self-tested locally"
echo "================================================"
echo ""
exit 0
