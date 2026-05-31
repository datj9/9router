---
name: diagnose
description: Disciplined six-phase debugging loop (build feedback loop → reproduce → hypothesise → instrument → fix + regression test → cleanup) for hard bugs and performance regressions. Output is a written root-cause report at .devkit/diagnose.md that /bugfix can consume to drive the actual fix. Use when the user says "diagnose this", "debug this", "what's causing this", "why is this slow", "this is flaky", reports a regression, pastes a stack trace / error log, or describes a bug that resists guess-and-check.
version: 1.0.0
author: Ringkas Engineering
---

# Diagnose

A discipline for hard bugs. Skip phases only when explicitly justified — and write the justification into `.devkit/diagnose.md`.

Before starting: read glossary.md for the canonical names of services (saturn / jupiter / regulus / alcor / phobos / ai-backoffice), environments (qc / uat / training / prod), and ticket prefixes (EP- / LT- / AI- / DO-) you will cite in the report.

## Phase 1 — Build a feedback loop

**This is the skill.** A fast, deterministic, agent-runnable pass/fail signal makes the bug 90% solved. Without one, no amount of code-staring helps.

Try, in roughly this order:

1. **Failing test** at the deepest seam that reaches the bug — `jest` for saturn / jupiter, `pytest` for regulus / alcor / phobos / ai-backoffice.
2. **HTTP repro** — `curl` against a local dev server, or against the actual `qc` / `uat` env if it reproduces only there.
3. **CLI fixture** — feed a captured payload through a single function, diff stdout against a known-good snapshot.
4. **Headless browser** — Playwright drives jupiter, asserts on DOM / console / network.
5. **Replay a captured trace** — save a real network request, payload, or event log to disk; replay it through the code path in isolation.
6. **Throwaway harness** — minimal subset of the system (one service, mocked deps) that hits the bug code path with one function call.
7. **Property / fuzz loop** — for "sometimes wrong output", run 1000 random inputs and watch for the failure mode.
8. **Bisection harness** — bug appeared between two known states (commit, dataset, version) → automate "boot, check, repeat" so `git bisect run` can drive it.
9. **Differential loop** — same input through old vs new (or two configs); diff outputs.
10. **HITL loop** — last resort. If a human must click, drive *them* with [scripts/hitl-loop.template.sh](scripts/hitl-loop.template.sh) so captured output still feeds back to you.

### Iterate the loop itself

Once you have *a* loop, sharpen it: faster (cache setup, narrow the test scope), sharper signal (assert on the specific symptom — not "didn't crash"), more deterministic (pin time, seed RNG, isolate filesystem, freeze network). A 2-second deterministic loop is a debugging superpower; a 30-second flaky loop barely beats no loop.

### Non-deterministic bugs

Aim for higher reproduction rate, not necessarily a clean repro. Loop the trigger 100×, parallelise, add stress, narrow timing windows, inject sleeps. 50% flake = debuggable; 1% = not — keep raising until it is.

### When you cannot build a loop

Stop. Write `.devkit/diagnose.md` listing what you tried and ask the user for: (a) access to an env that reproduces, (b) a captured artifact (HAR, log dump, screen recording with timestamps), or (c) permission to add temporary `qc` instrumentation. Do **not** hypothesise without a loop.

## Phase 2 — Reproduce

Run the loop. Confirm:

- [ ] It produces the failure mode the **user** described — not a different failure that happens to be nearby. Wrong bug = wrong fix.
- [ ] It reproduces across multiple runs (or, for flaky bugs, at a high enough rate to debug against).
- [ ] You captured the exact symptom (error message, wrong output, slow timing) so Phase 6 can verify the fix.

## Phase 3 — Hypothesise

Generate **3–5 ranked, falsifiable hypotheses** before testing any. Single-hypothesis generation anchors on the first plausible idea.

> Format: "If <X> is the cause, then <changing Y> will make the bug disappear / <changing Z> will make it worse."

If you cannot state a prediction, the hypothesis is a vibe — sharpen or discard.

Show the ranked list to the user before instrumenting — they often re-rank instantly with domain knowledge ("we just deployed a change to #3", "we already ruled out #1 in LT-7821"). Cheap checkpoint, big time saver. Don't block on it; proceed with your ranking if AFK.

## Phase 4 — Instrument

Each probe maps to one specific prediction from Phase 3. **Change one variable at a time.**

- Prefer **debugger / REPL** > targeted logs > "log everything and grep" (never).
- **Tag every debug log** with a unique prefix: `[DEBUG-a4f2]`. Cleanup is one grep — untagged logs survive, tagged logs die.
- **Performance bugs:** logs lie. Establish a baseline (timing harness, `performance.now()`, profiler, `EXPLAIN ANALYZE` for regulus DB queries), then bisect. Measure first, fix second.

## Phase 5 — Fix + regression test

Write the regression test **before the fix** — but only if a **correct seam** exists.

A correct seam exercises the real bug pattern as it occurs at the call site. If the only available seam is too shallow (single-caller test for a multi-caller bug, unit test that can't replicate the call chain), a regression test there gives false confidence. **If no correct seam exists, that itself is the finding** — note it in `.devkit/diagnose.md` and flag for `/improve-architecture` (planned skill).

If a correct seam exists:
1. Turn the minimised repro into a failing test at that seam — saturn: `tests/unitTest/<mirror>/`; jupiter: co-located `*.test.tsx`; Python: alongside the module.
2. Watch it fail.
3. Apply the fix.
4. Watch it pass.
5. Re-run the Phase 1 loop against the **un-minimised** scenario.

## Phase 6 — Cleanup + handoff

Required before declaring done:

- [ ] Original repro no longer reproduces (re-run Phase 1 loop).
- [ ] Regression test passes (or absence of seam is documented).
- [ ] All `[DEBUG-...]` instrumentation removed (`grep -r` the prefix to verify).
- [ ] Throwaway prototypes / scripts deleted (or moved under `.devkit/` with a clear name).
- [ ] The hypothesis that turned out correct is recorded in `.devkit/diagnose.md` and the eventual commit message — so the next debugger learns.

Write `.devkit/diagnose.md` per [REPORT-FORMAT.md](REPORT-FORMAT.md). Print `## DIAGNOSE COMPLETE` when written. If the user is running `/bugfix`, control returns there with the diagnosis as input.

## Out of scope

- Applying the fix beyond the regression test — `/bugfix` orchestrates that with the coder / tester / reviewer agents.
- Architectural refactor that would prevent the bug class — recommend `/improve-architecture` (future skill).
