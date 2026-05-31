# Ticket Template

`.devkit/issues.md` is one paste-ready ticket per section, in dependency order. The engineer copies each section into Jira / Linear / GitLab and replaces `<assigned by tracker>` with the real ticket number once filed.

## Per-ticket section

```markdown
---

## [LT|AI|DO] <short title>

**Parent:** EP-<n>  (Notion link if available)
**Codebase(s):** saturn / jupiter / regulus / alcor / phobos / ai-backoffice
**Type:** HITL | AFK
**Blocked by:** LT-<n>, LT-<n>  (or "none — can start immediately")
**Estimate:** 1–3 days

### What to build

Concise description of this vertical slice. Describe end-to-end behaviour for ONE user story, not layer-by-layer implementation.

### User stories covered

- US-<n>: As a <actor>, I want <feature>, so that <benefit>.
- US-<n>: ...

### Acceptance criteria

- [ ] Criterion 1 (testable — Jest / pytest / Testmo case identifier if known)
- [ ] Criterion 2
- [ ] Criterion 3

### Layers touched

- **Schema:** `regulus/migrations/00XX_<name>.py` — adds column / table / index ...
- **API:** `<codebase>/<path>` — new endpoint / mutation / `en_*` tool ...
- **Client:** `<codebase>/<path>` — new component / form / page ...
- **Tests:** unit + integration + (Testmo case if user-facing)

Omit a layer if this slice does not touch it.

### Out of scope for this ticket

- Anything that belongs in a different slice — name the slice it belongs to.

### Notes for reviewer

- Cross-codebase contract changes (REST / GraphQL / MCP signature): yes / no
- Auth / PII surface: which ISO 27001 control applies (A.9 / A.10 / A.12.4 / A.14.2)
- Country variants: jupiter `index.sa.tsx` needed? yes / no
- Feature-flagged: yes (`<flag-name>`) / no
```

## Header for the file

Start `.devkit/issues.md` with this header so a reader knows what they're looking at:

```markdown
# Ticket Breakdown: EP-<n>

**Source:** <Notion URL | .devkit/plan.md | .devkit/grill-result.md>
**Generated:** <YYYY-MM-DD>
**Total slices:** <n> (HITL: <a>, AFK: <b>)
**Suggested order:** by `Blocked by` chain, blockers first

> Each section below is a paste-ready ticket body. Replace `<assigned by tracker>` references with the real ticket numbers as you file them.
```
