# Code Review Process

## Before Opening a PR
Run `/code-review` for automated review. Fix all CRITICAL issues before requesting human review.

## Requirements
- At least 2 reviewers per PR
- At least 1 approval before merge
- All CI checks passing
- Self-tested locally by author

## Author Checklist
- [ ] All logic passes basic and edge cases
- [ ] Self-tested before PR creation
- [ ] Coding conventions followed (see [coding-style.md](./coding-style.md), [meaningful-names.md](./meaningful-names.md))
- [ ] No secrets or sensitive data in code
- [ ] Tests written (TDD followed)
- [ ] Coverage >= 80%

## Reviewer Checklist
- [ ] Edge cases and error paths checked
- [ ] Coding conventions verified — including [meaningful-names.md](./meaningful-names.md): no `tmp`/`val`/`data`/`x` etc., booleans prefixed with `is`/`has`/`should`, collections plural
- [ ] Security concerns checked
- [ ] Test coverage confirmed

## Labels
Set exactly one: feat, fix, bugfix, test, chore, docs, devops, release
