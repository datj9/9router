---
name: bugfix
description: End-to-end bug-fix workflow that runs /diagnose first to produce a disciplined root-cause report (.devkit/diagnose.md), then orchestrates coder → tester → reviewer agents to apply the fix, add a regression test, and verify against Ringkas conventions. Use when the user says "fix this bug", "fix and ship", "debug and fix X", "there's a regression — fix it", or hands off a ticket / stack trace and wants a tested, reviewed fix on a branch.
version: 2.2.0
author: Ringkas Engineering
---

# Bug Fix Workflow

Diagnose, fix, test, and review a single bug. The diagnosis discipline lives in `/diagnose` — this skill consumes its output and drives the rest.

## Step 1 — Initialize

Ask the engineer for:
1. Bug description or ticket ID (`LT-<n>` / `AI-<n>` / `EP-<n>` — see glossary.md)
2. Error logs or stack trace, if available
3. Coder mode: `auto` (agent writes the fix) or `engineer` (agent stops at fix plan, you write it)

Initialize state:
```bash
"${CLAUDE_PLUGIN_ROOT}/bin/devkit-state.sh" init bugfix <ticket-id> --coder <mode>
```

## Step 2 — Diagnose

Run `/diagnose` on the bug. It will produce `.devkit/diagnose.md` containing the feedback loop, ranked hypotheses, root cause, and fix plan.

**Wait for `## DIAGNOSE COMPLETE`** before continuing.

If `/diagnose` prints `## DIAGNOSE BLOCKED` (it could not build a Phase 1 feedback loop), stop here. Surface the blockers from the report to the engineer and do not dispatch the coder — fixing without a repro means the fix cannot be verified.

## Step 3 — Coder (sonnet) or Engineer Pause

If `--coder auto`: dispatch the Coder agent with the fix plan from `.devkit/diagnose.md` as input. Coder writes to the files identified in Phase 5 of the report.

If `--coder engineer`: stop here, print the Phase 5 fix plan, and wait for the engineer to apply it manually. Resume on `/bugfix continue`.

## Step 4 — Tester (sonnet)

Dispatch the Tester agent. The regression test is already specified in `.devkit/diagnose.md` Phase 5 — Tester writes it at the seam identified there. If the diagnose report says "no correct seam exists", Tester writes the broadest test it can and notes the architectural gap in `.devkit/test.md`.

Wait for `## TESTS COMPLETE`. Re-run the Phase 1 feedback loop from `.devkit/diagnose.md` against the un-minimised scenario to confirm the original symptom is gone.

## Step 5 — Reviewer (sonnet)

Dispatch the Reviewer agent. Output: `.devkit/review.md` with CRITICAL / HIGH / MEDIUM findings.

Block on CRITICAL. Surface HIGH for engineer decision. MEDIUM is informational.

## Step 6 — Complete

Print a summary: ticket ID, files changed, regression test name, reviewer verdict.

Run the Phase 6 cleanup checklist from `.devkit/diagnose.md` — verify no `[DEBUG-...]` strings leaked into the diff, no throwaway scripts left in the tree.

If the bug touched auth, PII, financial logic, or external API code: suggest `/audit` before opening the MR. If the diagnose report flagged an architectural gap: suggest `/improve-architecture` (planned skill) as a follow-up ticket.

## Out of scope

- Disciplined investigation — `/diagnose` owns Phases 1–5 of the diagnosis loop.
- Writing the MR description and pushing — `/git-workflow` does that.
