---
name: audit
description: Runs an ISO 27001 security audit (controls A.9 access control, A.10 cryptography, A.12.4 logging, A.14.2 secure development) and a dependency CVE scan against the project's package manager, then writes a per-control PASS/FAIL report to .devkit/security-audit.md and optionally posts findings to a GitLab MR comment. Use when the user says "audit", "security audit", "ISO 27001", "compliance check", "scan dependencies", "check for vulnerabilities", or before merging to master/uat/training.
version: 2.1.0
author: Ringkas Engineering
disable-model-invocation: true
---

# Audit Workflow

Run ISO 27001 security checks and package vulnerability scan.

> GitLab access: Follow `skills/_shared/gitlab-access.md` for auth.

## Step 1 — Determine Scope

Check input:
- If GitLab MR URL: fetch diff from MR
- If no URL: use local diff or scan entire project

Initialize state:
```bash
"${CLAUDE_PLUGIN_ROOT}/bin/devkit-state.sh" init audit <ticket-or-mr-id>
```

## Step 2 — Security Agent (haiku)

Dispatch Security agent:
- Runs both ISO 27001 controls AND package vulnerability scan
- Prompt: "Audit the code changes. Run both ISO 27001 checks and dependency scan. Write to .devkit/security-audit.md."

Wait for `## AUDIT COMPLETE`. Advance state.

## Step 3 — Complete

Print audit summary.
If MR URL was provided, offer to post audit as MR comment.

```bash
"${CLAUDE_PLUGIN_ROOT}/bin/devkit-state.sh" complete
```
