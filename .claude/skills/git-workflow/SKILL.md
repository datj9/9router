---
name: git-workflow
description: Guides branch creation (format `<type>/<ticket-id>` where ticket pattern comes from `.claude/devkit-plan.json` `git_workflow`, default `(EP|LT|AI|DO)-<n>`), conventional-commit message authoring, and MR creation with the title shape `[<ticket>] <summary>`; can open the GitLab MR directly via the GitLab MCP. Use when the user says "create a branch", "start a new task", "commit this", "open an MR", "ship this", "let's work on EP-...", or starts work on a new ticket.
version: 1.3.0
author: Ringkas Engineering
---

# Git Workflow Guide

> Language rule: All PR titles, commit messages, and descriptions must be in English.
> GitLab access: Follow `skills/_shared/gitlab-access.md` for auth discovery, token handling, and memory persistence.
> Ticket format: Read `.claude/devkit-plan.json` `git_workflow` block first. It defines `branch_types`, `commit_types`, `ticket_pattern` (ERE regex), `ticket_examples`, `branch_examples`, `commit_examples`, and `ticket_prefixes_doc`. Use those exact values in prompts and validation. Fall back to the Ringkas defaults (EP/LT/AI/DO) only when the config is missing.

## Step 1 — Determine Action

Ask what to do:
- A) Create a new branch
- B) Write a commit message
- C) Generate a PR/MR description
- D) Create a GitLab MR directly
- E) Full workflow (A → B → C → D)

## Step 2A — Create a Branch

Ask:
1. Ticket ID? (show examples from `git_workflow.ticket_examples`; default examples: EP-754, LT-8451, AI-269, DO-152)
2. Type of change? (show values from `git_workflow.branch_types`)

Construct `<type>/<ticket-id>`. Validate against `git_workflow.ticket_pattern` before running.

```
git checkout QC
git pull origin QC
git checkout -b <type>/<ticket-id>
```

If branch name does not match `<type>/<ticket-id>`, stop and ask user to correct.

## Step 2B — Write a Commit Message

Ask:
1. What changed? (one sentence)
2. Scope? (optional)
3. Type? (show values from `git_workflow.commit_types`)
4. Ticket ID? (same ticket from branch — pre-fill from branch name when possible)

Construct: `<type>(scope?): [<ticket-id>] <subject>`
Rules: present tense, not capitalized, no period, max 72 chars. Ticket ID in square brackets right after the colon. Omit brackets only when the commit genuinely has no ticket.

Examples:
- `feat(auth): [EP-754] add JWT refresh token endpoint`
- `fix: [AI-332] add nodejs to docker image for stdio mcp servers`

### Format changed files before committing

Before staging, detect and run the project's formatter on changed files:

1. Check `package.json` scripts for format/lint commands (e.g. `format`, `lint:fix`, `prettier`)
2. Check for config files: `.prettierrc*`, `biome.json`, `pyproject.toml` (ruff), `.eslintrc*`
3. Run the appropriate formatter on changed files only:

```bash
# Detect changed files
CHANGED=$(git diff --name-only --diff-filter=ACMR)

# TypeScript/JavaScript projects (check in order):
# - package.json "format" script → npx prettier --write $CHANGED
# - biome.json → npx biome format --write $CHANGED
# - .prettierrc* → npx prettier --write $CHANGED
# - eslint → npx eslint --fix $CHANGED

# Python projects (check in order):
# - pyproject.toml with [tool.ruff] → ruff format $CHANGED && ruff check --fix $CHANGED
# - .flake8 or setup.cfg → autopep8 --in-place $CHANGED
# - black config → black $CHANGED
```

4. If no formatter is detected, skip with a warning: "No formatter found — skipping auto-format."

Show to user for confirmation, then:
```
git add <files>
git commit -m "<message>"
```

## Step 2C — Generate a PR/MR Description

Ask:
1. Notion ticket ID?
2. Summary of changes?
3. What was tested?

Generate:

**Title:** [<ticket-id>] <summary>

**Body:**
## What changed
<summary>

## How to test
<numbered steps>

## Checklist
- [ ] Self-tested locally
- [ ] At least 2 reviewers assigned
- [ ] Label set
- [ ] Squash commits decision made
- [ ] Source branch NOT deleted on merge

## Step 2D — Create GitLab MR

Follow `skills/_shared/gitlab-access.md` to authenticate, then create the MR:

```bash
# With glab (preferred):
glab mr create --title "[${TICKET_ID}] ${SUMMARY}" \
  --description "${BODY}" \
  --target-branch "${TARGET}" \
  --reviewer "${REVIEWER1},${REVIEWER2}" \
  --label "${LABEL}"

# With API:
curl -s --request POST --header "PRIVATE-TOKEN: ${TOKEN}" \
  --header "Content-Type: application/json" \
  --data '{
    "source_branch": "'${SOURCE}'",
    "target_branch": "'${TARGET}'",
    "title": "['${TICKET_ID}'] '${SUMMARY}'",
    "description": "'"${BODY}"'",
    "reviewer_ids": [${REVIEWER_IDS}],
    "labels": "'${LABEL}'"
  }' \
  "https://${GITLAB_HOST}/api/v4/projects/${PROJECT_PATH}/merge_requests"
```

After creation, print the MR URL.

## Step 3 — Final Reminder

Always end with:

Before submitting:
1. Assign at least 2 reviewers
2. Set the appropriate label
3. Run /code-review for automated convention check
4. Run /security-audit if touching auth, PII, or financial data
