import { GraphQLClient } from 'graphql-request'
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'

// ── Output types ──

interface CharacterEntry {
  id: number
  role: 'main' | 'co-main' | 'secondary'
  pct: number
}

interface PlayerRecord {
  pid: string
  tag: string
  pfx: string | null
  disc: string | null
  cc: string | null
  chars: CharacterEntry[]
  tc: number
}

// ── State types ──

interface SerializedPlayerData {
  tag: string
  pfx: string | null
  disc: string | null
  cc: string | null
  tournamentIds: string[]
  charCounts: Array<[number, number]>
}

interface CrawlState {
  version: 1
  cursor: number
  resumeBeforeDate?: number
  processedTournamentIds: string[]
  players: Array<[string, SerializedPlayerData]>
  lastRunAt: string
  totalEventsProcessed: number
}

// ── Runtime player data ──

interface PlayerData {
  tag: string
  pfx: string | null
  disc: string | null
  cc: string | null
  tournamentIds: Set<string>
  charCounts: Map<number, number>
}

interface EventInfo {
  eventId: string
  eventName: string
  numEntrants: number
  tournamentId: string
  tournamentName: string
}

// ── Constants ──

const ULTIMATE_ID = '1386'
const STATE_PATH = resolve(import.meta.dirname, '..', 'public', 'data', 'crawl-state.json')
const OUTPUT_PATH = resolve(import.meta.dirname, '..', 'public', 'data', 'players.json')
const CURSOR_BUFFER_SECONDS = 7 * 24 * 60 * 60 // 7 days

// ── Graceful shutdown ──

let shuttingDown = false
let onShutdown: (() => void) | null = null

// ── Load env vars from .env file if not already set ──

const envPath = resolve(import.meta.dirname, '..', '.env')
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8')
  for (const key of ['START_GG_CRAWL_TOKENS', 'VITE_START_GG_TOKEN']) {
    if (!process.env[key]) {
      const match = envContent.match(new RegExp(`^${key}=(.+)$`, 'm'))
      if (match) process.env[key] = match[1].trim()
    }
  }
}

// Resolve tokens: prefer START_GG_CRAWL_TOKENS (comma-separated), fall back to VITE_START_GG_TOKEN
const tokens: string[] = process.env.START_GG_CRAWL_TOKENS
  ? process.env.START_GG_CRAWL_TOKENS.split(',').map(t => t.trim()).filter(Boolean)
  : process.env.VITE_START_GG_TOKEN
    ? [process.env.VITE_START_GG_TOKEN]
    : []

if (tokens.length === 0) {
  console.error('Missing START_GG_CRAWL_TOKENS or VITE_START_GG_TOKEN in environment or .env file')
  process.exit(1)
}

// ── Rate limiter: ensures min gap between API requests ──

class RateLimiter {
  private queue: Array<() => void> = []
  private lastRequest = 0
  private running = false
  constructor(private minGapMs: number) {}

  acquire(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve)
      if (!this.running) this.drain()
    })
  }

  private drain() {
    if (this.queue.length === 0) { this.running = false; return }
    this.running = true
    const wait = Math.max(0, this.lastRequest + this.minGapMs - Date.now())
    setTimeout(() => {
      this.lastRequest = Date.now()
      this.queue.shift()!()
      this.drain()
    }, wait)
  }
}

// ── API Pool: round-robin across multiple keys, each with own client + rate limiter ──

interface ApiSlot {
  client: GraphQLClient
  limiter: RateLimiter
}

class ApiPool {
  private slots: ApiSlot[]
  private nextSlot = 0

  constructor(apiTokens: string[]) {
    this.slots = apiTokens.map(t => ({
      client: new GraphQLClient('https://api.start.gg/gql/alpha', {
        headers: { Authorization: `Bearer ${t}` },
      }),
      limiter: new RateLimiter(750),
    }))
  }

  async request<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const slot = this.slots[this.nextSlot]
    const slotIndex = this.nextSlot
    this.nextSlot = (this.nextSlot + 1) % this.slots.length

    for (let attempt = 0; ; attempt++) {
      await slot.limiter.acquire()
      try {
        return await slot.client.request<T>(query, variables)
      } catch (err: any) {
        const is429 = err?.response?.status === 429
          || err?.message?.includes('Rate limit ex')
        if (is429) {
          console.warn(`  ⚠ Rate limited (key ${slotIndex}), waiting 60s...`)
          await new Promise(r => setTimeout(r, 60_000))
          continue
        }
        throw err
      }
    }
  }

  get size() { return this.slots.length }
}

const apiPool = new ApiPool(tokens)

// ── Concurrency pool ──

async function processPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>) {
  let i = 0
  async function worker() {
    while (i < items.length) {
      const item = items[i++]
      await fn(item)
    }
  }
  await Promise.allSettled(Array.from({ length: concurrency }, worker))
}

// ── State management ──

function loadState(): CrawlState | null {
  if (!existsSync(STATE_PATH)) return null
  try {
    const raw = JSON.parse(readFileSync(STATE_PATH, 'utf-8'))
    if (raw.version !== 1) {
      console.warn('Unknown state version, ignoring state file')
      return null
    }
    return raw as CrawlState
  } catch {
    console.warn('Failed to parse state file, starting fresh')
    return null
  }
}

function hydratePlayersFromState(state: CrawlState): Map<string, PlayerData> {
  const players = new Map<string, PlayerData>()
  for (const [pid, data] of state.players) {
    players.set(pid, {
      tag: data.tag,
      pfx: data.pfx,
      disc: data.disc,
      cc: data.cc,
      tournamentIds: new Set(data.tournamentIds),
      charCounts: new Map(data.charCounts),
    })
  }
  return players
}

function saveState(
  players: Map<string, PlayerData>,
  processedTournamentIds: Set<string>,
  cursor: number,
  totalEventsProcessed: number,
  resumeBeforeDate?: number,
): void {
  const state: CrawlState = {
    version: 1,
    cursor,
    resumeBeforeDate,
    processedTournamentIds: [...processedTournamentIds],
    players: [...players.entries()].map(([pid, data]) => [
      pid,
      {
        tag: data.tag,
        pfx: data.pfx,
        disc: data.disc,
        cc: data.cc,
        tournamentIds: [...data.tournamentIds],
        charCounts: [...data.charCounts.entries()],
      },
    ]),
    lastRunAt: new Date().toISOString(),
    totalEventsProcessed,
  }
  mkdirSync(dirname(STATE_PATH), { recursive: true })
  writeFileSync(STATE_PATH, JSON.stringify(state))
}

function writePlayersJson(players: Map<string, PlayerData>): number {
  const records: PlayerRecord[] = [...players.entries()]
    .map(([pid, data]) => ({
      pid,
      tag: data.tag,
      pfx: data.pfx,
      disc: data.disc,
      cc: data.cc,
      chars: classifyCharacters(data.charCounts),
      tc: data.tournamentIds.size,
    }))
    .sort((a, b) => b.tc - a.tc)

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true })
  writeFileSync(OUTPUT_PATH, JSON.stringify(records))
  return records.length
}

// ── Query: Fetch recent SSBU tournaments ──

const TOURNAMENT_FIELDS = `
  pageInfo { total totalPages }
  nodes {
    id
    name
    slug
    numAttendees
    startAt
    events {
      id
      name
      videogame { id }
      numEntrants
      isOnline
    }
  }
`

function buildTournamentsQuery(afterDate?: number, beforeDate?: number): {
  query: string
  variables: Record<string, unknown>
} {
  const varDecls = ['$perPage: Int!', '$page: Int!', '$videogameId: ID!']
  const filterFields = ['past: true', 'videogameIds: [$videogameId]']
  const variables: Record<string, unknown> = { videogameId: ULTIMATE_ID }

  if (afterDate != null) {
    varDecls.push('$afterDate: Timestamp!')
    filterFields.push('afterDate: $afterDate')
    variables.afterDate = afterDate
  }
  if (beforeDate != null) {
    varDecls.push('$beforeDate: Timestamp!')
    filterFields.push('beforeDate: $beforeDate')
    variables.beforeDate = beforeDate
  }

  const query = `
    query CrawlTournaments(${varDecls.join(', ')}) {
      tournaments(query: {
        page: $page
        perPage: $perPage
        sortBy: "startAt desc"
        filter: { ${filterFields.join(', ')} }
      }) {
        ${TOURNAMENT_FIELDS}
      }
    }
  `
  return { query, variables }
}

// ── Query: Fetch event entrants ──

const eventEntrantsQuery = `
  query EventEntrants($eventId: ID!, $page: Int!, $perPage: Int!) {
    event(id: $eventId) {
      entrants(query: { page: $page, perPage: $perPage }) {
        pageInfo { total totalPages page }
        nodes {
          id
          participants {
            gamerTag
            prefix
            player { id }
            user {
              slug
              location { country }
            }
          }
        }
      }
    }
  }
`

// ── Query: Fetch event sets with character selections ──

const eventSetsQuery = `
  query EventSets($eventId: ID!, $page: Int!, $perPage: Int!) {
    event(id: $eventId) {
      sets(page: $page, perPage: $perPage, sortType: RECENT) {
        pageInfo { total totalPages page }
        nodes {
          games {
            selections {
              entrant { participants { player { id } } }
              selectionType
              selectionValue
            }
          }
        }
      }
    }
  }
`

async function fetchTournaments(
  page: number,
  perPage: number,
  afterDate?: number,
  beforeDate?: number,
): Promise<{
  nodes: Array<{
    id: string
    name: string
    slug: string
    numAttendees: number | null
    startAt: number | null
    events: Array<{
      id: string
      name: string
      videogame: { id: string } | null
      numEntrants: number | null
      isOnline: boolean | null
    }> | null
  }> | null
  totalPages: number
}> {
  const { query, variables } = buildTournamentsQuery(afterDate, beforeDate)
  variables.page = page
  variables.perPage = perPage
  const data = await apiPool.request<any>(query, variables)
  return {
    nodes: data.tournaments?.nodes,
    totalPages: data.tournaments?.pageInfo?.totalPages ?? 1,
  }
}

async function fetchEventEntrants(
  eventId: string,
  page: number,
): Promise<{
  entrants: Array<{
    id: string
    participants: Array<{
      gamerTag: string | null
      prefix: string | null
      player: { id: string } | null
      user: { slug: string | null; location: { country: string | null } | null } | null
    }> | null
  }> | null
  totalPages: number
}> {
  const data = await apiPool.request<any>(eventEntrantsQuery, {
    eventId,
    page,
    perPage: 100,
  })
  return {
    entrants: data.event?.entrants?.nodes,
    totalPages: data.event?.entrants?.pageInfo?.totalPages ?? 1,
  }
}

async function fetchEventSets(
  eventId: string,
  page: number,
): Promise<{
  sets: Array<{
    games: Array<{
      selections: Array<{
        entrant: {
          participants: Array<{ player: { id: string } | null }> | null
        } | null
        selectionType: string | null
        selectionValue: number | null
      }> | null
    }> | null
  }> | null
  totalPages: number
}> {
  const data = await apiPool.request<any>(eventSetsQuery, {
    eventId,
    page,
    perPage: 15,
  })
  return {
    sets: data.event?.sets?.nodes,
    totalPages: data.event?.sets?.pageInfo?.totalPages ?? 1,
  }
}

function parseDiscriminator(slug: string | null | undefined): string | null {
  if (!slug) return null
  const match = slug.match(/^user\/(.+)$/)
  return match ? match[1] : null
}

function classifyCharacters(charCounts: Map<number, number>): CharacterEntry[] {
  const total = [...charCounts.values()].reduce((a, b) => a + b, 0)
  if (total === 0) return []

  const entries = [...charCounts.entries()]
    .map(([id, count]) => ({ id, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.pct - a.pct)

  const mainPct = entries[0].pct

  return entries
    .filter((e) => e.pct >= 5)
    .map((e, i) => ({
      id: e.id,
      pct: e.pct,
      role: i === 0
        ? 'main' as const
        : e.pct >= mainPct * 0.6
          ? 'co-main' as const
          : 'secondary' as const,
    }))
}

// ── Process a single event ──

async function processEvent(
  ev: EventInfo,
  players: Map<string, PlayerData>,
  idx: number,
  total: number,
): Promise<boolean> {
  console.log(`  [${idx}/${total}] ${ev.tournamentName} / ${ev.eventName} (${ev.numEntrants} entrants)`)
  let success = true

  // Fetch all entrants (paginated)
  try {
    let entrantPage = 1
    let entrantTotalPages = 1
    do {
      const { entrants, totalPages } = await fetchEventEntrants(ev.eventId, entrantPage)
      entrantTotalPages = totalPages

      if (entrants) {
        for (const entrant of entrants) {
          for (const p of entrant.participants ?? []) {
            const playerId = p.player?.id
            if (!playerId || !p.gamerTag) continue

            const existing = players.get(playerId)
            if (existing) {
              existing.tag = p.gamerTag
              if (p.prefix) existing.pfx = p.prefix
              if (p.user?.slug) existing.disc = parseDiscriminator(p.user.slug)
              if (p.user?.location?.country) existing.cc = p.user.location.countryCode
              existing.tournamentIds.add(ev.tournamentId)
            } else {
              players.set(playerId, {
                tag: p.gamerTag,
                pfx: p.prefix ?? null,
                disc: parseDiscriminator(p.user?.slug),
                cc: p.user?.location?.country ?? null,
                tournamentIds: new Set([ev.tournamentId]),
                charCounts: new Map(),
              })
            }
          }
        }
      }
      entrantPage++
    } while (entrantPage <= entrantTotalPages)
  } catch (err) {
    console.warn(`    ⚠ Failed to fetch entrants for event ${ev.eventId}:`, (err as Error).message?.slice(0, 120))
    success = false
  }

  // Fetch all sets with character data (paginated)
  try {
    let setPage = 1
    let setTotalPages = 1
    do {
      const { sets, totalPages } = await fetchEventSets(ev.eventId, setPage)
      setTotalPages = totalPages

      if (sets) {
        for (const set of sets) {
          for (const game of set.games ?? []) {
            for (const sel of game.selections ?? []) {
              if (sel.selectionType !== 'CHARACTER' || !sel.selectionValue) continue
              const playerId = sel.entrant?.participants?.[0]?.player?.id
              if (!playerId) continue

              const playerData = players.get(playerId)
              if (playerData) {
                const current = playerData.charCounts.get(sel.selectionValue) ?? 0
                playerData.charCounts.set(sel.selectionValue, current + 1)
              }
            }
          }
        }
      }
      setPage++
    } while (setPage <= setTotalPages)
  } catch (err) {
    console.warn(`    ⚠ Failed to fetch sets for event ${ev.eventId}:`, (err as Error).message?.slice(0, 120))
    success = false
  }

  return success
}

// ── Core crawl cycle ──

async function crawlCycle(
  players: Map<string, PlayerData>,
  processedTournamentIds: Set<string>,
  cursor: number,
  maxPages: number,
  afterDate: number | undefined,
  resumeBeforeDate: number | undefined,
  offlineOnly: boolean,
  minEntrants: number,
): Promise<{ newCursor: number; newTournaments: number; newEvents: number }> {
  const concurrency = 5 * apiPool.size
  let newCursor = cursor
  let newTournaments = 0
  let totalNewEvents = 0
  let totalEventsProcessed = processedTournamentIds.size // approximate via tournament count
  let totalPagesConsumed = 0
  let beforeDate: number | undefined = resumeBeforeDate
  if (resumeBeforeDate != null) {
    afterDate = undefined
  }
  let globalOldestStartAt: number | undefined
  let completedNaturally = true

  // Outer loop: slide date window when API caps pagination (10k result limit)
  let windowNum = 0
  outer: while (true) {
    windowNum++
    let windowOldestStartAt: number | undefined

    for (let tPage = 1; ; tPage++) {
      totalPagesConsumed++
      if (totalPagesConsumed > maxPages) { completedNaturally = false; break outer }

      if (shuttingDown) {
        console.log('\nShutdown requested, stopping after current page...')
        completedNaturally = false
        break outer
      }

      const pageLabel = maxPages === Infinity ? `${totalPagesConsumed}` : `${totalPagesConsumed}/${maxPages}`
      console.log(`\nFetching tournament page ${pageLabel}...`)

      let result
      try {
        result = await fetchTournaments(tPage, 20, afterDate, beforeDate)
      } catch (err) {
        console.warn(`  ⚠ Failed to fetch tournament page ${tPage}:`, (err as Error).message?.slice(0, 120))
        continue
      }

      if (!result.nodes || result.nodes.length === 0) {
        console.log('  No more tournaments.')
        break
      }

      if (tPage === 1) {
        const windowLabel = beforeDate
          ? ` (window before ${new Date(beforeDate * 1000).toISOString().split('T')[0]})`
          : ''
        console.log(`  API reports ${result.totalPages} total pages${windowLabel}`)
      }
      if (tPage > result.totalPages) {
        console.log('  Reached last page of window.')
        break
      }

      // Track oldest startAt for date windowing and resume point
      for (const t of result.nodes) {
        if (t.startAt != null) {
          if (windowOldestStartAt == null || t.startAt < windowOldestStartAt) {
            windowOldestStartAt = t.startAt
          }
          if (globalOldestStartAt == null || t.startAt < globalOldestStartAt) {
            globalOldestStartAt = t.startAt
          }
        }
      }

      // Collect new events from this page's tournaments
      const pageEvents: EventInfo[] = []
      let allAlreadyProcessed = true

      for (const tournament of result.nodes) {
        // Track the newest startAt as our cursor
        if (tournament.startAt && tournament.startAt > newCursor) {
          newCursor = tournament.startAt
        }

        if (processedTournamentIds.has(tournament.id)) continue
        allAlreadyProcessed = false

        const ssbuEvents = (tournament.events ?? []).filter(
          (e) => String(e.videogame?.id) === ULTIMATE_ID
            && (e.numEntrants ?? 0) >= minEntrants
            && (!offlineOnly || !e.isOnline),
        )

        if (ssbuEvents.length === 0) {
          // Mark tournament as processed even if no qualifying events
          processedTournamentIds.add(tournament.id)
          continue
        }

        processedTournamentIds.add(tournament.id)
        newTournaments++

        for (const event of ssbuEvents) {
          pageEvents.push({
            eventId: event.id,
            eventName: event.name,
            numEntrants: event.numEntrants ?? 0,
            tournamentId: tournament.id,
            tournamentName: tournament.name,
          })
        }
      }

      if (allAlreadyProcessed && newTournaments > 0 && maxPages !== Infinity && resumeBeforeDate == null) {
        console.log(`[Page ${totalPagesConsumed}] All tournaments already processed — caught up!`)
        break outer
      }

      if (pageEvents.length > 0) {
        let completed = 0
        const pageTotal = pageEvents.length
        totalNewEvents += pageTotal
        console.log(`  ${pageTotal} new event(s) to process`)

        const failedTournamentIds = new Set<string>()
        await processPool(pageEvents, concurrency, async (ev) => {
          if (shuttingDown) {
            failedTournamentIds.add(ev.tournamentId)
            return
          }
          completed++
          const ok = await processEvent(ev, players, completed, pageTotal)
          if (!ok) failedTournamentIds.add(ev.tournamentId)
        })

        // Un-mark failed tournaments so they get retried next run
        for (const id of failedTournamentIds) {
          processedTournamentIds.delete(id)
          newTournaments--
        }
      }

      // Progressive save after each page
      totalEventsProcessed += pageEvents.length
      saveState(players, processedTournamentIds, newCursor, totalEventsProcessed, globalOldestStartAt)

      // Update shutdown callback so Ctrl+C saves immediately
      onShutdown = () => {
        saveState(players, processedTournamentIds, newCursor, totalEventsProcessed, globalOldestStartAt)
        const pc = writePlayersJson(players)
        console.log(`\nStopped! Wrote ${pc} players to players.json`)
        console.log(`  New tournaments: ${newTournaments} | New events: ${totalNewEvents}`)
        console.log(`  Total tracked: ${processedTournamentIds.size} tournaments, ${pc} players`)
        console.log(`  State saved to crawl-state.json`)
      }
    }

    // Slide date window to get past API's pagination cap
    // Only slide when in --all mode and we exhausted the API's reported pages
    if (maxPages !== Infinity) break
    if (!windowOldestStartAt) break
    if (beforeDate != null && windowOldestStartAt >= beforeDate) break // no progress

    beforeDate = windowOldestStartAt
    afterDate = undefined
    console.log(`\nSliding date window → beforeDate: ${new Date(beforeDate * 1000).toISOString().split('T')[0]}`)
  }

  // Final save — keep resume point if interrupted OR if resuming and we saw data
  // (exhausting reported pages in resume mode doesn't mean done — 10k API cap may hide more)
  // Resume point is only cleared when: non-resume run completes, or resume run gets empty first page
  const keepResumePoint = !completedNaturally || (resumeBeforeDate != null && globalOldestStartAt != null)
  saveState(players, processedTournamentIds, newCursor, totalEventsProcessed,
    keepResumePoint ? globalOldestStartAt : undefined)

  // Write final players.json
  const playerCount = writePlayersJson(players)

  const label = shuttingDown ? 'Stopped.' : 'Done!'
  console.log(`\n${label} Wrote ${playerCount} players to players.json`)
  console.log(`  New tournaments: ${newTournaments} | New events: ${totalNewEvents}`)
  console.log(`  Total tracked: ${processedTournamentIds.size} tournaments, ${playerCount} players`)
  console.log(`  State saved to crawl-state.json`)

  onShutdown = null
  return { newCursor, newTournaments, newEvents: totalNewEvents }
}

// ── Main ──

async function main() {
  // Parse CLI args
  const args = process.argv.slice(2)
  const isFresh = args.includes('--fresh')
  const isAll = args.includes('--all')
  const isWatch = args.includes('--watch')
  const offlineOnly = args.includes('--offline')
  const numericArg = args.find(a => !a.startsWith('--') && /^\d+$/.test(a))

  const minEntrantsIdx = args.indexOf('--min-entrants')
  const minEntrants = minEntrantsIdx !== -1 ? parseInt(args[minEntrantsIdx + 1] ?? '1', 10) : 1

  const maxPages = isAll ? Infinity : parseInt(numericArg ?? '50', 10)
  const watchInterval = isWatch ? parseInt(numericArg ?? '30', 10) : 0

  // Set up graceful shutdown
  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => {
      if (shuttingDown) process.exit(1) // force on double signal
      shuttingDown = true
      if (onShutdown) {
        onShutdown()
        process.exit(0)
      }
    })
  }

  // Load or initialize state
  const state = isFresh ? null : loadState()
  const players = state ? hydratePlayersFromState(state) : new Map<string, PlayerData>()
  const processedTournamentIds = state ? new Set(state.processedTournamentIds) : new Set<string>()
  let cursor = state?.cursor ?? 0
  let afterDate = cursor > 0 ? cursor - CURSOR_BUFFER_SECONDS : undefined
  let resumeBeforeDate = state?.resumeBeforeDate

  // Log startup info
  console.log(`Using ${apiPool.size} API key(s) (~${(apiPool.size * 1.3).toFixed(1)} req/s)`)

  if (state) {
    console.log(`Resuming from state (${processedTournamentIds.size} tournaments, ${players.size} players)`)
    console.log(`  Last run: ${state.lastRunAt}`)
    if (resumeBeforeDate) {
      const resumeDate = new Date(resumeBeforeDate * 1000).toISOString().split('T')[0]
      console.log(`  Continuing from ${resumeDate}`)
    } else if (afterDate) {
      const cursorDate = new Date(cursor * 1000).toISOString().split('T')[0]
      const afterDateStr = new Date(afterDate * 1000).toISOString().split('T')[0]
      console.log(`  Cursor: ${cursorDate} (afterDate: ${afterDateStr}, 7d buffer)`)
    }
  } else if (isFresh) {
    console.log('Starting fresh (--fresh flag)')
  }

  const modeLabel = isAll ? 'all pages' : `max ${maxPages} pages`
  const modeType = state && !isFresh ? 'incremental' : 'full'
  const filters = [
    offlineOnly ? 'offline only' : null,
    minEntrants > 1 ? `min ${minEntrants} entrants` : null,
  ].filter(Boolean)
  console.log(`Mode: ${modeType}, ${modeLabel}${isWatch ? `, watch every ${watchInterval}min` : ''}${filters.length > 0 ? ` [${filters.join(', ')}]` : ''}`)

  // Main loop (runs once unless --watch)
  while (true) {
    shuttingDown = false // reset for each cycle in watch mode

    const result = await crawlCycle(players, processedTournamentIds, cursor, maxPages, afterDate, resumeBeforeDate, offlineOnly, minEntrants)

    // Update cursor for next cycle
    if (result.newCursor > cursor) {
      cursor = result.newCursor
      afterDate = cursor - CURSOR_BUFFER_SECONDS
    }
    resumeBeforeDate = undefined // next watch cycle starts fresh

    if (!isWatch || shuttingDown) break

    console.log(`\nSleeping ${watchInterval} minutes until next cycle...`)
    await new Promise(r => setTimeout(r, watchInterval * 60 * 1000))

    if (shuttingDown) break
  }
}

main().catch((err) => {
  console.error('Crawl failed:', err)
  process.exit(1)
})
