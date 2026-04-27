# better.gg

React app for viewing/analyzing start.gg tournament data. See `memory/startgg-api.md` for API reference.

## Tech Stack

- **React 19** + **TypeScript 5.9** + **Vite 7**
- **Routing**: `@tanstack/react-router` (file-based, auto-generated `src/routeTree.gen.ts`)
- **Data fetching**: `@tanstack/react-query` + `graphql-request` + `graphql`
- **Type generation**: `@graphql-codegen/cli` with `client-preset`
- **Styling**: CSS modules (dark theme, no Tailwind)

## TypeScript Constraints

- `verbatimModuleSyntax: true` — use `import type` for type-only imports
- `erasableSyntaxOnly: true` — no `enum`, no `namespace`, no parameter properties
- Codegen config must set `useTypeImports: true` and `enumsAsTypes: true`
- `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`

## Commands

```sh
npm run dev            # Dev server
npm run build          # Type-check + build
npm run lint           # ESLint
npm run codegen        # Regenerate types (after query changes)
npm run crawl          # Incremental crawl (see scripts/crawl-players.ts for flags)
npx tsc --noEmit       # Type-check only
```

## Environment Variables

- `VITE_START_GG_TOKEN` — API bearer token (fallback when no user logged in)
- `START_GG_CRAWL_TOKENS` — comma-separated tokens for crawl script (round-robin)
- `VITE_START_GG_CLIENT_ID` — OAuth client ID (browser)
- `START_GG_CLIENT_SECRET` — OAuth client secret (server-side only)

## Architecture Patterns

### GraphQL Queries

Queries co-located in hooks via `graphql()` tagged template from codegen. Run `npm run codegen` after adding/changing any query. Pattern:

```ts
const myQuery = graphql(`query MyQuery($id: ID!) { event(id: $id) { id name } }`)
export function useMyQuery(id: string) {
  return useQuery({
    queryKey: ['myQuery', id],
    queryFn: () => graphqlClient.request(myQuery, { id }),
  })
}
```

### CSS Modules

Every component has a `.module.css` file. CSS custom properties from `index.css`:
`--bg-primary`, `--bg-card`, `--bg-elevated`, `--border-subtle`, `--text-primary`, `--text-secondary`, `--accent`, `--accent-hover`, `--success`, `--error`

### Routing

File-based routing with `@tanstack/react-router`. View state stored in URL search params via `validateSearch` + `useNavigate` (not `useState`), so filters/tabs survive navigation and are shareable.

### Auth

OAuth via `src/lib/auth.ts` (plain TS store + `useSyncExternalStore`). GraphQL client reads token per-request, falling back to `VITE_START_GG_TOKEN`. Token exchange proxied through `src/server/auth-proxy.ts` (Vite dev middleware).

### Virtualization

Large lists use `@tanstack/react-virtual`. Virtualized scroll containers use `useElementScrollRestoration` with `data-scroll-restoration-id`.
