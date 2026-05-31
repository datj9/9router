---
name: review
description: Reviews code changes against Ringkas conventions and ISO 27001 controls, with automatic security escalation if the diff touches authentication, authorization, PII, financial logic, or external API code. Output: CRITICAL / HIGH / MEDIUM findings with file:line references and a PASS/FAIL verdict. Works on a local diff, current branch, or a GitLab MR URL. Use when the user says "review", "code review", "check this MR", "look at my changes", "is this safe to ship", or pastes a GitLab MR URL.
version: 2.1.0
author: Ringkas Engineering
---

# Review Workflow

Review code changes with automatic security escalation.

> GitLab access: Follow `skills/_shared/gitlab-access.md` for auth.

## Step 1 — Determine Scope

Check input:
- If GitLab MR URL provided: parse URL, fetch MR metadata (target branch!), get diff
- If no URL: use local git diff (staged + unstaged, or branch diff)

Initialize state:
```bash
"${CLAUDE_PLUGIN_ROOT}/bin/devkit-state.sh" init review <ticket-or-mr-id>
```

## Step 2 — Reviewer (sonnet)

Dispatch the Reviewer agent:
- Prompt includes: the diff source (local or MR), target branch
- For MR: "Review MR <id> (<source> → <target>). Fetch diff via GitLab API."
- For local: "Review local changes. Run git diff."

Wait for `## REVIEW COMPLETE`. Advance state.

## Step 3 — Security Check (auto-trigger)

Scan the diff for auth/PII indicators:
```bash
git diff HEAD~N | grep -iE "(auth|login|password|jwt|token|pii|encrypt|secret|permission|role)" | head -5
```

If matches found, auto-dispatch Security agent (haiku):
- Print: "Auth/PII changes detected — running security audit automatically."

If no matches, skip security:
```bash
"${CLAUDE_PLUGIN_ROOT}/bin/devkit-state.sh" skip security "no auth/PII changes detected"
```

## Step 4 — Complete

Print review summary + security verdict (if run).
If MR URL was provided, offer to post review as MR comment.
