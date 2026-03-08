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
