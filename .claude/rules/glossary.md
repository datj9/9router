# Ringkas Glossary

The exact words to use when writing code, commits, MRs, PRDs, audits, reviews, and any other artifact for Ringkas. Substitutes are forbidden — they create drift across docs, confuse new engineers, and make grep useless.

## Canonical terms

| Use | Don't use | Notes |
|---|---|---|
| **MR** (merge request) | PR, pull request, Pull Request, Merge Request | We use GitLab. The acronym `MR` is the noun in prose ("open an MR", "this MR adds…"). Capitalize only at sentence start. |
| **master** | main | Default branch name across ~95% of Ringkas repos. The 5% on `main` are the exception — name them explicitly when you mean them. |
| **qc**, **uat**, **training**, **prod** | staging, production, stg, qa, test (env), live | These four are the only Ringkas environments. There is no "staging". `prod` is the word — don't expand to "production". |
| **Beli** | BeLi, beli, Polaris, polaris | Umbrella product name. Always written `Beli` in prose. The repo URL `polaris/beli` is a path artifact, not the brand. |
| **saturn**, **jupiter**, **regulus**, **alcor**, **phobos**, **ai-backoffice** | Saturn, Jupiter, etc. | Codebase names match their directory names — lowercase. Capitalize only at sentence start. |
| **engineer** | developer, dev, programmer | Internal role term. |
| **MCP** | Model Context Protocol (in prose), tool server | Acronym only — don't expand inline. |
| **MR description** | PR body, summary, change log | The freeform text on a merge request. |

## Ticket prefixes

Every Ringkas ticket has a typed prefix. Branch names, commit messages, MR titles, and prose all use these forms exactly.

| Prefix | Domain | Example |
|---|---|---|
| `EP-<n>` | PRD / product epic | `EP-754` |
| `LT-<n>` | Engineering: tasks, bugs, sub-tasks, user stories | `LT-8451` |
| `AI-<n>` | AI team tasks | `AI-269` |
| `DO-<n>` | DevOps tasks | `DO-152` |

Forbidden invented prefixes: `R-`, `RNG-`, `RING-`, `TASK-`, `BUG-`, `STORY-`, `ENG-`, `INT-`, plus any lowercase variant.

Branch examples: `feat/EP-754`, `fix/LT-8451`, `chore/DO-152`, `feat/AI-269`.

Commit examples: `feat(auth): EP-754 add JWT refresh endpoint`, `fix(loan): LT-8451 handle null bank code`.

MR title examples: `[EP-754] platform foundation auth bootstrap`, `[LT-8451] null bank code crash`.

## Auth & user terminology

| Use | Don't use |
|---|---|
| **authentication** (the act of proving identity) | "auth" when you mean authentication specifically |
| **authorization** (the act of granting access) | "auth" when you mean authorization specifically |
| **JWT** | jwt, Jwt, JSON Web Token (in prose) |
| **SSO** | sso, single sign-on (in prose) |
| **access platform** (Saturn's enum of which app a user can enter) | accessPlatform (when prose), platform-access |

`auth` is fine as a code identifier (`auth/`, `authMiddleware`, `useAuth()`) — don't use it in prose where the distinction between authentication and authorization matters.

## Workflow / role terminology

| Use | Don't use |
|---|---|
| **devkit** | tooling, harness (when you mean specifically this repo), the kit |
| **harness** | rules system, configuration | Refers to the `.claude/` directory contents (rules + hooks + agents + skills) loaded into every session. |
| **skill** | command, slash command (when discussing the `.md` file itself) |
| **slash command** | command, invocation | The `/audit`, `/review` etc. that triggers a skill. |
| **hook** | pre-commit, plugin, callback | A script under `.claude/hooks/` fired by Claude Code on a tool event. |
| **rule** | instruction, guide, doc (when discussing files under `.claude/rules/`) |

## When this glossary conflicts with quoted material

Don't rewrite quotes, error messages, log lines, third-party docs, or external content. The glossary governs what *we* write — not what we faithfully reproduce from elsewhere.

## When you spot drift

If you see a doc, comment, commit message, or skill using a non-canonical term, fix it in the same edit if you're already touching the file. Don't open a separate cleanup MR for prose — the next person to touch the file will fix it too. Glossary drift compounds slowly; correcting it opportunistically is enough.
