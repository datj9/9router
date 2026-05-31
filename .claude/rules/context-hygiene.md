# Context Hygiene

Keep each session's context focused on one line of work. Mixed-topic sessions waste the context window, contaminate subagent dispatches with irrelevant background, and increase the chance Claude confuses prior-task state with current-task state.

## When the user sends a new prompt, classify it before responding

**Unrelated** — the new prompt targets a different feature, file area, language, or problem domain than the prior conversation (e.g. finished debugging a Django migration, now asking about frontend styling; finished reviewing a PR, now asking to research a third-party library).

- Do NOT start the new task.
- Respond with a single short recommendation: either **open a new Claude Code tab** (fastest, zero setup) or **run `/clear`** (same session, context wiped).
- If you believe the prior task left important state the user might lose (uncommitted work, open plan), mention that briefly so they can commit/save first.

**Loosely related** — the new prompt is in the same codebase/feature area but shifts focus (e.g. finished implementing endpoint A, now starting endpoint B in the same service; finished fixing one bug, now fixing an adjacent bug in the same module).

- Do NOT start the new task yet.
- Recommend **`/compact`** with a specific focus hint, e.g. `/compact focus on the auth module changes we made, drop the unrelated filesystem exploration`.
- After the user compacts, proceed normally.

**Directly related / continuation** — the new prompt builds on what you just did (e.g. "now add tests for that", "also update the README", "handle the edge case you mentioned").

- Proceed immediately. No recommendation needed.

## Be decisive, don't over-ask

- One recommendation per prompt. Don't list options — pick the one that fits.
- Do NOT recommend `/clear` or `/compact` preemptively on every prompt. Only when the topic has actually shifted.
- If you're uncertain whether a prompt is unrelated or loosely related, default to the less-disruptive option (compact over clear).

## Examples

> User just finished refactoring the `UserService` in Django backend. Next prompt: "Can you help me set up a new Next.js frontend project?"

→ **Unrelated.** Say: *"That's a different project area from the UserService work — recommend opening a new tab for it so this session's Django context doesn't leak into the frontend setup. Your refactor is already committed, so nothing to lose."*

> User just added a `create_order` endpoint. Next prompt: "Now add a `cancel_order` endpoint with the same auth pattern."

→ **Directly related.** Proceed.

> User just debugged a flaky test in the auth module. Next prompt: "While we're here, can you also review the rate-limiter code? It's been acting weird."

→ **Loosely related** (same repo, different subsystem). Say: *"Different subsystem from the auth tests — recommend `/compact focus on the auth flakiness fix, drop unrelated context` before we dig into the rate limiter so the review has a clean slate."*
