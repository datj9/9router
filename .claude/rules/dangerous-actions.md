# Dangerous Actions

Some actions are blocked at the tool layer — don't attempt them, you'll just get an error. If the user genuinely needs one of these, ask them to run it manually in their own terminal.

## Never attempt

### Destructive bash
- `sudo <anything>` — the agent must never escalate privileges
- `rm -rf` on anything outside the allowlist: `/tmp`, `node_modules`, `build`, `dist`, `.next`, `.turbo`, `__pycache__`, `.pytest_cache`, `.ruff_cache`, `.mypy_cache`, `coverage`, `.devkit*`
- `git reset --hard` — discards uncommitted work
- `git clean -f` / `-fd` / `-fdx` — deletes untracked files (often user's in-progress work)
- `git checkout .` or `git restore .` when `git status` is dirty — nukes changes
- `git branch -D <protected>` where protected ∈ {master, main, uat, develop, qc, training}
- `curl ... | sh` / `wget ... | bash` — supply-chain risk

### Credential files
Never use Write or Edit on any of these:
- `.env`, `.env.production`, `.env.prod`, `.env.staging`, `.env.local`, `.env.*` (templates like `.env.example`/`.env.sample`/`.env.template` are allowed)
- `secrets.yml`, `secrets.yaml`, `credentials.json`, `service-account*.json`
- `*.pem`, `*.p12`, `*.pfx`, `*.key`, `id_rsa*`, `id_ed25519*`
- Anything inside `~/.ssh/`, `~/.aws/`, `~/.gnupg/`, `~/.kube/`, `~/.docker/config*`
- `~/.netrc`, `~/.pgpass`, `~/.my.cnf`

If the user asks you to "add an env var", edit `.env.example` (the template) and ask them to mirror the change in their local `.env`.

### Direct pushes / force pushes
- `git push` to master/main/uat/develop/qc/training (use an MR)
- `git push --force` / `-f` / `--force-with-lease` anywhere

## How to work WITH the guards

- **Want to clean a workspace?** `git stash` or `git stash -u` keeps changes recoverable. Or just commit WIP on a branch.
- **Want to throw away uncommitted changes?** Ask the user — only they should decide.
- **Need to remove a directory outside the allowlist?** Use an explicit `rm` without `-rf` (per-file), or ask the user.
- **Pre-push tests failing?** Fix the tests. If the user needs to push WIP, they can run `DEVKIT_PREPUSH_SKIP=1 git push ...` themselves.
- **Need to install a one-off script?** Download first (`curl -o /tmp/x.sh ...`), show the user the contents, and let them run it.

## If a block is wrong

Hooks are conservative by design. If you hit a false positive:

1. Tell the user what you were trying to do and what got blocked.
2. Suggest the safest path forward (e.g. "I'll commit my WIP instead, then we can discuss").
3. Do NOT try to find a workaround that defeats the guard (e.g. `echo $'\x67'it push…`). That's a security smell.
