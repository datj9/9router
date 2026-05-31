# TypeScript Type Safety

> Extends [common/rules/coding-style.md](../../common/rules/coding-style.md) for saturn (Node.js) and jupiter (React). See [common/rules/meaningful-names.md](../../common/rules/meaningful-names.md) for naming.

The point of TypeScript is the compiler catching mistakes you'd otherwise find at runtime. Every `any` is a hole in that net.

## No `any` types

Never use `any` in generated TypeScript code. It defeats static typing and silently breaks every type guarantee downstream.

If the type is genuinely unknown at compile time, use `unknown` and narrow it with a type guard before use. For function parameters and return values, always provide explicit, specific types. For complex or dynamic objects, define proper `interface` or `type` declarations. For reusable utilities, use generic type parameters (`<T>`) instead of `any`. If a third-party library lacks types, create a `.d.ts` declaration file rather than falling back to `any`.

This applies to:
- Variable annotations: `const value: any = ...`
- Function parameters: `function parse(data: any) { ... }`
- Return types: `function fetch(): Promise<any> { ... }`
- Generic constraints: `Array<any>`, `Record<string, any>`, `Map<string, any>`
- Type assertions: `value as any`, `<any>value`
- Implicit any from missing annotations (use `noImplicitAny: true` in `tsconfig.json`)

## Preferred alternatives

| Use | When |
|---|---|
| `unknown` | Type genuinely not known at compile time. Forces narrowing before use. |
| `Record<string, unknown>` | Arbitrary object shape (not a known interface) |
| Generic parameter `<T>` | Reusable function/component where caller decides the type |
| Union types (`string \| number`) | Value is one of several known types |
| Discriminated union (`{ kind: 'a', ... } \| { kind: 'b', ... }`) | Variant types where the shape depends on a tag |
| `never` | Code path that should be unreachable (exhaustive switch defaults) |
| `object` | Any non-primitive (rare; usually you want a more specific shape) |

## Examples

❌ Bad:
```typescript
function parse(data: any): any {
  return data.value;
}

async function fetchUser(id: string): Promise<any> {
  const response = await api.get(`/users/${id}`);
  return response.data;
}

const config: any = JSON.parse(rawConfig);
const handler = (event: any) => { ... };
```

✅ Good:
```typescript
function parse<T extends { value: unknown }>(data: T): T['value'] {
  return data.value;
}

interface User {
  id: string;
  email: string;
  createdAt: Date;
}
async function fetchUser(userId: string): Promise<User> {
  const response = await api.get<User>(`/users/${userId}`);
  return response.data;
}

const config: AppConfig = configSchema.validateSync(JSON.parse(rawConfig));

interface ClickEvent {
  target: HTMLElement;
  timestamp: number;
}
const handler = (event: ClickEvent) => { ... };
```

## Narrowing `unknown`

When you must accept `unknown` (parsing JSON, deserializing form data, third-party callbacks), narrow it with a type guard before reaching for fields:

```typescript
function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value && typeof (value as { id: unknown }).id === 'string' &&
    'email' in value && typeof (value as { email: unknown }).email === 'string'
  );
}

function processInput(payload: unknown) {
  if (!isUser(payload)) {
    throw new ValidationError('Expected User shape');
  }
  // payload is User here
  console.log(payload.email);
}
```

For Ringkas, prefer **Yup** schemas in saturn or **Zod** for new code — they validate AND narrow in one step:

```typescript
import * as yup from 'yup';

const userSchema = yup.object({
  id: yup.string().required(),
  email: yup.string().email().required(),
});

const user = userSchema.validateSync(rawData);  // user is typed as User
```

## Common escape hatches that aren't acceptable

| Pattern | Why it's bad | Fix |
|---|---|---|
| `// @ts-ignore` | Silences the compiler at one site, no type info propagates | Fix the type. If genuinely unfixable, use `// @ts-expect-error` with a comment explaining why |
| `as any` | Pretends the cast is fine | Use `as unknown as T` only after narrowing, or fix upstream type |
| `any[]` | "Just an array of anything" — usually means "I haven't decided" | Use `unknown[]` or define the element type |
| `Record<string, any>` | Any-shaped map | `Record<string, unknown>` and narrow on read, or define the shape |
| `Function` (capital F) | Untyped callable | `(arg: T) => U` — name what it takes and returns |

## Third-party libraries without types

Create a `*.d.ts` file (typically `src/types/<library>.d.ts`):

```typescript
// src/types/some-untyped-lib.d.ts
declare module 'some-untyped-lib' {
  export function doThing(input: string): { result: number };
}
```

Don't write `import x from 'some-untyped-lib' as any` or sprinkle `// @ts-ignore` at every call site.

## Enforcement

When generating, refactoring, or reviewing TypeScript:
1. Before finalizing any code, scan for `any`, `as any`, `// @ts-ignore`, `// @ts-nocheck`.
2. Replace with one of the preferred alternatives above.
3. The `/review` skill flags `any` as **MEDIUM** by default and **HIGH** when it appears in a public API (exported function, route handler, MR'd schema).
4. The reviewer agent enforces this checklist item without exception.

`tsconfig.json` should set `"strict": true` and `"noImplicitAny": true` — ESLint should enable `@typescript-eslint/no-explicit-any` (warning at minimum, error preferred).
