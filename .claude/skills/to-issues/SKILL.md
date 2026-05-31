---
name: to-issues
description: Breaks an EP- PRD or feature plan into independently-grabbable LT- / AI- / DO- tickets using vertical (tracer-bullet) slices that each cut through every layer (schema, API, UI, tests). Each slice is marked HITL (needs human decision) or AFK (agent-completable). Output is a structured markdown list at .devkit/issues.md ready to paste into the Ringkas issue tracker. Use when user says "break this into tickets", "split into LT-tickets", "carve up this EP", "decompose into vertical slices", "what tickets do I need", or hands off a finalized PRD that needs implementation tickets.
version: 1.0.0
author: Ringkas Engineering
---

# To Issues

Decompose a plan, PRD, or design into vertical-slice tickets that engineers can grab independently. Each ticket cuts through ALL layers — schema, API, UI, tests — not horizontally across one layer.

Use glossary.md for ticket prefixes (EP- / LT- / AI- / DO-) and codebase names (saturn / jupiter / regulus / alcor / phobos / ai-backoffice).

## Process

### 1. Gather context

Work from whatever is in the conversation. Three common entry points:

- **Notion EP- URL or ID** — fetch via Notion MCP (`notion-search`, `notion-fetch`) and read user stories + ACs end-to-end.
- **`.devkit/plan.md`** from `/feature` — already structured.
- **`.devkit/grill-result.md`** from `/grill-me` — best input; ambiguity already resolved.

If the user passes nothing, ask which of the three they have. Don't guess.

### 2. Skim the codebase

Identify every layer the work touches. Use Grep / Read to confirm the layer inventory:

- DB schema — regulus migrations, ai-backoffice tables
- API surface — DRF views, saturn handlers, phobos `en_*` tools, GraphQL schema
- Client — jupiter components, `@ui/*` wrappers, country variants (`index.sa.tsx`)
- Tests — Jest co-located, pytest alongside module, Testmo cases (linked separately)

### 3. Draft vertical slices

Each slice = one ticket. Rules:

- **One slice cuts every layer it needs end-to-end.** Not "ticket A: schema, ticket B: API, ticket C: UI" — that's horizontal and produces unmergeable half-features. Instead: "ticket A: minimal schema + minimal endpoint + minimal UI + smoke test for ONE user story end-to-end."
- **One slice is demoable on its own.** A reviewer should look at the merged MR and see something work.
- **Many thin slices > few thick ones.** Aim for slices a single engineer finishes in 1–3 days.
- **Tag each slice HITL or AFK.** HITL = needs a human decision (architecture choice, UX review, security signoff, banking partner integration). AFK = an agent or unsupervised engineer can implement to completion. Prefer AFK; surface HITL only when genuine.
- **Honour ticket-prefix conventions.** Engineering work → `LT-`, AI team work → `AI-`, devops work → `DO-`. The parent stays `EP-`. Ringkas does not nest EP- under EP-.

### 4. Quiz the user

Present the proposed breakdown as a numbered list. For each slice show:

- **Proposed title**: `[<LT|AI|DO>] <short summary>` — engineer assigns the real number when filing
- **Codebase(s)**: saturn / jupiter / regulus / etc.
- **Type**: HITL / AFK + one-line reason
- **Blocked by**: which slice numbers in this list (or "none")
- **User stories covered**: which ACs from the source PRD this addresses

Ask:
- Does the granularity feel right (too coarse / too fine)?
- Are dependencies correct?
- Should any slices merge or split?
- Are HITL / AFK tags accurate?

Iterate until the user approves.

### 5. Output the ticket list

Write `.devkit/issues.md` per [TICKET-TEMPLATE.md](TICKET-TEMPLATE.md) — one paste-ready section per approved slice, in dependency order (blockers first).

Print `## ISSUES READY` followed by a count and the artifact path. Do **not** auto-create tickets in the tracker — Ringkas engineers create their own tickets to keep ownership clear. The artifact is the handoff.

## Out of scope

- Filing tickets in Jira / Linear / GitLab. The engineer does this.
- Writing the implementation. `/feature` or `/bugfix` consume the resulting `.devkit/issues.md` per slice.
- Resolving ambiguity in the PRD. If you find yourself guessing what an AC means, stop and run `/grill-me` first.
