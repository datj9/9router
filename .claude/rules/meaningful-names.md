# Meaningful Names

All generated code uses descriptive, self-documenting names. A reader unfamiliar with the surrounding code should be able to tell what a variable represents from its name alone.

> See also: [coding-style.md](./coding-style.md) for general structure rules, [glossary.md](./glossary.md) for Ringkas-specific terms (use `customer`, `loan`, `bank` etc. consistently).

## Rules

### Length & clarity
- **≥ 3 characters** for variable, parameter, and function names — except for the conventions listed below.
- Name what the variable **represents**, not its type. `users` not `arr`. `config` not `obj`.

### Forbidden patterns
- **Single letters** outside the explicit exception list: `a`, `b`, `c`, `n`, `m` etc.
- **Meaningless placeholders**: `tmp`, `temp`, `val`, `var`, `obj`, `data`, `info`, `foo`, `bar`, `baz`.
- **Type-only names** as identifiers: `str`, `num`, `arr`, `list`, `dict`, `map`.
- **Numbered placeholders**: `var1`, `var2`, `value1`, `item1` — unless they actually represent an indexed sequence.
- **Cryptic abbreviations**: `usr`, `pwd`, `cfg`, `mgr`, `hdlr`, `req`, `resp`, `ctx` (when not the React/Go context idiom). Spell them out: `user`, `password`, `config`, `manager`, `handler`, `request`, `response`.

### Allowed short names
Short names are fine in these specific contexts:

| Context | Allowed | Notes |
|---|---|---|
| Tight numeric loop indices | `i`, `j`, `k` | Use descriptive names for nested loops or non-trivial bodies |
| Mathematical formulas | `x`, `y`, `r`, `theta` etc. | Only when notation mirrors the formula and a comment makes intent clear |
| Trivial lambdas / arrows | `users.map(u => u.name)` | Acceptable; `users.map(user => user.name)` preferred |
| Catch parameters | `e`, `err`, `error` | Standard idiom |
| Intentionally unused | `_` | Standard idiom |
| Identifiers | `id`, `userId`, `loanId` | Standard idiom |
| Go context, React context | `ctx` | Idiomatic |

### Naming guidance
- **Variables / properties**: nouns. `userCount`, `activeConnections`, `requestPayload`.
- **Functions / methods**: verbs. `calculateTotal`, `validateInput`, `fetchUserProfile`.
- **Booleans**: prefix with `is`, `has`, `should`, `can`, `was`. `isActive`, `hasPermission`, `shouldRetry`.
- **Collections**: plural. `users`, `errorMessages`, `pendingRequests`.
- **Casing**: match the language. `camelCase` for JS/TS, `snake_case` for Python, `PascalCase` for types/classes.
- **Specific over generic**: `customerEmail` over `email` when context allows ambiguity. `retryCount` over `count`.

## Examples

❌ Bad:
```typescript
function calc(a: number, b: number, t: number) {
  const r = a * b;
  const d = r * t;
  return d;
}

const u = users.filter(x => x.s === 1);
const tmp = data.map(d => d.v);
```

✅ Good:
```typescript
function calculateDiscountedTotal(price: number, quantity: number, taxRate: number) {
  const subtotal = price * quantity;
  const totalWithTax = subtotal * taxRate;
  return totalWithTax;
}

const activeUsers = users.filter(user => user.status === 1);
const itemValues = data.map(item => item.value);
```

❌ Bad:
```python
def proc(d, n):
    res = []
    for i in d:
        if i > n:
            res.append(i)
    return res
```

✅ Good:
```python
def filter_values_above_threshold(values, threshold):
    filtered_values = []
    for value in values:
        if value > threshold:
            filtered_values.append(value)
    return filtered_values
```

## Enforcement

When generating, refactoring, or reviewing code:
1. Before finalizing any code, scan all variable, parameter, and function names.
2. Replace any name that violates this rule with a descriptive alternative.
3. If a short name is genuinely necessary (per "Allowed short names" above), the surrounding context must make its meaning unambiguous.
4. When in doubt, err on the side of more descriptive — verbosity is preferred over ambiguity.

This rule applies to **all generated code**: features, fixes, tests, scripts, hooks. The `/review` skill should flag violations as MEDIUM (HIGH if the bad name is in a public API).
