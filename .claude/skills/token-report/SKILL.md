---
name: token-report
description: Print a per-repository Claude token-usage table covering 5h, 7d, 30d, and all-time windows for every registered company project directory. Use when the user says "where are my tokens going", "token spend by project", "/token-report", "which repo is burning tokens", "Claude usage breakdown", or before a budget review.
version: 1.0.0
author: Ringkas Engineering
---

# Token Report (per-repo usage)

Shows how many Claude tokens each registered company project has burned across 5h, 7d, 30d, and all-time windows. Source data is the local Claude Code and CCS transcript stores.

## How it works

The skill wraps `harness/common/bin/devkit-projects.py report`, which:
1. Loads the registry at `~/.claude/devkit-projects.json`.
2. Scans every `*.jsonl` transcript under `~/.claude/projects/`, `~/.ccs/shared/context-groups/*/projects/`, and any path in `DEVKIT_TRANSCRIPT_PATHS`.
3. Attributes each usage entry to a project via the rule in `references/2026-05-07-per-repo-token-tracking-design.md`.
4. Sums tokens per project per window and prints a sorted table.

## Workflow

1. Resolve the devkit install path: in a project that ran `install.sh`, the script is at `.claude/bin/devkit-projects.py`. Otherwise use the source: `~/ringkas-devkit/harness/common/bin/devkit-projects.py`.

2. Run the report:

   ```bash
   ./.claude/bin/devkit-projects.py report
   ```

3. If the output starts with `Note: no project paths registered`, prompt the user to register their projects parent dir, e.g.:

   ```bash
   ./.claude/bin/devkit-projects.py register --parent ~/Documents/Projects/Ringkas
   ```

4. Inline the table output as a fenced code block in the chat. Do not paraphrase numbers.

## Subcommands the user might also want

- `register --parent <path>` — add a parent dir (subdirs become projects).
- `register --path <path>` — add an explicit project path.
- `list` — show registered parents and paths.
- `remove <path>` — remove a registered entry.
- `report --sort-by 5h|7d|30d|all` — change sort column (default 7d desc).
- `report --json` — machine-readable output.
- `report --no-cache` — bypass the 10-second cache.

## Out of scope

- USD cost (tokens only).
- Cross-machine aggregation.
- Real-time budget enforcement (the statusline already covers global budgets).
