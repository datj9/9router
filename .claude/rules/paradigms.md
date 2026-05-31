# Programming Paradigms

> Complements [design-principles.md](./design-principles.md) (SOLID, KISS, YAGNI, DRY) and [coding-style.md](./coding-style.md) (immutability, structure). This file guides when to use which paradigm.

## Default: functional-first, OOP when it earns its place

Most code is data transformation — input in, output out. Start with functions
and plain data structures. Reach for classes only when you have genuine state
and behavior that belong together.

## When to use functional patterns

| Signal | Pattern |
|---|---|
| Transform data from shape A to shape B | Pure function, `map`/`filter`/`reduce` |
| Combine multiple operations on data | Function composition / pipelines |
| Utility or helper logic | Standalone pure functions |
| Stateless request handling | Functions that take input, return output |
| Configuration or options | Plain objects/dicts, not builder classes |
| Testing is hard because of hidden state | Refactor toward pure functions with explicit inputs |

### Functional checklist
- **Pure functions**: same input → same output, no side effects.
- **Immutable data**: never mutate inputs; return new copies (see [coding-style.md](./coding-style.md)).
- **Explicit dependencies**: pass everything a function needs as arguments — no reaching into globals or singletons.
- **Avoid shared mutable state**: if two functions need the same data, pass it explicitly to both.

## When to use OOP patterns

| Signal | Pattern |
|---|---|
| Entity with identity, lifecycle, and rules | Class with encapsulated state |
| Multiple implementations of the same contract | Interface + concrete classes |
| Resource that must be opened/closed | Class with lifecycle methods |
| Complex domain model with invariants | Domain objects that enforce their own rules |
| Framework requires it | Inherit/implement what the framework demands, no more |

### OOP checklist
- **Composition over inheritance**: default to injecting collaborators, not extending base classes. Inherit only when there's a true "is-a" relationship.
- **Shallow hierarchies**: max 2 levels of inheritance. If you need a third, refactor to composition.
- **No god classes**: a class with 10+ public methods or 500+ lines is doing too much — split by responsibility.
- **Encapsulate state**: expose behavior (methods), not raw data (public fields). If callers just read/write fields, you don't need a class — use a plain data structure.

## When to use neither — just write simple procedural code

Not everything needs a pattern. A 20-line script, a one-off migration, a
simple CLI tool — just write sequential code with clear variable names. Don't
wrap it in classes or chain it through functional combinators for style points.

## Mixed paradigm is normal

Real codebases mix paradigms. The goal is consistency within a module:

- A module that transforms data should be functional throughout — don't sneak
  in a class that mutates shared state.
- A module that manages domain entities should use classes consistently — don't
  scatter free functions that reach into object internals.
- At the boundary between modules, prefer plain data (objects/dicts/DTOs) over
  passing class instances — this keeps modules loosely coupled.

## Anti-patterns to watch for

| Smell | Problem | Fix |
|---|---|---|
| Class with only static methods | It's just a namespace, not OOP | Use a module with exported functions |
| Function that reads/writes `this` or `self` extensively | Hidden state disguised as functional | Make it a method on a class, or make the state explicit |
| Factory that creates one type | Unnecessary indirection | Direct construction / function call |
| Inheritance used for code reuse only (no polymorphism) | Coupling without benefit | Extract shared logic into a function or mixin |
| Functional chain longer than 5 steps | Unreadable pipeline | Break into named intermediate variables or smaller functions |
| Abstract class with one implementation | Premature abstraction | Delete the abstract, use the concrete directly (YAGNI) |
