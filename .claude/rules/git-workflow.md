# Git Workflow

## Branch Naming
Format: `<type>/<ticket-id>`
Default valid types: feat, cr, fix, bugfix, test, chore, docs, devops, release, refactor

Default ticket prefixes (see [glossary.md](./glossary.md)):
- `EP-<n>` — PRD / epic
- `LT-<n>` — engineering tasks, bugs, sub-tasks, user stories
- `AI-<n>` — AI team tasks
- `DO-<n>` — devops tasks

Examples: `feat/EP-754`, `fix/LT-8451`, `chore/DO-152`, `feat/AI-269`.
Override branch types, ticket pattern, and examples in `.claude/devkit-plan.json` under `git_workflow`.

Branch from qc:
```
git checkout qc && git pull origin qc
git checkout -b feat/EP-754
```

## Commit Messages
Format: `<type>(scope?): [<ticket-id>] <subject>`
- Present tense, not capitalized, no period, max 72 chars
- One isolated fix/feature per commit
- Ticket ID goes in **square brackets** right after the colon — same shape as the MR title, makes ticket easy to grep and click in GitLab

Examples:
```
feat(auth): [EP-754] add JWT refresh token endpoint
fix(loan): [LT-8451] handle null bank code in submission
fix: [AI-332] add nodejs to docker image for stdio mcp servers
chore: [DO-152] update ruff to 0.4.0
```

When a commit genuinely has no ticket (devkit-internal cleanup, repo bootstrap, dependency-only chore), drop the brackets — don't fabricate one:
```
chore: bump README version
docs: fix typo in glossary
```

Default valid types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
Override commit types, ticket pattern, and examples in `.claude/devkit-plan.json` under `git_workflow`.

## Merge Requests
Title: `[<ticket-id>] <summary>` — example: `[EP-754] platform foundation auth bootstrap`

Requirements:
- At least 2 reviewers assigned
- At least 1 approval before merge
- Owner clicks Merge (not reviewer)
- Label: feat/fix/bugfix/test/chore/docs/devops/release
- Squash commits for features and bug fixes
- Do NOT delete source branch on merge

## Never push directly to protected branches

Protected: `master`, `main`, `uat`, `develop`, `qc`, `training`.

All changes go through an MR from a feature branch. Never run:

- `git push origin master` (or any protected branch name) — use an MR
- `git push --force` / `git push -f` / `git push --force-with-lease` — history rewrites require explicit user consent, not agent action
- `git push origin <feature>:master` — pushing a feature branch onto a protected destination is equivalent to bypassing review

These are blocked at the tool layer by `.claude/hooks/block-protected-push.sh`. If you see the block, open an MR instead — or ask the user to run the push themselves if they have a real emergency reason.
