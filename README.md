# better.gg

A modern tournament companion for [start.gg](https://start.gg). Search for any player, browse their tournament history, and dive into bracket analysis with projected matchups, head-to-head records, and character usage data.

Built for the competitive Smash community.

## Features

- **Player search** &mdash; Find players by tag with fuzzy search powered by a pre-crawled dataset
- **Tournament history** &mdash; View a player's upcoming, active, and past tournaments at a glance
- **Bracket visualization** &mdash; Interactive bracket trees for single and double elimination events
- **Projected matchups** &mdash; For unseeded brackets, see who you're likely to face based on seeding
- **Head-to-head stats** &mdash; Win rates, set counts, and historical results against each opponent
- **Character data** &mdash; Track character usage across sets with automatic role classification (main, co-main, secondary)

## Quick Start

```sh
# Install dependencies
npm install

# Add your start.gg API token
echo "VITE_START_GG_TOKEN=your_token_here" > .env

# Start dev server
npm run dev
```

Get a token at [start.gg/admin/profile/developer](https://start.gg/admin/profile/developer).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Type-check + production build |
| `npm run lint` | Run ESLint |
| `npm run codegen` | Generate GraphQL types from `schema.graphql` |
| `npm run crawl` | Incremental crawl of start.gg player data |

### Crawl Script

The crawl script builds a local player database for search. It's **incremental** &mdash; each run picks up where the last one left off.

```sh
npm run crawl                        # Incremental, up to 50 pages
npm run crawl -- 5                   # Limit to 5 pages
npm run crawl -- --all               # Full historical crawl
npm run crawl -- --fresh             # Ignore saved state, start over
npm run crawl -- --watch             # Daemon mode (runs every 30 min)
npm run crawl -- --watch 60          # Daemon mode with custom interval
```

State is persisted in `public/data/crawl-state.json`. For higher throughput, set multiple API keys:

```sh
# .env
START_GG_CRAWL_TOKENS=key1,key2,key3
```

## Tech Stack

| Layer | Tool |
|-------|------|
| Framework | React 19 |
| Language | TypeScript 5.9 (strict) |
| Build | Vite 7 |
| Routing | TanStack Router (file-based) |
| Data Fetching | TanStack Query + graphql-request |
| Type Generation | GraphQL Codegen (client-preset) |
| Styling | CSS Modules |

## Project Structure

```
src/
  routes/           File-based routes (auto-generates routeTree.gen.ts)
  hooks/            React Query hooks, one per GraphQL query
  components/       UI components, each with a .module.css file
  lib/              Pure utilities (formatting, stats, bracket math)
  gql/              Auto-generated GraphQL types (do not edit)
scripts/
  crawl-players.ts  Player data crawler with incremental state
```

## License

MIT
