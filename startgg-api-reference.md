# start.gg GraphQL API Reference

A comprehensive, standalone reference for the [start.gg](https://start.gg) GraphQL API. Compiled from official documentation, schema exploration, and extensive production use. Drop this into any project or LLM context for complete API coverage.

**Official resources:**
- [Developer docs](https://developer.start.gg/docs/intro)
- [Schema reference](https://smashgg-schema.netlify.app/reference/query.doc.html)
- [GraphQL explorer](https://start.gg/explorer)

---

## Table of Contents

1. [Entity Hierarchy](#entity-hierarchy)
2. [Endpoint & Authentication](#endpoint--authentication)
3. [Rate Limits & Object Limits](#rate-limits--object-limits)
4. [Pagination](#pagination)
5. [Root Queries](#root-queries)
6. [Enums](#enums)
7. [Types](#types)
8. [Input Types](#input-types)
9. [Mutations](#mutations)
10. [Query Examples](#query-examples)
11. [Gotchas & Undocumented Behavior](#gotchas--undocumented-behavior)

---

## Entity Hierarchy

```
League/Circuit
  └── Tournament (1-3 days)
        └── Event (a competition, e.g. "Ultimate Singles")
              └── Phase (e.g. "Round 1 Pools", "Top 8")
                    └── PhaseGroup/Pool (e.g. "Pool A1")
                          └── Set/Match
                                └── Game (atom of competition)
```

**People chain:** User (account) → Player (competitive identity) → Participant (tournament registration) → Entrant (event registration)

**Placement chain:** Seed (initial position) → Standing (current/final placement)

**Game data:** Videogame → Character, Stage

---

## Endpoint & Authentication

| Property | Value |
|----------|-------|
| **Endpoint** | `https://api.start.gg/gql/alpha` |
| **Method** | POST (`Content-Type: application/json`) |
| **Auth header** | `Authorization: Bearer <token>` |
| **Request body** | `{ "query": "...", "operationName": "...", "variables": {} }` |
| **Get a token** | https://start.gg/admin/profile/developer (shown once, copy immediately) |

### OAuth (for user-authenticated apps)

| Step | Details |
|------|---------|
| **Authorize** | `https://start.gg/oauth/authorize?response_type=code&client_id=X&scope=...&redirect_uri=...` |
| **Token exchange** | POST `api.start.gg/oauth/access_token` with `{ grant_type: "authorization_code", client_id, client_secret, code, scope, redirect_uri }` |
| **Refresh** | POST `api.start.gg/oauth/refresh` with `{ grant_type: "refresh_token", refresh_token, client_id, client_secret, scope, redirect_uri }` |
| **Token lifetime** | 604800 seconds (7 days) |
| **Scopes** | `user.identity` (currentUser), `user.email`, `tournament.manager` (seeding/setup), `tournament.reporter` (set reporting) |

---

## Rate Limits & Object Limits

- **80 requests per 60 seconds** (~1.3 req/sec)
- **1000 objects max per request** (counts all nested objects in the response)
- Exceeding limits returns: `{ "success": false, "message": "Rate limit exceeded - api-token" }`
- Each response includes `extensions.queryComplexity` for debugging
- Example complexities: simple query ≈ 1, event with phases ≈ 22, sets with games/selections ≈ 79
- **Undocumented 10,000 result pagination cap**: The API silently caps paginated results at ~10,000 total items. Workaround: use `afterDate`/`beforeDate` date windows that each stay under the cap.

---

## Pagination

All connection types use **page-based pagination (1-indexed)**:

```graphql
someConnection(query: { page: 1, perPage: 20 }) {
  pageInfo { total totalPages page perPage }
  nodes { ... }
}
```

- `perPage` max is **512** for most queries
- Some fields (like `event.sets`, `phaseGroup.sets`) take `page`/`perPage` as direct args rather than inside a `query` object

---

## Root Queries

| Query | Args | Returns | Notes |
|-------|------|---------|-------|
| `currentUser` | — | `User` | Requires OAuth with `user.identity` scope |
| `entrant(id)` | `id: ID!` | `Entrant` | |
| `event(id, slug)` | `id: ID, slug: String` | `Event` | Slug: `tournament/<name>/event/<name>` |
| `league(id, slug)` | `id: ID, slug: String` | `League` | |
| `leagues(query)` | `query: LeagueQuery!` | `LeagueConnection` | |
| `participant(id, isAdmin)` | `id: ID!, isAdmin: Boolean` | `Participant` | |
| `phase(id)` | `id: ID` | `Phase` | |
| `phaseGroup(id)` | `id: ID` | `PhaseGroup` | |
| `player(id)` | `id: ID!` | `Player` | |
| `seed(id)` | `id: ID` | `Seed` | |
| `set(id)` | `id: ID!` | `Set` | |
| `shop(id, slug)` | `id: ID, slug: String` | `Shop` | |
| `stream(id)` | `id: ID!` | `Streams` | |
| `streamQueue(tournamentId, includePlayerStreams)` | `tournamentId: ID!` | `[StreamQueue]` | |
| `team(id, slug, inviteCode)` | various | `Team` | |
| `tournament(id, slug)` | `id: ID, slug: String` | `Tournament` | Slug: `tournament/<name>` |
| `tournaments(query)` | `query: TournamentQuery!` | `TournamentConnection` | Supports `sortBy` |
| `user(id, slug)` | `id: ID, slug: String` | `User` | Slug: `user/<discriminator>` |
| `videogame(id, slug)` | `id: ID, slug: String` | `Videogame` | |
| `videogames(query)` | `query: VideogameQuery!` | `VideogameConnection` | Filter by `name` (not `displayName`) |

---

## Enums

### ActivityState

| Value | Description |
|-------|-------------|
| `CREATED` | Created but not started |
| `ACTIVE` | In progress |
| `COMPLETED` | Finished |
| `READY` | Ready to start |
| `INVALID` | Invalid |
| `CALLED` | Called to start (e.g. a set) |
| `QUEUED` | Queued to run |

### BracketType

`SINGLE_ELIMINATION` | `DOUBLE_ELIMINATION` | `ROUND_ROBIN` | `SWISS` | `EXHIBITION` | `CUSTOM_SCHEDULE` | `MATCHMAKING` | `ELIMINATION_ROUNDS` | `RACE` | `CIRCUIT`

### SetSortType

| Value | Description |
|-------|-------------|
| `NONE` | No sorting |
| `CALL_ORDER` | Suggested play order; completed sets reversed |
| `MAGIC` | Sorted by relevancy based on event state/progress |
| `RECENT` | Sorted by start time |
| `STANDARD` | **Deprecated**, equivalent to CALL_ORDER |
| `ROUND` | Sorted by round and identifier |

### GameSelectionType

`CHARACTER` (only value)

### StreamSource

`TWITCH` | `HITBOX` (smashcast.tv) | `STREAMME` | `MIXER` | `YOUTUBE`

### TournamentPaginationSort

`startAt` | `endAt` | `eventRegistrationClosesAt` | `computedUpdatedAt`

---

## Types

### Tournament

| Field | Type | Args | Notes |
|-------|------|------|-------|
| `id` | ID | | |
| `name` | String | | |
| `slug` | String | | e.g. `tournament/genesis-9` |
| `shortSlug` | String | | Short URL |
| `startAt` | Timestamp | | Unix seconds |
| `endAt` | Timestamp | | Unix seconds |
| `createdAt` | Timestamp | | |
| `updatedAt` | Timestamp | | |
| `city` | String | | |
| `addrState` | String | | |
| `countryCode` | String | | |
| `postalCode` | String | | |
| `venueAddress` | String | | |
| `venueName` | String | | |
| `lat` | Float | | Latitude |
| `lng` | Float | | Longitude |
| `timezone` | String | | |
| `mapsPlaceId` | String | | Google Maps |
| `isOnline` | Boolean | | Has at least one online event |
| `hasOfflineEvents` | Boolean | | |
| `hasOnlineEvents` | Boolean | | |
| `isRegistrationOpen` | Boolean | | |
| `numAttendees` | Int | | Includes spectators |
| `currency` | String | | |
| `hashtag` | String | | |
| `state` | Int | | Activity state |
| `tournamentType` | Int | | |
| `rules` | String | | |
| `primaryContact` | String | | |
| `primaryContactType` | String | | |
| `registrationClosesAt` | Timestamp | | |
| `eventRegistrationClosesAt` | Timestamp | | |
| `teamCreationClosesAt` | Timestamp | | |
| `publishing` | JSON | | |
| `url` | String | `tab, relative` | Build URL |
| `owner` | User | | Creator |
| `admins` | [User] | `roles: [String]` | Admin-only |
| `events` | [Event] | `limit: Int, filter: EventFilter` | |
| `participants` | ParticipantConnection | `query: ParticipantPaginationQuery!, isAdmin: Boolean` | |
| `teams` | TeamConnection | `query: TeamPaginationQuery!` | |
| `images` | [Image] | `type: String` | e.g. `"profile"`, `"banner"` |
| `links` | TournamentLinks | | |
| `streams` | [Streams] | | |
| `streamQueue` | [StreamQueue] | | |
| `stations` | StationsConnection | `page, perPage` | |
| `waves` | [Wave] | | |

### Event

| Field | Type | Args | Notes |
|-------|------|------|-------|
| `id` | ID | | |
| `name` | String | | Title set by organizer |
| `slug` | String | | Full path slug |
| `startAt` | Timestamp | | |
| `createdAt` | Timestamp | | |
| `updatedAt` | Timestamp | | |
| `state` | ActivityState | | CREATED/ACTIVE/COMPLETED |
| `type` | Int | | 1=singles, 5=teams |
| `isOnline` | Boolean | | |
| `numEntrants` | Int | | |
| `entryFee` | Float | | |
| `competitionTier` | Int | | Relative competitive importance |
| `checkInEnabled` | Boolean | | |
| `checkInBuffer` | Int | | Seconds before start |
| `checkInDuration` | Int | | Seconds |
| `hasDecks` | Boolean | | |
| `hasTasks` | Boolean | | Player tasks enabled |
| `useEventSeeds` | Boolean | | New seeding system |
| `teamNameAllowed` | Boolean | | Custom team names |
| `rulesMarkdown` | String | | |
| `matchRulesMarkdown` | String | | |
| `prizingInfo` | JSON | | |
| `publishing` | JSON | | |
| `rulesetId` | Int | | |
| `deckSubmissionDeadline` | Timestamp | | |
| `teamManagementDeadline` | Timestamp | | |
| `teamRosterSize` | TeamRosterSize | | |
| `tournament` | Tournament | | Parent |
| `videogame` | Videogame | | |
| `league` | League | | |
| `entrants` | EntrantConnection | `query: EventEntrantPageQuery` | Paginated |
| `sets` | SetConnection | `page, perPage, sortType: SetSortType, filters: SetFilters` | |
| `standings` | StandingConnection | `query: StandingPaginationQuery!` | **Required** arg |
| `phases` | [Phase] | `state: ActivityState, phaseId: ID` | |
| `phaseGroups` | [PhaseGroup] | | |
| `waves` | [Wave] | `phaseId: ID` | |
| `images` | [Image] | `type: String` | |
| `stations` | StationsConnection | `query: StationFilter` | |
| `userEntrant` | Entrant | `userId: ID` | Auth user's entrant |

### Set

| Field | Type | Args | Notes |
|-------|------|------|-------|
| `id` | ID | | Numeric for ACTIVE/COMPLETED; string `preview_*` for CREATED |
| `state` | Int | | Set state (Int, not ActivityState enum) |
| `round` | Int | | **Positive = winners bracket, negative = losers bracket** |
| `fullRoundText` | String | | e.g. "Winners Semi-Final", "Grand Final Reset" |
| `identifier` | String | | Pool ID e.g. "F", "AT" |
| `displayScore` | String | `mainEntrantId: ID` | Score from entrant's POV |
| `winnerId` | Int | | |
| `wPlacement` | Int | | Winner's placement |
| `lPlacement` | Int | | Loser's placement |
| `setGamesType` | Int | | Best-of or total games mode |
| `totalGames` | Int | | Number of games (total mode) |
| `hasPlaceholder` | Boolean | | True if entrant TBD |
| `startAt` | Timestamp | | Scheduled start |
| `startedAt` | Timestamp | | Actual start |
| `completedAt` | Timestamp | | |
| `createdAt` | Timestamp | | |
| `updatedAt` | Timestamp | | |
| `vodUrl` | String | | VOD link |
| `slots` | [SetSlot] | `includeByes: Boolean` | Entrants in set |
| `games` | [Game] | | All games |
| `game` | Game | `orderNum: Int!` | Specific game by number |
| `event` | Event | | |
| `phaseGroup` | PhaseGroup | | |
| `station` | Stations | | |
| `stream` | Streams | | |
| `images` | [Image] | `type: String` | |
| `entrant1Source` | SetEntrantSource | | Source of entrant 1 |
| `entrant2Source` | SetEntrantSource | | Source of entrant 2 |
| `loserProgressionSeed` | Seed | | |
| `winnerProgressionSeed` | Seed | | |

### SetSlot

| Field | Type | Notes |
|-------|------|-------|
| `id` | ID | |
| `entrant` | Entrant | May be null in CREATED events — fall back to `seed.entrant` |
| `seed` | Seed | |
| `slotIndex` | Int | Unique per set |
| `standing` | Standing | Standing within this set |
| `prereqId` | String | ID of feeder set |
| `prereqType` | String | `"set"` (real match) or `"bye"` (passthrough) |
| `prereqPlacement` | Int | `1` = winner of feeder, `2` = loser of feeder |

### Game

| Field | Type | Notes |
|-------|------|-------|
| `id` | ID | |
| `orderNum` | Int | Game number in set |
| `winnerId` | Int | |
| `state` | Int | |
| `entrant1Score` | Int | For smash: stocks remaining |
| `entrant2Score` | Int | For smash: stocks remaining |
| `selections` | [GameSelection] | Character picks, etc. |
| `stage` | Stage | Stage played on (`id`, `name`) |
| `images` | [Image] | |

### GameSelection

| Field | Type | Notes |
|-------|------|-------|
| `id` | ID | |
| `selectionType` | GameSelectionType | `CHARACTER` |
| `selectionValue` | Int | Numeric character ID |
| `entrant` | Entrant | Who made the selection |
| `participant` | Participant | For multi-participant entrants |
| `character` | [Character] | Resolved character objects (alternative to selectionValue) |
| `orderNum` | Int | |

Map character IDs to names via `videogame(id).characters { id name }`. Character lists are static — safe to cache indefinitely.

### Entrant

| Field | Type | Args | Notes |
|-------|------|------|-------|
| `id` | ID | | |
| `name` | String | | gamerTag or team name |
| `initialSeedNum` | Int | | Seed in first phase |
| `isDisqualified` | Boolean | | |
| `skill` | Int | | Skill rating |
| `event` | Event | | |
| `participants` | [Participant] | | |
| `seeds` | [Seed] | | Seeds across phases; each seed has `phaseGroup` |
| `standing` | Standing | | In event context |
| `paginatedSets` | SetConnection | `page, perPage, sortType: SetSortType, filters: SetFilters` | |
| `streams` | [Streams] | | |
| `team` | Team | | Linked team |

### Participant

| Field | Type | Notes |
|-------|------|-------|
| `id` | ID | |
| `gamerTag` | String | Tag at registration |
| `prefix` | String | e.g. "C9" |
| `checkedIn` | Boolean | Admin check-in |
| `checkedInAt` | Timestamp | |
| `verified` | Boolean | Verified in tournament |
| `email` | String | Admin-only, 18-month limit |
| `connectedAccounts` | JSON | External services |
| `contactInfo` | ContactInfo | Admin-only |
| `requiredConnections` | [ProfileAuthorization] | Admin-only |
| `user` | User | |
| `player` | Player | |
| `entrants` | [Entrant] | |
| `events` | [Event] | Events registered for |
| `images` | [Image] | |

### Player

| Field | Type | Args | Notes |
|-------|------|------|-------|
| `id` | ID | | |
| `gamerTag` | String | | |
| `prefix` | String | | Team prefix |
| `user` | User | | |
| `rankings` | [PlayerRank] | `limit: Int, videogameId: ID` | Active & published rankings |
| `recentStandings` | [Standing] | `videogameId: ID, limit: Int` | Default 3, max 20 |
| `sets` | SetConnection | `page, perPage, filters: SetFilters` | Full set history |
| `recentSets` | [Set] | `opponentId: ID` | **Deprecated** — use `sets` |

### PlayerRank

| Field | Type | Notes |
|-------|------|-------|
| `id` | ID | |
| `rank` | Int | Placement on ranking |
| `title` | String | Ranking title/label |

### User

| Field | Type | Args | Notes |
|-------|------|------|-------|
| `id` | ID | | |
| `name` | String | | Respects publishing settings |
| `slug` | String | | Format: `user/<discriminator>` |
| `discriminator` | String | | Hashed part of slug |
| `bio` | String | | |
| `birthday` | String | | Respects publishing settings |
| `email` | String | | |
| `genderPronoun` | String | | |
| `location` | Address | | Has `country` field (NOT `countryCode`) |
| `player` | Player | | |
| `images` | [Image] | `type: String` | |
| `authorizations` | [ProfileAuthorization] | `types: [SocialConnectionType]` | Twitch, Twitter, etc. |
| `events` | EventConnection | `query: UserEventsPaginationQuery` | Competed in |
| `leagues` | LeagueConnection | `query: UserLeaguesPaginationQuery` | |
| `tournaments` | TournamentConnection | `query: UserTournamentsPaginationQuery` | **Does NOT support `sortBy`** |

### Standing

| Field | Type | Notes |
|-------|------|-------|
| `id` | ID | |
| `placement` | Int | Final placement |
| `isFinal` | Boolean | |
| `totalPoints` | Float | |
| `entrant` | Entrant | |
| `player` | Player | |
| `container` | StandingContainer | **Union type** — must use `... on Event { }` fragment |
| `stats` | StandingStats | Experimental, may change |
| `setRecordWithoutByes` | JSON | Win/loss record |
| `metadata` | JSON | Varies by standing group type |
| `standing` | Int | **Deprecated** — use `placement` |

### StandingStats / Score

```
StandingStats { score: [Score] }
Score { label: String, value: Float, displayValue: String }
```

### Phase

| Field | Type | Args | Notes |
|-------|------|------|-------|
| `id` | ID | | |
| `name` | String | | e.g. "Round 1 Pools" |
| `phaseOrder` | Int | | Order within event |
| `bracketType` | BracketType | | |
| `state` | ActivityState | | |
| `groupCount` | Int | | Number of phase groups |
| `numSeeds` | Int | | |
| `isExhibition` | Boolean | | |
| `event` | Event | | |
| `phaseGroups` | PhaseGroupConnection | `query` | Paginated |
| `seeds` | SeedConnection | `query, eventId` | Paginated |
| `sets` | SetConnection | `page, perPage, sortType, filters` | |
| `progressions` | [Progression] | | Out of this phase |
| `progressingInData` | [ProgressionData] | | Into this phase |
| `waves` | [Wave] | | |

### PhaseGroup

| Field | Type | Args | Notes |
|-------|------|------|-------|
| `id` | ID | | |
| `displayIdentifier` | String | | e.g. "A1", "G1" |
| `bracketType` | BracketType | | |
| `bracketUrl` | String | | |
| `startAt` | Timestamp | | Scheduled start |
| `firstRoundTime` | Timestamp | | |
| `numRounds` | Int | | |
| `state` | Int | | |
| `phase` | Phase | | |
| `seeds` | SeedConnection | `query, eventId` | |
| `sets` | SetConnection | `page, perPage, sortType, filters` | Without `entrantIds` filter returns ALL sets |
| `standings` | StandingConnection | `query` | |
| `rounds` | [Round] | | |
| `progressionsOut` | [Progression] | | |
| `wave` | Wave | | |
| `seedMap` | JSON | | |
| `tiebreakOrder` | JSON | | |

### Seed

| Field | Type | Args | Notes |
|-------|------|------|-------|
| `id` | ID | | |
| `seedNum` | Int | | Overall seed number |
| `groupSeedNum` | Int | | Within group |
| `isBye` | Boolean | | |
| `placement` | Int | | Final placement |
| `placeholderName` | String | | |
| `entrant` | Entrant | | |
| `players` | [Player] | | |
| `phase` | Phase | | |
| `phaseGroup` | PhaseGroup | | |
| `progressionSeedId` | Int | | |
| `progressionSource` | Progression | | |
| `standings` | [Standing] | `containerType: String` | e.g. `"groups"` for race format |
| `setRecordWithoutByes` | JSON | `phaseGroupId: ID!` | W/L record |
| `checkedInParticipants` | JSON | | |
| `updatedAt` | Timestamp | | |

### Other Types

#### Videogame

| Field | Type | Notes |
|-------|------|-------|
| `id` | ID | |
| `name` | String | |
| `displayName` | String | |
| `slug` | String | |
| `characters` | [Character] | Static, cache indefinitely |
| `stages` | [Stage] | |
| `images` | [Image] | |

#### Character

| Field | Type | Notes |
|-------|------|-------|
| `id` | ID | |
| `name` | String | |
| `images` | [Image] | `type: String` |

#### Stage

| Field | Type | Notes |
|-------|------|-------|
| `id` | ID | |
| `name` | String | |

#### Image

| Field | Type | Notes |
|-------|------|-------|
| `id` | ID | |
| `url` | String | |
| `type` | String | e.g. "profile", "banner" |
| `height` | Float | |
| `width` | Float | |
| `ratio` | Float | Aspect ratio |

#### Wave

| Field | Type | Notes |
|-------|------|-------|
| `id` | ID | |
| `identifier` | String | |
| `startAt` | Timestamp | |

#### Streams

| Field | Type | Notes |
|-------|------|-------|
| `id` | ID | |
| `streamName` | String | |
| `streamSource` | StreamSource | TWITCH, YOUTUBE, etc. |
| `streamId` | String | Platform ID |
| `streamLogo` | String | Logo URL |
| `streamGame` | String | |
| `streamStatus` | String | |
| `isOnline` | Boolean | |
| `enabled` | Boolean | |
| `followerCount` | Int | |
| `numSetups` | Int | |
| `parentStreamId` | Int | |
| `shortName` | String | |
| `streamType` | Int | |
| `streamTypeId` | Int | |

---

## Input Types

### TournamentQuery

| Field | Type | Notes |
|-------|------|-------|
| `page` | Int | |
| `perPage` | Int | Max 512 |
| `sortBy` | String | e.g. `"startAt asc"` — only works on root `tournaments()`, NOT `user.tournaments` |
| `sort` | TournamentPaginationSort | Enum-based sort |
| `filter` | TournamentPageFilter | See below |

### TournamentPageFilter

| Field | Type | Notes |
|-------|------|-------|
| `id` | [ID] | |
| `ids` | [[ID]] | |
| `ownerId` | [ID] | Tournament creator's user ID (NOT all admins) |
| `isCurrentUserAdmin` | [Boolean] | |
| `countryCode` | [String] | ISO country code |
| `addrState` | [String] | US state abbreviation |
| `location` | [TournamentLocationFilter] | Geo filter |
| `afterDate` | [Timestamp] | **Must be omitted (not `null`)** when unused |
| `beforeDate` | [Timestamp] | |
| `name` | [String] | Search by name |
| `venueName` | [String] | |
| `isFeatured` | [Boolean] | |
| `isLeague` | [Boolean] | |
| `past` | [Boolean] | |
| `upcoming` | [Boolean] | |
| `published` | [Boolean] | |
| `publiclySearchable` | [Boolean] | |
| `regOpen` | [Boolean] | |
| `hasOnlineEvents` | [Boolean] | |
| `videogameIds` | [[ID]] | Filter by game |
| `hasBannerImages` | [Boolean] | |
| `activeShops` | [Boolean] | |
| `staffPicks` | [Boolean] | |
| `topGames` | [TopGameFilter] | |
| `sortByScore` | [Boolean] | |
| `computedUpdatedAt` | [Timestamp] | |

### TournamentLocationFilter

| Field | Type | Notes |
|-------|------|-------|
| `distanceFrom` | [String] | `"lat,lng"` e.g. `"33.745,-117.868"` |
| `distance` | [String] | e.g. `"50mi"` |

### EventFilter (for Tournament.events)

| Field | Type | Notes |
|-------|------|-------|
| `videogameId` | [ID] | |
| `type` | [Int] | Event type |
| `published` | Boolean | |
| `id` | ID | |
| `ids` | [ID] | |
| `slug` | String | |
| `fantasyEventId` | ID | |
| `fantasyRosterHash` | String | |

### SetFilters

| Field | Type | Notes |
|-------|------|-------|
| `entrantIds` | [ID] | Only sets for these entrants |
| `entrantSize` | [Int] | e.g. `[1]` for 1v1 |
| `hasVod` | Boolean | Sets with VODs |
| `hideEmpty` | Boolean | Hide sets waiting for progressions |
| `showByes` | Boolean | Include byes (significantly increases set count) |
| `isEventOnline` | Boolean | |
| `location` | SetFilterLocation | Geo filter |
| `participantIds` | [ID] | |
| `phaseGroupIds` | [ID] | |
| `phaseIds` | [ID] | |
| `eventIds` | [ID] | |
| `tournamentIds` | [ID] | |
| `playerIds` | [ID] | |
| `roundNumber` | Int | |
| `state` | [Int] | Set state values |
| `stationIds` | [ID] | |
| `stationNumbers` | [Int] | |
| `updatedAfter` | Timestamp | |

### UserTournamentsPaginationFilter

| Field | Type | Notes |
|-------|------|-------|
| `past` | [Boolean] | |
| `upcoming` | [Boolean] | |
| `search` | [PaginationSearchType] | |
| `videogameId` | [ID] | |
| `tournamentView` | [String] | |
| `excludeId` | [ID] | |

### StandingPaginationQuery

| Field | Type | Notes |
|-------|------|-------|
| `page` | Int | |
| `perPage` | Int | Max 512 |
| `sortBy` | String | |
| `filter` | StandingPageFilter | `id`, `ids`, `search` |

---

## Mutations

All mutations require OAuth scopes: `tournament.manager` for seeding/setup, `tournament.reporter` for set reporting.

### Set Management

| Mutation | Args | Returns | Notes |
|----------|------|---------|-------|
| `reportBracketSet` | `setId, winnerId, isDQ, gameData` | `[Set]` | Report winner + optional game data |
| `updateBracketSet` | `setId, winnerId, isDQ, gameData` | `Set` | Update game stats without changing winner |
| `resetSet` | `setId, resetDependentSets` | `Set` | Reset to initial state |
| `markSetCalled` | `setId` | `Set` | Mark as called |
| `markSetInProgress` | `setId` | `Set` | Mark as in progress |
| `assignStation` | `setId, stationId` | `Set` | Assign station |
| `assignStream` | `setId, streamId` | `Set` | Assign stream |
| `updateVodUrl` | `setId, vodUrl` | `Set` | Update VOD URL |

### Seeding & Phases

| Mutation | Args | Returns | Notes |
|----------|------|---------|-------|
| `updatePhaseSeeding` | `phaseId, seedMapping, options` | `Phase` | Update seeding |
| `swapSeeds` | `phaseId, seed1Id, seed2Id` | `[Seed]` | Swap two seeds |
| `resolveScheduleConflicts` | `tournamentId, options` | `[Seed]` | Auto-resolve conflicts |
| `upsertPhase` | `phaseId, eventId, payload` | `Phase` | Create/update phase |
| `deletePhase` | `phaseId` | `Boolean` | |
| `updatePhaseGroups` | `groupConfigs` | `[PhaseGroup]` | |

### Stations, Waves, Registration

| Mutation | Args | Returns | Notes |
|----------|------|---------|-------|
| `upsertStation` | `stationId, tournamentId, fields` | `Stations` | Create/update station |
| `deleteStation` | `stationId` | `Boolean` | |
| `upsertWave` | `waveId, tournamentId, fields` | `Wave` | Create/update wave |
| `deleteWave` | `waveId` | `Boolean` | |
| `registerForTournament` | `registration, registrationToken` | `Participant` | |
| `generateRegistrationToken` | `registration, userId` | `String` | |

### reportBracketSet Example

```graphql
mutation ReportSet($setId: ID!, $winnerId: ID!, $gameData: [BracketSetGameDataInput]) {
  reportBracketSet(setId: $setId, winnerId: $winnerId, gameData: $gameData) {
    id state
  }
}
```

`BracketSetGameDataInput` fields: `gameNum`, `winnerId`, `entrant1Score`, `entrant2Score`, `stageId`, `selections: [{ entrantId, characterId }]`

### updatePhaseSeeding Example

```graphql
mutation UpdatePhaseSeeding($phaseId: ID!, $seedMapping: [UpdatePhaseSeedInfo]!) {
  updatePhaseSeeding(phaseId: $phaseId, seedMapping: $seedMapping) { id }
}
# seedMapping: [{ "seedId": "...", "seedNum": 1 }, ...]
```

---

## Query Examples

### Get a user's tournaments

```graphql
query UserTournaments($slug: String!, $perPage: Int!) {
  user(slug: $slug) {
    id
    tournaments(query: { page: 1, perPage: $perPage }) {
      nodes {
        id name slug startAt endAt numAttendees
        events { id name numEntrants videogame { id name } }
        images(type: "profile") { id url }
      }
    }
  }
}
# variables: { slug: "user/<discriminator>", perPage: 20 }
# NOTE: Do NOT include sortBy — causes "An unknown error has occurred"
```

### Get event by slug

```graphql
query GetEvent($slug: String) {
  event(slug: $slug) {
    id name numEntrants
    tournament { id name }
    videogame { id name }
  }
}
# slug: "tournament/genesis-9-1/event/ultimate-singles"
```

### Get event standings

```graphql
query EventStandings($eventId: ID!, $page: Int!, $perPage: Int!) {
  event(id: $eventId) {
    standings(query: { page: $page, perPage: $perPage }) {
      pageInfo { total totalPages }
      nodes {
        placement
        entrant { id name }
      }
    }
  }
}
# NOTE: standings requires the query arg — it is NOT optional
```

### Get event entrants

```graphql
query EventEntrants($eventId: ID!, $page: Int!, $perPage: Int!) {
  event(id: $eventId) {
    entrants(query: { page: $page, perPage: $perPage }) {
      pageInfo { total totalPages }
      nodes {
        id
        participants { id gamerTag }
      }
    }
  }
}
```

### Get sets in an event

```graphql
query EventSets($eventId: ID!, $page: Int!, $perPage: Int!) {
  event(id: $eventId) {
    sets(page: $page, perPage: $perPage, sortType: CALL_ORDER) {
      pageInfo { total }
      nodes {
        id fullRoundText displayScore winnerId
        slots { entrant { id name } }
      }
    }
  }
}
```

### Get entrant's bracket sets (ACTIVE/COMPLETED event)

```graphql
query EntrantSets($entrantId: ID!, $page: Int!, $perPage: Int!) {
  entrant(id: $entrantId) {
    paginatedSets(page: $page, perPage: $perPage, sortType: RECENT) {
      nodes {
        id state round fullRoundText winnerId completedAt
        displayScore(mainEntrantId: $entrantId)
        slots { entrant { id name participants { player { id } } } }
        games {
          orderNum winnerId
          selections { entrant { id } selectionType selectionValue }
        }
      }
    }
  }
}
```

### Get projected bracket (CREATED event — not yet started)

```graphql
query EntrantPhaseGroupSets($entrantId: ID!, $perPage: Int!) {
  entrant(id: $entrantId) {
    seeds {
      phaseGroup {
        sets(page: 1, perPage: $perPage, sortType: ROUND) {
          nodes {
            id fullRoundText hasPlaceholder
            slots {
              entrant { id name }
              seed { entrant { id name } }
            }
          }
        }
      }
    }
  }
}
# NOTE: In CREATED events, slot.entrant may be null — always fall back to slot.seed.entrant
# Omit entrantIds filter to get ALL sets for bracket visualization
```

### Get player stats (standings + set history)

```graphql
query PlayerStats($playerId: ID!) {
  player(id: $playerId) {
    gamerTag
    recentStandings(limit: 20) {
      placement
      container { ... on Event { name numEntrants tournament { name } } }
    }
    sets(page: 1, perPage: 50) {
      nodes {
        winnerId displayScore
        slots { entrant { id participants { player { id } } } }
        games { selections { entrant { id } selectionType selectionValue } }
      }
    }
  }
}
# NOTE: recentStandings default limit is 3 (not max) — set limit explicitly
```

### Get set scores (detailed)

```graphql
query SetScore($setId: ID!) {
  set(id: $setId) {
    slots {
      entrant { id name }
      standing {
        placement
        stats { score { label value } }
      }
    }
  }
}
```

### Get character names for a videogame

```graphql
query VideogameCharacters($videogameId: ID!) {
  videogame(id: $videogameId) {
    characters { id name }
  }
}
# Cache indefinitely — character lists don't change
```

### Search videogames by name

```graphql
query VideogameSearch {
  videogames(query: { filter: { name: "Super Smash Bros" }, perPage: 5 }) {
    nodes { id name displayName }
  }
}
# NOTE: filter by name, not displayName
```

### Search tournaments by videogame

```graphql
query TournamentsByVideogame($perPage: Int!, $videogameId: ID!) {
  tournaments(query: {
    perPage: $perPage, page: 1,
    sortBy: "startAt asc",
    filter: { upcoming: true, videogameIds: [$videogameId] }
  }) {
    nodes { id name slug startAt numAttendees }
  }
}
```

### Search tournaments by location

```graphql
query TournamentsByLocation($perPage: Int!) {
  tournaments(query: {
    perPage: $perPage, page: 1,
    filter: {
      location: { distanceFrom: "33.745,-117.868", distance: "50mi" }
    }
  }) {
    nodes { id name slug }
  }
}
```

### Get phase seeding

```graphql
query PhaseSeeds($phaseId: ID!, $page: Int!, $perPage: Int!) {
  phase(id: $phaseId) {
    seeds(query: { page: $page, perPage: $perPage }) {
      pageInfo { total totalPages }
      nodes {
        id seedNum
        entrant { id participants { id gamerTag } }
      }
    }
  }
}
```

### Get pool seeds

```graphql
query PoolSeeds($phaseGroupId: ID!, $page: Int!, $perPage: Int!) {
  phaseGroup(id: $phaseGroupId) {
    seeds(query: { page: $page, perPage: $perPage }) {
      pageInfo { total }
      nodes { entrant { id name } }
    }
  }
}
```

### Get attendee count

```graphql
query AttendeeCount($tourneySlug: String!) {
  tournament(slug: $tourneySlug) {
    name
    participants(query: {}) { pageInfo { total } }
  }
}
# Optional: filter by eventIds in query.filter.eventIds
```

### Get stream queue

```graphql
query StreamQueue($tourneySlug: String!) {
  tournament(slug: $tourneySlug) {
    streamQueue {
      stream { streamSource streamName }
      sets { id }
    }
  }
}
```

### Get tournaments by owner

```graphql
query TournamentsByOwner($perPage: Int!, $ownerId: ID!) {
  tournaments(query: { perPage: $perPage, filter: { ownerId: $ownerId } }) {
    nodes { id name slug }
  }
}
# NOTE: ownerId returns only tournaments the user CREATED, not all they admin
```

### Race format standings

```graphql
query RaceStandings($eventId: ID!) {
  event(id: $eventId) {
    phaseGroups {
      seeds(query: { page: 1 }) {
        nodes {
          standings(containerType: "groups") { id metadata }
        }
      }
    }
  }
}
```

### Events by tournament (with videogame filter)

```graphql
query TournamentEvents($tourneySlug: String, $videogameId: [ID]!) {
  tournament(slug: $tourneySlug) {
    events(filter: { videogameId: $videogameId }) {
      id name
    }
  }
}
```

### Sets in phase

```graphql
query PhaseSets($phaseId: ID!, $page: Int!, $perPage: Int!) {
  phase(id: $phaseId) {
    sets(page: $page, perPage: $perPage, sortType: CALL_ORDER) {
      pageInfo { total }
      nodes { id slots { entrant { id name } } }
    }
  }
}
```

### Phase groups in phase

```graphql
query PhaseGroupsByPhase($phaseId: ID!, $page: Int!, $perPage: Int!) {
  phase(id: $phaseId) {
    phaseGroups(query: { page: $page, perPage: $perPage }) {
      pageInfo { total }
      nodes { id displayIdentifier }
    }
  }
}
```

### Entrants by tournament + videogame

```graphql
query EntrantsByVideogame($tourneySlug: String, $videogameId: [ID]!) {
  tournament(slug: $tourneySlug) {
    events(filter: { videogameId: $videogameId }) {
      id name
      entrants(query: { perPage: 20, page: 1 }) {
        nodes { id name seeds { seedNum } }
      }
    }
  }
}
```

### Search attendees by sponsor/prefix

```graphql
query PrefixSearchAttendees($tourneySlug: String!, $sponsor: String!) {
  tournament(slug: $tourneySlug) {
    participants(query: {
      filter: { search: { fieldsToSearch: ["prefix"], searchString: $sponsor } }
    }) {
      nodes { id gamerTag }
    }
  }
}
```

### League schedule

```graphql
query LeagueSchedule($slug: String!) {
  league(slug: $slug) {
    events(query: { page: 1, perPage: 10 }) {
      pageInfo { totalPages total }
      nodes { id name startAt tournament { id name } }
    }
  }
}
```

### League standings

```graphql
query LeagueStandings($slug: String!) {
  league(slug: $slug) {
    standings(query: { page: 1, perPage: 10 }) {
      pageInfo { totalPages total }
      nodes { id placement entrant { id name } }
    }
  }
}
```

### Sets at station

```graphql
query SetsAtStation($eventId: ID!, $stationNumbers: [Int]) {
  event(id: $eventId) {
    sets(page: 1, perPage: 3, filters: { stationNumbers: $stationNumbers }) {
      nodes { id station { id number } slots { entrant { id name } } }
    }
  }
}
```

---

## Gotchas & Undocumented Behavior

### User & Authentication

1. **User lookup requires `slug`, not `id`**: Use `user(slug: "user/<discriminator>")`. Passing the discriminator as `id` does NOT work.

2. **`user.tournaments` does not support `sortBy`**: Including `sortBy` causes `"An unknown error has occurred"`. Only `page`, `perPage`, and `filter` (with `past`/`upcoming`/`videogameId`/`excludeId`) are valid. The root `tournaments()` query DOES support `sortBy`.

3. **`tournaments(filter: { ownerId })` returns only CREATED tournaments**: Not all tournaments the user admins.

4. **`participant.email` access is restricted**: Only accessible to admins, within 18 months of tournament completion.

### Slugs & IDs

5. **Slug formats**: Tournament: `tournament/<name>`, Event: `tournament/<name>/event/<name>`, User: `user/<discriminator>`.

6. **`Set.id` and `SetSlot.prereqId` are numbers at runtime**: Despite the GraphQL `ID` scalar being typed as `string` by codegen, the API returns numeric IDs for ACTIVE/COMPLETED event sets (e.g., `12345` not `"12345"`). CREATED events use string preview IDs (see #16). Always wrap with `String()` before calling string methods like `.split()` or using as Map keys.

### Timestamps

7. **Timestamps are Unix seconds**: Not milliseconds. Multiply by 1000 for JavaScript `Date`.

### Pagination

8. **`event.standings` requires `query` arg**: Unlike some other connections, `standings(query: { page, perPage })` is required, not optional.

9. **Undocumented 10,000 result pagination cap**: The API silently caps paginated results at ~10,000 total items. `totalPages` may report a lower number. Workaround: use `afterDate`/`beforeDate` date windows that each stay under the cap.

10. **`TournamentPageFilter.afterDate` must be omitted, not `null`**: Passing `afterDate: null` causes the API to return zero results. When no date filter is needed, omit the field entirely (use a separate query without the `$afterDate` variable).

### Set & Bracket Data

11. **Set `round` field**: Positive values = winners bracket, negative = losers bracket.

12. **Set `state` is an Int**: Not an `ActivityState` enum (unlike Event/Phase). Use `filters: { hideEmpty: true }` on sets to filter out placeholder sets waiting for progressions.

13. **`displayScore(mainEntrantId)` perspective**: Returns score from that entrant's perspective (e.g., "3 - 2"). Alternative: `set.slots[].standing.stats.score` with `{ label, value }`.

14. **Game scores for Smash**: `Game.entrant1Score` / `entrant2Score` represent stocks remaining, not game wins.

15. **Unseeded brackets return placeholder sets**: API returns set objects with `hasPlaceholder: true` and null entrants in slots. Always check for valid entrant data, not just `sets.length > 0`.

16. **Preview set IDs for CREATED events**: Sets in unseeded/CREATED brackets use IDs in the format `preview_{phaseGroupId}_{round}_{index}` (e.g., `preview_3203971_2_2`). Parse with `String(id).split('_')` — round and index are the last two segments.

### Bracket Topology & Feeders

17. **`SetSlot.prereqId` / `prereqPlacement` / `prereqType`**: Each set slot has feeder info. `prereqType` is `"set"` (real match) or `"bye"` (passthrough). `prereqId` is the feeder set's ID. `prereqPlacement` is `1` for winner, `2` for loser. This is the authoritative way to trace bracket topology — do NOT hardcode DE bracket patterns.

18. **DE bracket feeder fallback (winners only)**: As a fallback for winners bracket only, a set at round R, index I is typically fed by two sets from round R-1 at indices `2*I` and `2*I+1`. Losers bracket topology varies — always use prereq data.

19. **Grand Finals Reset shares `round` number with Grand Finals**: In DE brackets, GF and GFR have the same `round` value from the API. Differentiate by `fullRoundText` (e.g., "Grand Final" vs "Grand Final Reset").

### BYEs & CREATED Events

20. **BYE handling in CREATED events**: Top seeds (e.g., seeds 1-8 in a 24-player DE) skip Round 1 and are placed directly in Round 2. The API returns R2 sets with `slot[0]` = the bye seed (populated) and `slot[1]` = NULL (winner of R1 TBD). R1 sets have both slots populated with the actual playing entrants.

21. **WR1 set indices with byes**: In brackets with byes, WR1 set indices are ODD only (1,3,5,...). Even indices are bye slots for seeded players who skip WR1. WR2 has consecutive indices (0-7) and receives winners from WR1 via prereqs.

22. **CREATED event entrant resolution**: In CREATED events, `slot.entrant` may be null even when the entrant is known. Always fall back to `slot.seed.entrant` — the seed object reliably carries entrant data. Pattern: `const entrant = slot?.entrant ?? slot?.seed?.entrant`.

23. **Hidden bye rounds in DE brackets**: `phaseGroup.sets` (without `showByes: true` filter) omits hidden bye rounds (e.g., rounds -1, -2, -3 for a 24-seed DE). These are structural passthrough rounds with no real matches. To include them, pass `filters: { showByes: true }`, but this significantly increases set count (e.g., 40 → 88 for a 24-seed pool). Better to trace the bye chain programmatically.

24. **`phaseGroup.sets` without `entrantIds` filter**: Omitting the filter returns ALL sets in the phase group, not just one entrant's sets. Necessary for bracket visualization but increases object count. A 24-seed DE bracket with `perPage: 128` returns ~40 sets, ~322 objects — safely under the 1000 limit.

### Query Complexity

25. **Query complexity with `seed.entrant`**: Including both `slot.entrant` AND `slot.seed.entrant` (with nested `participants.player`) costs ~17 objects per set. At `perPage: 80` that's ~1360 objects, exceeding the 1000 limit. Split into two query variants: slim (no `seed.entrant`, ~11 obj/set, `perPage: 80`) for ACTIVE/COMPLETED events, and full (include `seed.entrant`, ~17 obj/set, `perPage: 50`) for CREATED events.

26. **Object count budgeting**: Each response includes `extensions.queryComplexity`. Deeply nested queries (sets → games → selections) add up fast. Example complexities: simple query ≈ 1, event with phases ≈ 22, sets with games/selections ≈ 79.

### Character Data

27. **Character data path**: `set.games[].selections[]` where `selectionType === "CHARACTER"` and `selectionValue` is a numeric ID. Map IDs to names via `videogame(id).characters`. Alternative: `selection.character` returns resolved Character objects directly.

28. **Character lists are static**: Safe to cache indefinitely — they don't change.

### Videogame Search

29. **`videogames` search uses `name` not `displayName`**: The filter only matches on `name`. `displayName` is returned but not filterable.

### Standing Data

30. **`standing.container` is a union type**: Must use inline fragment `... on Event { }` to access event fields. Returns `__typename: "Event"`.

31. **`player.recentStandings` default limit is 3**: Not the max. Set `limit: 20` explicitly to get more (20 is the maximum).

32. **`entrant.standing` cross-event**: "All entrants queried must be in the same event" for this field to work correctly.

### Address Type

33. **`Address.country` not `countryCode`**: The `Address` type (used by `user.location`) has a `country` field, not `countryCode`. Querying `countryCode` returns `"Cannot query field \"countryCode\" on type \"Address\""`.

### Race Format

34. **Race format standings**: Use `phaseGroups.seeds.standings(containerType: "groups")` instead of event standings.

### Deprecated Fields

35. **Deprecated fields to avoid**:
    - `Standing.standing` → use `placement`
    - `Player.recentSets` → use `sets`
    - `PhaseGroup.paginatedSets` / `paginatedSeeds` → use `sets` / `seeds`
    - `Event.entrantSizeMax` / `entrantSizeMin` → use `teamRosterSize`
