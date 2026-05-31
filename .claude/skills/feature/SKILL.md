---
name: feature
description: Orchestrates a full feature delivery pipeline (plan → code → test → review → security audit) by dispatching specialized agents in sequence and writing artifacts to .devkit/. Produces a tested, reviewed, security-audited implementation ready to commit. Use when the user says "build feature X", "implement Y", "add capability Z", "ship a new endpoint/page/module", or hands off a PRD / EP-... epic to execute end-to-end.
version: 2.1.0
author: Ringkas Engineering
disable-model-invocation: true
---

# Feature Workflow

End-to-end feature development with agent orchestration.

## Step 1 — Initialize

Ask for:
1. Ticket ID (e.g., EP-754 for the driving PRD, LT-8451 for an engineering task, AI-269 for AI work, DO-152 for devops — see glossary.md) or feature description
2. Coder mode: "Should I write the code, or will you? (auto/engineer)"
   - Check memory `devkit-coder-mode` for default. If set, offer as default.

Initialize state:
```bash
"${CLAUDE_PLUGIN_ROOT}/bin/devkit-state.sh" init feature <ticket-id> --coder <mode>
```

Parse the JSON response. Save coder mode to memory if first time.

## Step 2 — Planner (opus)

Dispatch the Planner agent:
- Agent type: planner (from agents/planner.md)
- Model: opus (from state init response)
- Prompt: "You are the Planner agent. Read the ticket description: <description>. Follow your agent instructions. Write the plan to .devkit/plan.md."

Wait for `## PLAN COMPLETE` in response.
Then advance state:
```bash
"${CLAUDE_PLUGIN_ROOT}/bin/devkit-state.sh" advance
```

## Step 3 — Coder (sonnet) or Engineer Pause

**If coder_mode == auto:**
Dispatch the Coder agent:
- Agent type: coder (from agents/coder.md)
- Model: sonnet
- Prompt: "You are the Coder agent. Read .devkit/plan.md and implement it. Follow your agent instructions."

Wait for `## CODE COMPLETE`.

**If coder_mode == engineer:**
Print: "Your turn to code. The plan is in .devkit/plan.md. Say 'done' when ready to continue."
Wait for user to say "done".

Then advance state:
```bash
"${CLAUDE_PLUGIN_ROOT}/bin/devkit-state.sh" advance
```

## Step 4 — Tester (sonnet)

Dispatch the Tester agent:
- Agent type: tester (from agents/tester.md)
- Model: sonnet
- Prompt: "You are the Tester agent. Read .devkit/plan.md and the git diff. Write tests. Follow your agent instructions."

Wait for `## TESTS COMPLETE`. Advance state.

## Step 5 — Reviewer (sonnet)

Dispatch the Reviewer agent:
- Agent type: reviewer (from agents/reviewer.md)
- Model: sonnet
- Prompt: "You are the Reviewer agent. Review the git diff. Write review to .devkit/review.md. Follow your agent instructions."

Wait for `## REVIEW COMPLETE`. Advance state.

If verdict is NEEDS FIXES, print findings and ask:
"Review found issues. Fix them now, or continue to security audit?"

## Step 6 — Security (haiku)

Dispatch the Security agent:
- Agent type: security (from agents/security.md)
- Model: haiku
- Prompt: "You are the Security agent. Audit the git diff. Write report to .devkit/security-audit.md. Follow your agent instructions."

Wait for `## AUDIT COMPLETE`. Advance state.

## Step 7 — Complete

```bash
"${CLAUDE_PLUGIN_ROOT}/bin/devkit-state.sh" complete
```

Print summary:
- Steps completed / skipped
- Review verdict
- Security verdict
- Suggest: "Run /git-workflow to create branch and MR."

## Skipping Steps

If engineer says "skip" at any step:
```bash
"${CLAUDE_PLUGIN_ROOT}/bin/devkit-state.sh" skip <step-name> "<reason>"
```
Print the warning from the JSON response. Continue to next step.

## Pausing

If engineer says "pause" or context monitor triggers:
```bash
"${CLAUDE_PLUGIN_ROOT}/bin/devkit-state.sh" checkpoint "<reason>"
```
Print: "Workflow paused. Run /resume to continue."
