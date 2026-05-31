# Knowledge Base Guide

## Purpose

The Knowledge Base in Notion stores decisions, constraints, and patterns that both product and engineering should reference when creating PRDs or implementation plans.

## Recommended Knowledge Base Categories

### Architecture Decisions
- System design choices and their rationale
- Technology selections (why Django for backoffice, why LangGraph for agents, etc.)
- Integration patterns (how saturn talks to phobos, how jupiter talks to saturn)

### Technical Constraints
- Performance limits (API rate limits, DB query limits)
- Security requirements (auth flows, data handling)
- Infrastructure boundaries (what can/cannot be deployed where)

### Product Patterns
- Established UX patterns (how country switching works, how error states are shown)
- Business rules (loan calculation formulas, eligibility criteria)
- Regulatory requirements per country

### Past Decisions
- Features that were considered but rejected (and why)
- Migration histories
- Incident post-mortems that affect future design

## How Product Team Should Use This

Before writing a PRD:
1. Search for related topics in Knowledge Base
2. Check if similar features were built or rejected before
3. Reference relevant constraints in the PRD
4. Link to Knowledge Base pages from the PRD

## How Engineering Should Contribute

After implementing a feature:
1. Document any non-obvious decisions made during implementation
2. Record technical constraints discovered
3. Update architecture docs if system boundaries changed
4. Add integration patterns that product should know about

Use the `prd-to-implementation` skill's progress tracking to capture these learnings.
