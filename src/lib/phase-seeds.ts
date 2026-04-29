import { graphql } from '../gql'
import { graphqlClient } from './graphql-client'
import { PAGINATION } from './constants'

export const phaseSeedsQuery = graphql(`
  query PhaseSeeds($phaseId: ID!, $page: Int!, $perPage: Int!) {
    phase(id: $phaseId) {
      seeds(query: { page: $page, perPage: $perPage }) {
        pageInfo {
          total
          totalPages
        }
        nodes {
          id
          seedNum
          progressionSeedId
          placeholderName
          phaseGroup {
            id
            displayIdentifier
          }
          progressionSource {
            id
            originPhase { id name }
          }
          entrant {
            id
            name
            initialSeedNum
            participants {
              id
              gamerTag
              prefix
              player { id }
            }
          }
        }
      }
    }
  }
`)

export const phaseSeedsQueryKey = (phaseId: string) =>
  ['phaseSeeds', phaseId] as const

export async function fetchPhaseSeeds(
  phaseId: string,
  perPage: number = PAGINATION.CROSS_PHASE_SEEDS,
) {
  const firstPage = await graphqlClient.request(phaseSeedsQuery, {
    phaseId,
    page: 1,
    perPage,
  })

  const allNodes = [...(firstPage.phase?.seeds?.nodes ?? [])]
  const totalPages = firstPage.phase?.seeds?.pageInfo?.totalPages ?? 1

  if (totalPages > 1) {
    const remaining = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        graphqlClient.request(phaseSeedsQuery, {
          phaseId,
          page: i + 2,
          perPage,
        }),
      ),
    )
    for (const r of remaining) {
      allNodes.push(...(r.phase?.seeds?.nodes ?? []))
    }
  }

  return allNodes
}

export type PhaseSeedNode = NonNullable<
  Awaited<ReturnType<typeof fetchPhaseSeeds>>[number]
>
