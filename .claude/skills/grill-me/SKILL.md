---
name: grill-me
description: Interrogates the user's plan, design, or PRD draft one question at a time, with a recommended answer per question, until ambiguity collapses and the design tree is fully resolved. Surfaces glossary drift, missing acceptance criteria, hidden trade-offs, unclear ownership, and unhandled edge cases before any code is written. Output is a consolidated plan at .devkit/grill-result.md that /feature and /bugfix can consume. Use when user says "grill me", "challenge this plan", "stress-test my design", "is this PRD ready", "what am I missing", "poke holes", or shares a feature description that feels under-specified.
version: 1.0.0
author: Ringkas Engineering
---

# Grill Me

Interview the user relentlessly about the plan in front of you until you reach shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one at a time.

## Method

Ask **one question at a time.** Wait for the user's answer before asking the next.

For each question, **provide your recommended answer** with a one-sentence rationale. The user can accept, override, or refine. Recommendations make the conversation move; bare questions waste the user's time.

If a question can be answered by exploring the codebase, **explore instead of asking** (use Grep / Read). Then state what you found and ask the user only to confirm interpretation.

## What to grill

Walk these axes in order — each one is a wedge that flushes out a different class of ambiguity:

1. **Glossary drift.** Does the user use any term in a way that conflicts with glossary.md? ("You said 'PR' — Ringkas uses MR. Confirm?", "You said 'staging' — Ringkas has qc / uat / training / prod, no staging. Which one?", "You said 'auth' — authentication or authorization? They differ in this conversation.")
2. **Scope of the slice.** Where does the work end? One MR, or three? Which codebase(s) — saturn, jupiter, regulus, alcor, phobos, ai-backoffice? Touching cross-codebase contracts (REST / MCP / GraphQL)?
3. **User stories & acceptance criteria.** For each user-visible behaviour, what is the testable acceptance criterion? Push until each AC could be turned into a Jest / pytest / Testmo case without further interpretation.
4. **Edge cases & failure modes.** What happens when input is missing, malformed, or the downstream service is down? Which failures retry, which surface to the user, which page on-call?
5. **Auth & PII.** Who can call this? What PII flows through it? Which ISO 27001 control covers it (A.9 access, A.10 crypto, A.12.4 logging, A.14.2 secure dev)? Will `/audit` need to run before merge?
6. **Backwards compatibility.** Does this change a public API contract (DRF serializer, GraphQL schema, MCP `en_*` tool signature, Pydantic model at a trust boundary)? If yes, what is the migration story for existing callers?
7. **Country variants (jupiter only).** If touching `index.tsx` / `index.base.tsx` / `index.sa.tsx`, does this need a Saudi Arabia override? RTL-safe CSS (`ms-X` / `me-X` not `ml-X` / `mr-X`)?
8. **Rollout & feature flag.** Does this ship behind a flag? Who flips it? What is the rollback path if `qc` looks bad?
9. **Done definition.** What artifact proves it shipped? Merged MR, deployed to qc, signed-off by QA in Testmo, demoed to product?

Skip an axis only if the answer is genuinely obvious from the conversation, and **state which axes you skipped and why** — so the user can call you out if you were wrong.

## When to stop

You are done when the user could hand the resulting plan to a different engineer and that engineer would not need to ask follow-up questions. Test this silently: summarise the plan as if you were that other engineer. If you have a question, you are not done.

## Output

When done, write `.devkit/grill-result.md` with: scope, user stories, ACs, edge cases, auth & PII, rollout, done definition. `/feature` and `/bugfix` can consume this file as their planning input — pass it explicitly when invoking them.

Print `## GRILL COMPLETE` with the path to the artifact.

## Out of scope

- Implementing the plan. Once the user wants code, hand off to `/feature` (new work) or `/bugfix` (regression).
- Filing tickets. Once the plan is sliced, hand off to `/to-issues` for the LT- / AI- breakdown.
