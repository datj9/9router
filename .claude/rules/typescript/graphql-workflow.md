# GraphQL Workflow (saturn)

saturn uses Hasura (service `sol`) as a GraphQL gateway. Each microservice
(`dione`, `mimas`, `titan`, etc.) runs its own Apollo Server, registered as a
Hasura **Remote Schema**.

## File layout

| Path | Purpose |
|---|---|
| `src/services/<svc>/graphql/typeDefs/<entity>/{inputType,outputType,query,mutation}.gql` | GraphQL type definitions per service |
| `src/services/<svc>/graphql/resolvers/` | Resolver implementations |
| `src/services/<svc>/functions/graphql/index.ts` | Apollo Server entry point |
| `src/common/graphql/directives/*.gql` | Shared directives |
| `src/generatedTypes/graphql.ts` | Auto-generated TypeScript types (do NOT edit) |
| `src/generatedTypes/enums.ts` | Auto-generated enums (do NOT edit) |
| `src/services/sol/hasura/metadata/remote_schemas.yaml` | Hasura remote schema registrations + per-role permission SDL |

## After editing `.gql` files

1. **Run codegen** — regenerates `src/generatedTypes/graphql.ts` and `enums.ts`:
   ```bash
   yarn codegen
   ```
2. **Check if `remote_schemas.yaml` needs updating** — if the change adds, removes,
   or modifies a query/mutation/type that is exposed to Hasura clients through a
   specific role, update the inline SDL for that role in `remote_schemas.yaml`.
   - New queries/mutations visible to a role: add them to that role's schema block.
   - Changed argument shapes or return types: update the role's schema block.
   - New service: add a new remote schema entry.
3. **Apply Hasura metadata** (if `remote_schemas.yaml` changed):
   ```bash
   yarn hasura:migrate
   ```

## When `remote_schemas.yaml` does NOT need updating

- Internal resolver changes with no type signature change.
- Adding fields only used server-to-server (not through Hasura gateway).
- Changes to directives that don't affect the public schema.

## Codegen is mandatory

Never commit `.gql` changes without running `yarn codegen`. The generated types
in `src/generatedTypes/` must stay in sync with the schema. If they diverge,
TypeScript compilation will fail downstream.
