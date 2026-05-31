# Coding Style

> Naming rules live in [meaningful-names.md](./meaningful-names.md). Design principles (SOLID, KISS, YAGNI, DRY) live in [design-principles.md](./design-principles.md). This file covers structure: immutability, file size, error handling.

## Immutability (CRITICAL)
Always create new objects, never mutate existing ones.
Wrong: modify an object field in place.
Correct: return a new copy with the changed field.

## File Organization
- 200-400 lines typical, 800 max
- Organize by feature/domain, not by technical type (not /models, /views)

## Error Handling
- Handle errors explicitly at every level
- Never silently swallow errors — at minimum log them
- UI code: user-friendly messages
- Server code: detailed context in logs

## Input Validation
- Validate all user input at system boundaries
- Schema-based: Yup for TypeScript, Pydantic for Python
- Fail fast with clear error messages

## Code Quality Checklist
- [ ] Functions < 50 lines
- [ ] Files < 800 lines
- [ ] No deep nesting (> 4 levels)
- [ ] Every error handled explicitly
- [ ] No hardcoded values — use constants or config
- [ ] No mutation of existing objects
