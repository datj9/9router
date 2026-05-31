# Skill Authoring

How to write a Ringkas skill so it's discoverable, composable, and stays under maintenance pressure.

## Anatomy

```
skills/<skill-name>/
├── SKILL.md              # required — the workflow, ≤100 lines
├── EXAMPLES.md           # optional — long-form examples
├── REPORT-FORMAT.md      # optional — output schema (for skills that produce reports)
├── CHECKLIST.md          # optional — itemized checks (for review/audit-style skills)
└── scripts/              # optional — only for *deterministic* steps (file generation, etc.)
```

- Directory name = skill name = filename slug used by the slash command.
- File is **`SKILL.md`** (uppercase, exact name) — the loader matches on it.
- Sibling reference files use **ALL-CAPS conventional names**: `LANGUAGE.md`, `EXAMPLES.md`, `REPORT-FORMAT.md`, `CHECKLIST.md`, `OUT-OF-SCOPE.md`. Lowercase descriptive names are also fine for skill-specific files (`gitlab-access.md`).

## Frontmatter

```yaml
---
name: skill-name
description: <one sentence what it does>. Use when <comma-separated list of trigger phrases the user might say>.
version: 2.0.0
author: Ringkas Engineering
---
```

Required fields:
- **name** — must equal the directory name
- **description** — *see "Description format" below*
- **version** — semver. Bump major when you break the slash command's input/output contract; minor for new behavior; patch for fixes
- **author** — `Ringkas Engineering` for shared skills; `Ringkas Engineering / <team>` for team-scoped (e.g. AI, DevOps)

Optional:
- **disable-model-invocation: true** — set on skills that should ONLY run via slash command and never auto-trigger from a description match. Use this for destructive or high-cost workflows (`/audit`, `/feature`).

## Description format

The description is what makes a skill discoverable. It must let the model decide "is this skill the right tool for what the user just asked?" without reading the body.

**Shape (mandatory)**:

> *First sentence: what it does, in third person.*
> *Second sentence: "Use when [phrase], [phrase], [phrase]."*

Trigger phrases are literal things the user might say or types of work they might describe. List 3–8.

Max **1024 chars**. Aim for ≤300.

**Good**:

> Runs an ISO 27001 security audit (controls A.9, A.10, A.12.4, A.14.2) and scans dependencies for CVEs against the project's package manager. Use when the user says "audit this", "security check", "ISO 27001", "scan for vulnerabilities", or before merging to master/uat.

**Bad** (your old description — too short, no triggers):

> ISO 27001 security audit + dependency CVE scan

The model can't infer "the user said 'is this safe to ship'" maps to this skill from the bad version.

## Body

Write the skill body for an agent that lands cold and has to execute. Conventions:

- **Lead with the workflow.** First section is the steps, in order. Numbered if linear, bulleted if branching.
- **Glossary if the skill introduces terms.** Either inline at the top, or a separate `LANGUAGE.md` file the SKILL.md links to.
- **Out-of-scope section if confusion is likely.** "This skill does X, not Y. For Y see /other-skill."
- **Compose by reference.** If your workflow's step 3 is "now do a code review", say *"Run `/review` on the changes."* Don't inline the entire review process — it'll drift from `/review`'s own SKILL.md.
- **No example output blocks longer than ~30 lines in SKILL.md.** Move them to `EXAMPLES.md`.

## Length budget

- **SKILL.md ≤ 100 lines.** Past that, split into reference files.
- Each reference file should answer one question. `REPORT-FORMAT.md` answers "what does the output look like". `CHECKLIST.md` answers "what specifically gets checked". Don't dump everything into a single `DETAIL.md`.
- If a skill has more than 5 sibling files, it's two skills pretending to be one — split.

## Composing skills

Skills can and should call other skills mid-flow:

```markdown
## Step 3 — Review

Run `/review` on the diff. If it returns CRITICAL or HIGH issues, fix them
before continuing to step 4.
```

This keeps each skill focused and ensures behavior stays in sync. If `/review` evolves, every skill that composes it inherits the change.

Don't compose by copying the other skill's body inline. That's drift waiting to happen.

## Naming

- **Skill name** = lowercase kebab-case, ≤3 words: `audit`, `git-workflow`, `prd-authoring`. Avoid `do-`, `run-`, `check-` prefixes — the slash itself implies action.
- **Slash command** = same as skill name: `/audit`, `/git-workflow`.
- **Reference files** = ALL-CAPS for conventional ones (`EXAMPLES.md`), lowercase descriptive for skill-specific (`gitlab-access.md`).

## Terminology

Use [glossary.md](./glossary.md) terms exactly. Especially:

- `MR` not "PR" or "pull request"
- `master` not "main" (default branch in Ringkas)
- `qc` / `uat` / `training` / `prod` for environments — no "staging"
- Ticket prefixes: `EP-` (PRD) / `LT-` (eng) / `AI-` (AI) / `DO-` (devops)

## Adding a new skill

1. Create `skills/<name>/SKILL.md` with the frontmatter shape above.
2. Add the skill to `harness/common/CLAUDE.md` under "Available Skills".
3. Add the skill to `README.md` (the table at top + a usage example section).
4. Test: open Claude Code and run `/<name>`. Then describe the task in natural language without typing the slash — confirm the skill auto-invokes from your trigger phrases.
5. Commit: `git commit -m "feat(skills): LT-<id> add /<name> skill"`.

## When to deprecate a skill

If two skills overlap >50% in body, merge them. If a skill hasn't been invoked in a quarter and has no clear use case, delete it. Stale skills are worse than missing skills — they show up in skill listings and dilute the agent's matching.

## Anti-patterns

- **Slash-command-only skills with no trigger phrases.** Discoverable only by typing `/<name>` exactly. Add triggers.
- **Frontmatter copied from another skill without updating `name`.** The loader will silently misroute.
- **SKILL.md body ≥200 lines.** It's not a skill anymore, it's a tutorial. Split.
- **Inlining another skill's logic instead of `/calling` it.** Drift is guaranteed.
- **Vague descriptions like "Helps with X".** Description is the matching surface — be specific.
- **Skipping the version bump on a behavior change.** Devkit updates rely on version comparisons during install.
