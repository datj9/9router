# TypeScript Testing

> Extends common/rules/testing.md for saturn and jupiter.

## Framework
- Jest for unit and integration tests
- React Testing Library for component tests in jupiter (not Enzyme)

## Test File Location
- saturn: `tests/unitTest/<mirror-src>/<filename>.test.ts`
- jupiter: co-located `<component>.test.tsx` or `__tests__/` directory

## Patterns

```typescript
// Unit test
describe('calculateInterestRate', () => {
  it('returns correct rate for standard loan', () => {
    const result = calculateInterestRate({ principal: 100_000, rate: 0.05, years: 10 })
    expect(result).toBe(50_000)
  })

  it('throws ValidationError when principal is negative', () => {
    expect(() => calculateInterestRate({ principal: -1, rate: 0.05, years: 10 }))
      .toThrow(ValidationError)
  })
})

// Component test (jupiter)
import { render, screen, fireEvent } from '@testing-library/react'

it('shows error when email is empty on submit', () => {
  render(<LoginForm />)
  fireEvent.click(screen.getByRole('button', { name: /submit/i }))
  expect(screen.getByText(/email is required/i)).toBeInTheDocument()
})
```

## Coverage
```bash
jest --coverage
# Minimum: 80% lines, functions, branches
```
