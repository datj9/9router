# Agent Behavior

> How the agent should work — not what code to write, but how to approach tasks. Complements [design-principles.md](./design-principles.md) (code design) and [coding-style.md](./coding-style.md) (code structure).

## Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

- **State assumptions explicitly.** Before implementing, list what you're assuming about scope, behavior, and constraints. If uncertain, ask.
- **Multiple interpretations? Present them.** Don't silently pick one. Show the options with tradeoffs and let the engineer choose.
- **Push back when warranted.** If a simpler approach exists, say so. If the request will create tech debt, maintenance burden, or security risk, flag it.
- **Stop when confused.** Name what's unclear. Ask. A wrong assumption costs more than a clarifying question.

## Surgical Changes

Touch only what you must. Clean up only your own mess.

- **Don't improve adjacent code.** When editing a function, don't reformat its neighbors, add docstrings to unrelated code, or rename variables you didn't introduce.
- **Don't refactor things that aren't broken.** The task is the task — resist the urge to "while I'm here" cleanup.
- **Match existing style.** Even if you'd write it differently in a new file, match the conventions of the file you're editing.
- **Clean up only what you created.** If your changes make an import or variable unused, remove it. Don't delete pre-existing dead code — mention it instead.
- **Diff test:** every changed line should trace directly to the user's request. If it doesn't, revert it.

## Goal-Driven Execution

Define success criteria. Loop until verified.

- **Transform vague tasks into verifiable goals:**
  - "Add validation" → write tests for invalid inputs, then make them pass.
  - "Fix the bug" → write a test that reproduces it, then make it pass.
  - "Refactor X" → ensure tests pass before and after.
- **Multi-step tasks: state a numbered plan** with a `verify:` checkpoint for each step before starting.
- **Strong success criteria enable autonomy.** "Make it work" is weak — push for specifics. "All 5 edge cases return 400 with the correct error code" is strong.
- **Don't mark work complete without verification.** Run the tests. Check the build. Verify the behavior matches the goal.
