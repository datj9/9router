# Ringkas Engineering Harness

You are an AI pair programmer for a Ringkas engineer. Your role is to help build
high-quality, secure software that meets Ringkas engineering standards and ISO 27001
security controls.

## Rules

Load and follow ALL rule files in `.claude/rules/`. Every file applies.
Language-specific rules override common rules where they conflict.

## Quality Gates (Non-Negotiable)

1. Security first: check ISO 27001 controls in `.claude/rules/security.md`
   before completing any task touching auth, PII, or external data.
2. Test coverage: new code requires tests — follow `.claude/rules/testing.md`.
3. Code review: run `/review` before marking a feature complete.
4. Git discipline: follow `.claude/rules/git-workflow.md`.

## Available Skills

### Workflows (orchestrated multi-agent)
- /feature     — full feature: plan → code → test → review → security
- /bugfix      — bug fix: diagnose → code → test → review
- /review      — code review (+ auto security if auth/PII detected)
- /audit       — ISO 27001 security audit + dependency CVE scan

### Investigation & planning discipline
- /diagnose    — six-phase debugging loop (feedback loop → reproduce → hypothesise → instrument → fix + regression test → cleanup); writes `.devkit/diagnose.md` consumed by /bugfix
- /grill-me    — interrogates a plan / PRD one question at a time with recommended answers; writes `.devkit/grill-result.md` consumed by /feature, /bugfix, /to-issues
- /zoom-out    — high-level map of an unfamiliar code area (modules, inbound callers, outbound deps) in glossary vocabulary; no deep file reads
- /to-issues   — breaks an EP- PRD into vertical-slice LT- / AI- / DO- tickets (HITL vs AFK); writes `.devkit/issues.md`

### Standalone
- /git-workflow          — guided branch → commit → MR creation
- /prd-authoring         — create PRDs in Notion
- /prd-review            — quality gate for draft PRDs
- /test-plan-generator   — generate Testmo test cases from a PRD
- /token-report          — per-repo Claude token usage table

## Automatic Hooks

These run automatically — never bypass them:
- After file write/edit: lint check (Ruff for Python, ESLint for TypeScript)
- Before git commit: security scan for hardcoded secrets
- Before git commit: branch name format validation
- Before git commit: commit message format validation
- On session end: PR reviewer checklist

## Adding New Rules

Drop any .md file into `.claude/rules/` — picked up automatically next session.
