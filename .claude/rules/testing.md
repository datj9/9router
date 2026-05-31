# Testing Requirements

## Minimum Coverage: 80%
Measured on lines, functions, and branches.

## Test Types (all required)
1. Unit tests — pure functions, no I/O
2. Integration tests — API endpoints, database operations
3. E2E tests — critical user flows (happy path per User Story minimum)

## TDD Workflow (mandatory)
1. Write the failing test (RED)
2. Run the test — verify it fails
3. Write minimal code to pass (GREEN)
4. Run the test — verify it passes
5. Refactor and re-run
6. Check coverage >= 80%

## Test Design
- Test behavior, not implementation details
- Each test covers exactly one scenario
- Tests are independent — no shared mutable state
- Names: `test_<action>_<condition>_<expected_result>`
- Always assert the specific value
- Cover: happy path, empty/null, error state, boundary values, unauthorized access
