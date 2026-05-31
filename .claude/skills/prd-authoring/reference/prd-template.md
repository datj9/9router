# Ringkas PRD Templates

These are the exact templates used in the Product Backlog. Reference when authoring Epics.

---

## Standard PRD Format

Used for: CRM, Consumer Platform, API Product, Embedded Service, Website, LOSv2 features.

```
Figma Link: {link or "to be added by Design team"}
Related Documents Link:
1. {page link}
2. {external link}

## Background
{Problem statement. Who is affected. Why now. Use Before/After comparison table if helpful.}

## Goal
{One sentence.}

## Success Metric
1. {Measurable outcome}
2. {Measurable outcome}

## User Stories

| Code   | Title  | As a…  | I want to… | so that… | Priority |
|--------|--------|--------|------------|----------|----------|
| US_01  | {title}| {actor}| {action}   | {benefit}| P0/P1/P2 |

### [US_01] {Title} [toggle]

| Pre-conditions | {numbered list} |
|----------------|----------------|
| Main flow      | {numbered list} |
| Post-conditions| {numbered list} |

**Acceptance Criteria**:
1. {Specific, testable condition}
2. {Specific, testable condition}

## Impact Analysis

| Impacted Feature | Cause             | Mitigation           |
|-----------------|-------------------|----------------------|
| {feature name}  | Because of {reason}| The {X} need to {Y} |

> Checklist [dropdown]
> CRM: [list of CRM features with Impacted? column]
> CA: [list of CA features with Impacted? column]

## Risk Assessment

| Risk Description | Likelihood | Impact | Severity | Owner | Mitigating Action |
|-----------------|-----------|--------|----------|-------|------------------|
| {description}   | Low/Med/High | Low/Med/High | Low/Med/Severe | {person/team} | {action} |

## Squad

| Role              | Name |
|-------------------|------|
| Product Manager   |      |
| Product Designer  |      |
| Copywriter        |      |
| Engineer          |      |
| Engineer          |      |
| Engineer          |      |
| Quality Assurance |      |

## Approval Sheet

| Approved by | On |
|------------|-----|
| Alvin      |     |
```

---

## AI PRD Format

Used for: AI Agent platform features (RISA, chatbot behavior, agent configuration, MCP tools, conversation flows).

```
Figma Link: {link or "to be added"}
Thread Link: {Slack thread or discussion link}
Related Documents Link:
1. {link}

## Background
{Problem statement — focus on what currently requires an engineering ticket that the AI change will fix.}

## Goal
- {Primary objective}

## Success Metric
- {Measurable outcome}

## User Stories

| Code | Title | When a user [want/behavior] | AI should [respond to meet expectation] | so that… | Priority |
|------|-------|-----------------------------|-----------------------------------------|----------|----------|
|      |       | [want / behavior]           | [respond to meet expectation]           | [user achieves goal] |  |

### [US_01] {Title} [toggle]

- Pre-conditions:
- Type of change (delete irrelevant types):

  > Data Storage [toggle]
    PM Fill-in Table:
    | Data Point | Action AI Can Take | Trigger Example (User Says) | Expected AI Outcome / Response |
    |-----------|-------------------|----------------------------|-------------------------------|
    | {field}   | Read/Write/Update | {user utterance in ID/EN}  | {AI response/behavior}        |

    Data Specification:
    | Data Point | Source / Source of Truth | Mutability | Notes |
    |-----------|------------------------|-----------|-------|

    Error Handling & Edge Cases:
    | Error Type / Condition | Trigger | AI Behavior / Response | Escalation Rule |
    |----------------------|---------|----------------------|----------------|

  > Actions [toggle]
    | Action AI Can Take | Trigger Example (User Says) | Expected AI Outcome / Response |
    |-------------------|----------------------------|-------------------------------|

    Error Handling & Edge Cases:
    | Error Type / Condition | Trigger | AI Behavior / Response | Escalation Rule |

  > Training Data [toggle]
  > Conversation Flow [toggle]
  > System Integration [toggle]

- Other key requirements:

## Impact Analysis
{Same as Standard PRD}

## Risk Assessment
{Same as Standard PRD}

## Squad
{Same as Standard PRD}

## Approval Sheet
{Same as Standard PRD}
```

---

## Database Properties Reference

| Property | Type | Valid Values |
|----------|------|--------------|
| Epic Name | Title | — |
| Short Summary | Text | One-liner, max ~150 chars |
| Status | Status | Not Started → Requirement in Progress → Blocked → Requirement Finalized → In Development → Stakeholder Testing → Ready for Released → Released / Cancelled |
| Complexity | Select | High, Medium, Low |
| Platform | Multi-select | API Product, AI Agent, Embedded Service, Consumer Platform, LOSv2 - Phase 1, CRM, Website |
| Strategic Goal | Multi-select | RISA-NXT, OJK, Australia Project, Saudi Project |
| Product PIC | Person | — |
| Feature Reviewer | Person | — |
| Sponsor | Person | — |
| Assigned To | Person | — |
| Rank # | Text | Priority rank within sprint |
| Dev Month | Select | April, May, June, July, August, Drop, AI |
| Dev & Release Month | Select | July-24 … January-25 |
| Sprint Week | Multi-select | w3Sept24, w1Oct24, w3Oct24, w5Oct24, w1Nov24, w2Nov24, w4Nov24 |
| Release Estimation | Date | — |
| Revenue Impact ($/mo) | Number | — |
| Impact analysis | Select | y, n |
| TRD | Relation | → TRD database |
| 🤹 Tasks | Relation | → Tasks database |
| Sub-item / Parent item | Relation | → self (hierarchy) |
| ID | Auto-increment | EP-XXX |
