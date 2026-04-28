import type { PlacementEntry } from '../components/PlacementList/PlacementList'
import type { OnlineFilter } from '../components/FilterToggle/FilterToggle'

interface RecentEventsPage {
  player?: {
    user?: {
      tournaments?: {
        nodes?: Array<{
          name?: string | null
          startAt?: unknown
          isOnline?: boolean | null
          events?: Array<{
            id?: string | null
            name?: string | null
            numEntrants?: number | null
            userEntrant?: {
              standing?: { placement?: number | null } | null
            } | null
          } | null> | null
        } | null> | null
      } | null
    } | null
  } | null
}

export function buildPlacementsFromEvents(
  pages: RecentEventsPage[],
  playerId: string,
  onlineFilter: OnlineFilter = 'all',
  perEventChars?: Map<string, number[]>,
): PlacementEntry[] {
  const entries: PlacementEntry[] = []

  for (const page of pages) {
    const tournaments = page?.player?.user?.tournaments?.nodes ?? []
    for (const tournament of tournaments) {
      if (!tournament) continue
      if (onlineFilter === 'online' && !tournament.isOnline) continue
      if (onlineFilter === 'offline' && tournament.isOnline) continue
      for (const event of tournament.events ?? []) {
        if (!event) continue
        const placement = event.userEntrant?.standing?.placement
        if (placement == null) continue
        entries.push({
          placement,
          eventName: event.name ?? '',
          tournamentName: tournament.name ?? '',
          numEntrants: event.numEntrants,
          eventId: event.id ?? null,
          playerId,
          characterIds: event.id ? perEventChars?.get(event.id) : undefined,
        })
      }
    }
  }

  return entries
}
