---
name: zoom-out
description: Maps a Ringkas codebase area at a higher level of abstraction — lists relevant modules, inbound callers, and outbound dependencies in glossary vocabulary so an engineer can build a mental model fast without deep-reading any single file. Use when user says "zoom out", "give me a map of X", "I don't know this code", "explain how X fits in", "where does X get called from", "what depends on this", or starts work in an unfamiliar area of saturn / jupiter / regulus / alcor / phobos / ai-backoffice.
version: 1.0.0
author: Ringkas Engineering
---

# Zoom Out

The user does not know this area of the code. Go up a layer of abstraction and produce a navigable map — not a deep read of any single file.

Use glossary.md terms exactly: `MR` (not PR), codebase names lowercase (saturn, jupiter, regulus, alcor, phobos, ai-backoffice), environments (qc / uat / training / prod), ticket prefixes (EP- / LT- / AI- / DO-).

## Output shape

Produce these four sections, in this order. Skip any section that has no content rather than padding it.

### 1. What this area does (1–3 sentences)
Describe the business capability in glossary vocabulary. Not "the FooHandler class" — name it as it appears in PRDs / ADRs / Notion epics. Tie to a `Beli` product surface where applicable.

### 2. Modules & files
Bulleted list, ≤8 items. Each line: `path/to/file.ts` — one-clause summary of the module's responsibility.

Skip generated code, fixtures, and tests unless the area is *primarily* test infrastructure. Mention but don't expand `index.base.tsx` / `index.sa.tsx` country variants — note their existence, not their internals.

### 3. Inbound callers (who uses this)
Bulleted list of the call sites *outside* this area that depend on it. Use the Grep tool to enumerate. For each: `path/to/caller.ts` — what it calls and why.

If the area is a leaf with no inbound callers, say so explicitly. If the callers are in a *different* Ringkas codebase (saturn → jupiter via REST, regulus → phobos via MCP, ai-backoffice → alcor via HTTP, etc.), name the protocol — those cross-codebase seams are the highest-value items in any zoom-out.

### 4. Outbound dependencies (what this uses)
Bulleted list of external modules / services this area depends on. For each: `<module>` — what it provides.

Cross-codebase outbound calls and external services (Notion API, GitLab API, banking partners, MCP tool servers) belong here. Database tables count when the dependency is direct (raw SQL, ORM `.objects.filter`).

## Rules

- **No file deep-reads.** Skim only. If the user wants line-level detail, they will ask.
- **Glossary first.** If the area uses a term that conflicts with glossary.md ("PR" instead of "MR", "staging" instead of "qc"), call it out as drift in a final note — don't silently propagate it.
- **No suggestions.** This is a map, not a critique. Do not propose refactors. If you spot a deepening opportunity worth raising, recommend `/improve-architecture` (planned skill) in one final line.
- **Stop when the map is enough.** A good zoom-out is ~30 lines of output. If you are approaching 100, you are reading too deep — re-scope to the user's actual question.

## Composition

When the user is starting `/feature` or `/bugfix` in an unfamiliar area, run `/zoom-out` first and pass the output as planning context. The fix or feature plan will be grounded in the actual call graph, not assumed structure.
