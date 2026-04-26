import type { UserTournamentsQuery } from '../gql/graphql'

type TournamentNode = NonNullable<
  NonNullable<
    NonNullable<UserTournamentsQuery['user']>['tournaments']
  >['nodes']
>[number]

export type Tournament = NonNullable<TournamentNode>

interface CategorizedTournaments {
  upcoming: Tournament[]
  current: Tournament[]
  past: Tournament[]
}

export interface TournamentLiveness {
  kind: 'live' | 'soon'
  label: string
}

const SOON_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

/** Returns liveness info if happening now or starting within 7 days, else null. */
export function getTournamentLiveness(
  startAt: number | null | undefined,
  endAt: number | null | undefined,
): TournamentLiveness | null {
  if (!startAt || !endAt) return null
  const now = Date.now()
  const startMs = startAt * 1000
  const endMs = endAt * 1000

  if (now >= startMs && now <= endMs) return { kind: 'live', label: 'LIVE' }
  if (startMs > now && startMs - now <= SOON_THRESHOLD_MS) {
    const hours = Math.ceil((startMs - now) / (1000 * 60 * 60))
    if (hours <= 24) return { kind: 'soon', label: `IN ${hours}H` }
    const days = Math.ceil((startMs - now) / (1000 * 60 * 60 * 24))
    return { kind: 'soon', label: `IN ${days}D` }
  }
  return null
}

export function categorizeTournaments(
  tournaments: Array<TournamentNode>,
): CategorizedTournaments {
  const now = Date.now() / 1000

  const result: CategorizedTournaments = {
    upcoming: [],
    current: [],
    past: [],
  }

  for (const t of tournaments) {
    if (!t) continue
    const start = t.startAt ?? 0
    const end = t.endAt ?? 0

    if (now < start) {
      result.upcoming.push(t)
    } else if (now >= start && now <= end) {
      result.current.push(t)
    } else {
      result.past.push(t)
    }
  }

  return result
}
