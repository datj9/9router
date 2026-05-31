# TypeScript Coding Style

> Extends common/rules/coding-style.md for saturn (Node.js) and jupiter (React).

## Type Safety

> Full rule with examples + alternatives table: [type-safety.md](./type-safety.md). The bullets here are the surface-level reminders.

- No `any` types — use `unknown` and narrow, generics, union types, or `Record<string, unknown>`. See type-safety.md for which to pick.
- No `// @ts-ignore` or `as any` escape hatches.
- UPPER_CASE enum values: `enum Status { PENDING = 'PENDING' }`
- Prefer `interface` for object shapes; `type` for unions and aliases.

## Imports (jupiter only)
- NEVER import from `antd` directly — use `@ui/*` wrappers only.
- RTL-safe CSS: use `ms-X`/`me-X` instead of `ml-X`/`mr-X`.
- RTL-safe CSS: use `ps-X`/`pe-X` instead of `pl-X`/`pr-X`.

## Country-Specific Component Pattern (jupiter)
- `index.tsx` — entry point
- `index.base.tsx` — shared base
- `index.sa.tsx` — Saudi Arabia override

## saturn (Node.js)
- Serverless handlers in `serverless/`
- Unit tests in `tests/unitTest/` mirroring src
- Use Yup ValidationError for DTO validation

## Linting
- ESLint with `--max-warnings 0`
- After GraphQL schema changes: run `npm run codegen` in jupiter
