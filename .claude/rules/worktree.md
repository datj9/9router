# Worktree Hygiene

When creating or entering a git worktree for this project, copy the project-level
`.claude/` contents — **excluding** the `worktrees/` subdirectory — into the
worktree before starting work.

```bash
rsync -a --exclude='worktrees/' .claude/ <worktree-path>/.claude/
```

This keeps the repo-specific harness (rules, hooks, skills, agents, settings)
available inside isolated worktrees so behavior stays consistent with the main
checkout, without copying nested worktree directories back in.

## When to run

- Immediately after `git worktree add <path> <branch>`
- The first time you `cd` into a worktree that doesn't yet have `.claude/`
- After installing or upgrading the devkit in the main checkout — re-sync each
  active worktree so they pick up the new rules/hooks

## What this gives you

- Hooks (branch/commit validation, pre-push tests, secret scan) fire inside the
  worktree the same way they fire in the main checkout
- Skills and slash commands resolve correctly
- `devkit-plan.json` (statusline budgets, ticket-format config) is shared

## Don't

- Don't symlink `.claude/` — Claude Code resolves hook paths relative to
  `$CLAUDE_PROJECT_DIR` and some hooks write logs under `.claude/.devkit/`,
  which you want isolated per worktree.
- Don't include `worktrees/` in the copy — that recurses worktree state back
  into worktrees.
