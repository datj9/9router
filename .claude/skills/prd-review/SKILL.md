---
name: prd-review
description: Quality gate for a draft PRD on Notion — checks completeness against the PRD Format checklist, testability of acceptance criteria, accuracy of impact analysis, and conflicts with existing Epics, then posts findings as inline Notion comments. Use when the user says "review this PRD", "check my epic", "is this PRD ready", "PRD review", links to a Notion EP-... page, or asks for a sanity check on a draft epic.
version: 1.1.0
author: Ringkas Engineering
tools:
  - Notion MCP (notion-search, notion-fetch, notion-create-comment)
---

# PRD Review

Quality gate for draft Epics before they move to "Requirement Finalized".

> **Language rule**: All review feedback must be written in English.

## Prerequisites

Notion MCP must be connected:
```bash
claude mcp add notion --url https://mcp.notion.com/mcp
claude mcp login notion
```

---

## Step 1 — Fetch the Epic

1. Accept an Epic ID (EP-XXX), title keyword, or Notion URL from the user.
2. Use `notion-search` or `notion-fetch` to load the full page.
3. Confirm the Epic `Status` is `Requirement in Progress` or `Not Started`. If it is already `Requirement Finalized` or beyond, warn the user that review may be late.

---

## Step 2 — Structural Completeness Check

Verify every required section exists and is non-empty:

| Section | Required | Check |
|---------|----------|-------|
| Figma Link | If Platform includes Consumer Platform or CRM | Link present or "to be added" |
| Background | Always | Not empty, explains the problem |
| Goal | Always | One clear sentence |
| Success Metric | Always | At least one measurable metric |
| User Stories table | Always | At least one row with Code, Title, actor, action, benefit, priority |
| Each [US_XX] toggle | Always | Pre-conditions, Main flow, Post-conditions filled |
| Acceptance Criteria per US | Always | At least one per user story |
| Impact Analysis | Always | Table has at least one row OR explicit "No impact" with reason |
| Risk Assessment | If Complexity is Medium or High | At least one risk identified |
| Squad | Always | PM filled, at least one Engineer |
| Approval Sheet | Always | Alvin row present |

**For AI PRDs additionally check:**
| Section | Required | Check |
|---------|----------|-------|
| Thread Link | Yes | Present |
| Data Storage OR Actions | Per US | At least one type of change section filled per user story |
| Trigger Examples | Per Data Storage / Actions | At least one example per data point or action |
| Error Handling table | Per Data Storage / Actions | At least one row |

**Report**: List each section as PASS / MISSING / INCOMPLETE.

---

## Step 3 — Acceptance Criteria Quality

For every Acceptance Criterion in every User Story, check:

1. **Testable**: Can QA write a test case from this? It must specify input → expected output.
   - BAD: "The system should work correctly"
   - GOOD: "When user submits form without email, display error 'Email is required' below the email field"

2. **Edge cases covered**: For each US, check if the following are addressed:
   - Empty state (no data)
   - Error state (API failure, validation failure)
   - Loading state (async operations)
   - Permission denied (unauthorized user)
   - Multi-country behavior (if Platform involves Consumer Platform or CRM — does it specify ID vs SA behavior?)

3. **Specificity**: No vague words like "should be fast", "user-friendly", "seamless". Replace with measurable criteria.

**Report**: List problematic ACs with suggested rewrites.

---

## Step 4 — Cross-Epic Conflict Check

Search for potentially conflicting Epics:

1. `notion-search` for Epics with the same `Platform` value that are `In Development` or `Requirement Finalized`.
2. Check for overlapping scope:
   - Same feature area being modified?
   - Same API endpoints or DB tables affected?
   - Same UI components or pages being changed?
3. If potential conflicts found, list them with Epic ID, title, and what overlaps.

---

## Step 5 — Impact Analysis Validation

For each entry in the Impact Analysis table:

1. Is the "Cause" specific? (not just "Because of this PRD")
2. Is the "Mitigation" actionable? (not just "Need to update")
3. Cross-check against the CRM/CA checklist — are there unchecked features that the User Stories clearly affect?

Flag any missing impact entries.

---

## Step 6 — Generate Review Report

Format the findings as a structured review:

```
## PRD Review: EP-XXX — {title}

### Structural Completeness
- [PASS/FAIL] {section}: {detail}

### Acceptance Criteria Quality
- [US_01] AC #1: {issue and suggested rewrite}
- [US_01] Missing edge case: {which one}

### Cross-Epic Conflicts
- {EP-YYY}: potential overlap in {area}

### Impact Analysis Gaps
- {missing impact entry}

### Summary
- Critical issues: N (must fix before Requirement Finalized)
- Warnings: N (should fix)
- Suggestions: N (nice to have)

### Verdict: APPROVE / REVISE / BLOCK
```

---

## Step 7 — Post to Notion

Use `notion-create-comment` to post the review report directly on the Epic page as a comment. This keeps the feedback visible to the entire team alongside the PRD.
