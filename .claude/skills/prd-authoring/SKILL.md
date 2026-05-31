---
name: prd-authoring
description: Helps the product team create structured Epics in the Ringkas Product Backlog on Notion using the correct PRD Format or AI PRD template, fills in every required section, and searches past Epics to reuse context and avoid duplication. Use when the user says "write a PRD", "draft an epic", "new EP-...", "product spec", "I need a PRD for X", or shares a feature idea that needs formal documentation.
version: 1.1.0
author: Ringkas Engineering
tools:
  - Notion MCP (notion-search, notion-fetch, notion-create-pages, notion-update-page)
---

# PRD Authoring Assistant

Help Ringkas PMs write structured, implementation-ready Epics in the Product Backlog.

> **Language rule**: All PRD content written to Notion **must be in English** — Background, Goal, Success Metric, User Stories, Acceptance Criteria, Impact Analysis, Risk Assessment. The only exception is **Trigger Examples** in AI PRDs, which should reflect the actual language end-users speak (e.g. Bahasa Indonesia for ID users, Arabic for SA users), as these are sample user utterances, not documentation.

## Prerequisites

Notion MCP must be connected:
```bash
claude mcp add notion --url https://mcp.notion.com/mcp
claude mcp login notion
```

Product Backlog database: `https://www.notion.so/ringkas/3f6ac86135fd48d0925299a9e202b776`
Data source: `collection://cc477810-e934-412f-b99b-16f4029fba6c`

---

## Step 1 — Determine PRD Type

**Ask the user:** Is this feature primarily for an AI agent (RISA, chatbot behavior, conversation flow)?

- **Yes → AI PRD** (use the AI PRD template with Data Storage / Actions / Conversation Flow sections)
- **No → Standard PRD** (use the PRD Format template)

---

## Step 2 — Research Existing Context

Before writing, search the Product Backlog for related past Epics:

1. `notion-search` with 2–3 keyword variations related to the feature area
2. Fetch the 2–3 most relevant results with `notion-fetch`
3. Summarize to the user:
   - Related past Epics (ID, title, status, link)
   - Relevant acceptance criteria that can be reused
   - Past Impact Analysis entries that may apply
   - Any Epics that were "Cancelled" or "Dropped" for similar scope (avoid repeating)

---

## Step 3 — Gather Requirements

Ask targeted questions to fill all required sections. Do not proceed to writing until all **required** questions are answered.

**Always required:**
1. What is the feature? (one sentence)
2. What problem does it solve? Who is affected? (for Background)
3. What is the goal? (one sentence for Goal section)
4. What does success look like? How do we measure it? (for Success Metric)
5. Which platforms are affected? (API Product / AI Agent / Consumer Platform / CRM / Embedded Service / LOSv2 / Website)
6. What is the complexity? (High / Medium / Low)
7. What strategic goal does this serve? (RISA-NXT / OJK / Saudi Project / Australia Project / none)
8. Is there a Figma link? (for Figma Link at top)
9. Are there related documents? (for Related Documents Link)

**For each User Story:**
10. Who is the actor ("As a…"): customer / admin / partner / agent / system
11. What do they want to do ("I want to…")
12. Why / benefit ("so that…")
13. Priority: P0 / P1 / P2
14. Pre-conditions, main flow, post-conditions
15. Acceptance criteria (specific, testable)

**For AI PRDs only, per user story:**
16. Which types of change apply? (Data Storage / Actions / Conversation Flow / System Integration / Training Data)
17. For Data Storage: what data points, what actions AI can take (Read/Write/Update), trigger examples (in the end-user's language as sample data only — e.g. Bahasa Indonesia for ID users, Arabic for SA users), expected AI outcomes written in English, source of truth, mutability rules, error handling
18. For Actions: what actions, trigger examples, expected AI responses, error handling
19. For Conversation Flow: expected conversation paths

**For Impact Analysis:**
20. Which existing features are affected? Check the standard CRM checklist:
    - CRM User Self Register, Join Workgroup, CRU Workgroup, CRU CRM User, CRU Roles & Permission
    - Admin Assist Customer Registration, Prequalification Form, KPR Form
    - Bank Submission Form, Bank Decision, Contract Signing, Invoicing, Disbursement
21. For each impacted feature: cause ("Because of...") and mitigation ("The ... need to...")

**For Risk Assessment:**
22. Any known risks? For each: likelihood (Low/Medium/High), impact (Low/Medium/High), severity, owner, mitigating action

**For Squad:**
23. PM name, Designer name, Copywriter, Engineer names, QA name

---

## Step 4 — Write the Epic

Create the Epic in Notion using `notion-create-pages` in database `collection://cc477810-e934-412f-b99b-16f4029fba6c`.

### Page Properties

| Property | Value |
|----------|-------|
| `Epic Name` | Feature title |
| `Short Summary` | One-liner (max 150 chars) |
| `Status` | `Requirement in Progress` |
| `Platform` | Multi-select from: API Product, AI Agent, Consumer Platform, CRM, Embedded Service, LOSv2 - Phase 1, Website |
| `Complexity` | High / Medium / Low |
| `Strategic Goal` | Multi-select from: RISA-NXT, OJK, Saudi Project, Australia Project |
| `Product PIC` | PM person |
| `Feature Reviewer` | Reviewer person |
| `Release Estimation` | Target date |

### Standard PRD Page Content

Follow this exact structure (sections as H2, user story details as H3 toggles):

```
Figma Link: {link or "to be added by Design team"}
Related Documents Link:
{numbered list of related doc links}

## Background
{The problem, who is affected, why now. Use comparison table if Before/After is helpful.}

## Goal
{One sentence: what the feature achieves.}

## Success Metric
{Numbered list of measurable outcomes with targets.}

## User Stories
{Table with columns: Code | Title | As a… | I want to… | so that… | Priority}

### [US_01] {Title} {toggle}
  {Pre-conditions | Main flow | Post-conditions — two-column table}

  **Acceptance Criteria**:
  {Numbered list of specific, testable criteria}

### [US_02] {Title} {toggle}
  ...

## Impact Analysis
{Table: Impacted Feature | Cause | Mitigation}
{Checklist dropdown with CRM and CA feature lists}

## Risk Assessment
{Table: Risk Description | Likelihood | Impact | Severity | Owner | Mitigating Action}

## Squad
{Table: Role | Name — roles: Product Manager, Product Designer, Copywriter, Engineer ×3, Quality Assurance}

## Approval Sheet
{Table: Approved by | On — first row: "Alvin" with empty date}
```

### AI PRD Page Content

Same structure but User Stories table uses different columns:

```
Code | Title | When a user [want/behavior] | AI should [respond to meet expectation] | so that… | Priority
```

And each `[US_XX]` toggle contains:
```
- Pre-conditions:
- Type of change (delete irrelevant type):

  > Data Storage {toggle}
    PM Fill-in Table: Data Point | Action AI Can Take | Trigger Example (User Says) | Expected AI Outcome / Response
    Data Specification: Data Point | Source / Source of Truth | Mutability | Notes
    Error Handling & Edge Cases: Error Type | Trigger | AI Behavior | Escalation Rule

  > Actions {toggle}
    PM Fill-in Table: Action AI Can Take | Trigger Example | Expected AI Outcome / Response
    Error Handling & Edge Cases: Error Type | Trigger | AI Behavior | Escalation Rule

  > Training Data {toggle}
  > Conversation Flow {toggle}
  > System Integration {toggle}

- Other key requirements:
```

---

## Step 5 — Quality Check Before Saving

Before calling `notion-create-pages`, verify:

- [ ] `Short Summary` is filled (max 150 chars, no jargon)
- [ ] Each User Story has at least one testable Acceptance Criterion
- [ ] Impact Analysis references real existing features (not generic)
- [ ] Risk Assessment has at least one entry if Complexity is Medium or High
- [ ] Squad table has at least PM and one Engineer filled in
- [ ] For AI PRDs: each US has at least Data Storage or Actions section filled
- [ ] No section is empty — at minimum write "N/A" with a reason

---

## Output Format

```
## Epic Created: {epic_id} — {title}
**Type**: Standard PRD / AI PRD
**Status**: Requirement in Progress
**Platform**: [values]
**Complexity**: [value]
**User Stories**: N (US_01 … US_0N)
**Notion link**: {url}
**Open questions**: {list any items flagged for engineering input}
```
