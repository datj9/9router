# Design Principles

> Complements [coding-style.md](./coding-style.md) (structure), [meaningful-names.md](./meaningful-names.md) (naming), and [paradigms.md](./paradigms.md) (functional vs OOP). This file covers higher-level design decisions.

## SOLID

### Single Responsibility (SRP)
Every module, class, or function should have one reason to change. If a
description requires "and" — split it.

### Open/Closed (OCP)
Extend behavior through composition or new implementations, not by modifying
existing working code. Prefer strategy patterns and dependency injection over
`if/else` chains that grow with each new case.

### Liskov Substitution (LSP)
Subtypes must be usable wherever their parent type is expected without
surprising behavior. Don't override a method to throw "not supported" — that
breaks callers' assumptions.

### Interface Segregation (ISP)
Don't force consumers to depend on methods they don't use. Prefer small,
focused interfaces over large catch-all ones.

### Dependency Inversion (DIP)
High-level modules should depend on abstractions, not concrete implementations.
Inject dependencies — don't instantiate them deep inside business logic.

## KISS — Keep It Simple

- Choose the simplest solution that solves the actual problem.
- Avoid clever code. If it needs a comment to explain the trick, rewrite it.
- Three similar lines of code is better than a premature abstraction.
- Don't add indirection (helpers, wrappers, factories) until there's a real
  second use case — not a hypothetical one.

## YAGNI — You Aren't Gonna Need It

- Don't build for requirements that don't exist yet.
- No feature flags, config knobs, or extension points "just in case."
- Delete dead code instead of commenting it out. Git has history.
- If a function has a parameter nobody passes, remove it.

## DRY — Don't Repeat Yourself

- Extract shared logic only when duplication is real (3+ occurrences) and the
  duplicated code changes for the same reason.
- Two pieces of code that look the same but evolve independently are NOT
  duplication — don't force them into a shared abstraction.
- Prefer duplication over the wrong abstraction.

## When principles conflict

Principles are guidelines, not laws. When they pull in opposite directions:

| Tension | Resolution |
|---|---|
| DRY vs KISS | Prefer KISS. A little duplication is cheaper than the wrong abstraction. |
| OCP vs YAGNI | Prefer YAGNI. Don't add extension points until a second variant exists. |
| SRP vs KISS | Don't split a 30-line function into 5 classes for "purity." Split when complexity demands it. |
| DIP vs KISS | Inject dependencies at module boundaries and API layers. Internal helpers can instantiate directly. |
