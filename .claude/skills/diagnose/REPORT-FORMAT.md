# Diagnose Report Format

Written to `.devkit/diagnose.md` at the end of Phase 6 (or earlier if abandoning at Phase 1). `/bugfix` reads this file and uses it to drive the coder / tester / reviewer agents.

## Template

```markdown
## Diagnosis: <one-line summary>

**Ticket:** EP-<n> / LT-<n> / AI-<n> / DO-<n>  (or "ad-hoc" if no ticket yet)
**Date:** YYYY-MM-DD
**Codebase:** saturn / jupiter / regulus / alcor / phobos / ai-backoffice
**Environment reproduced:** local / qc / uat / training / prod
**Severity:** CRITICAL / HIGH / MEDIUM / LOW

### Phase 1 — Feedback loop
What kind of loop, where it lives, how to run it, how long one iteration takes.

```bash
# exact command to run the loop
pnpm test path/to/repro.test.ts
```

### Phase 2 — Reproduction
- **Symptom captured:** <exact error message / wrong output / timing measurement>
- **Reproduction rate:** 100% / N% over M runs
- **Confirmed user-described failure:** yes / no — <how confirmed>

### Phase 3 — Hypotheses (ranked, after investigation)
1. ✅ <correct hypothesis> — prediction confirmed by <evidence>
2. ❌ <hypothesis> — ruled out by <evidence>
3. ❌ <hypothesis> — ruled out by <evidence>

### Phase 4 — Root cause
<2–4 sentences. Explain WHY, not just WHAT. Reference `path/to/file.ts:42`.>

### Phase 5 — Fix
- **File(s):** `path/to/file.ts:42`
- **Change:** <one-line description of the minimal fix>
- **Regression test:** `path/to/file.test.ts` — `<test name>`
  (or: "no correct seam exists — see Architectural note below")

### Phase 6 — Verification
- [x] Phase 1 loop now passes
- [x] Regression test passes
- [x] No `[DEBUG-...]` strings in working tree (`grep -r '\[DEBUG-' . --exclude-dir=node_modules --exclude-dir=.git`)
- [x] No throwaway prototypes left in tree

### Architectural note (only if applicable)
<Where the codebase architecture made this bug hard to reproduce / lock down.
Hand off to /improve-architecture (planned skill) with these specifics:
- Module that lacks a testable seam
- Why a regression test at the natural seam would give false confidence
- Suggested deepening opportunity>
```

## When to write a partial report

If you abandon at **Phase 1** (cannot build a loop), write a stub with:

- The list of loop strategies you tried and why each failed.
- The specific access / artifact / instrumentation permission you need from the user.
- Empty "Phase 2–6" sections so `/bugfix` knows the diagnosis is incomplete.

Print `## DIAGNOSE BLOCKED` (not `COMPLETE`) so `/bugfix` does not proceed to dispatch the coder.
