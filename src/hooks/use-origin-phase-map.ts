import { useQuery } from '@tanstack/react-query'
import { graphql } from '../gql'
import { graphqlClient } from '../lib/graphql-client'

const originPhaseSeedsQuery = graphql(`
  query OriginPhaseSeeds($phaseId: ID!, $page: Int!, $perPage: Int!) {
    phase(id: $phaseId) {
      id
      seeds(query: { page: $page, perPage: $perPage }) {
        pageInfo {
          totalPages
        }
        nodes {
          entrant {
            id
          }
          phaseGroup {
            id
            displayIdentifier
          }
        }
      }
    }
  }
`)

export interface OriginPhaseGroupInfo {
  id: string
  displayIdentifier: string | null
}

/**
 * Fetches origin phase seeds and builds entrant ID → phaseGroup mapping.
 * Used to show which pool/bracket each entrant came from in source nav nodes.
 */
export function useOriginPhaseMap(originPhaseId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['originPhaseMap', originPhaseId],
    queryFn: async (): Promise<Map<string, OriginPhaseGroupInfo>> => {
      if (!originPhaseId) return new Map()

      const perPage = 100
      const firstPage = await graphqlClient.request(originPhaseSeedsQuery, {
        phaseId: originPhaseId,
        page: 1,
        perPage,
      })

      const allNodes = [...(firstPage.phase?.seeds?.nodes ?? [])]
      const totalPages = firstPage.phase?.seeds?.pageInfo?.totalPages ?? 1

      if (totalPages > 1) {
        const remaining = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) =>
            graphqlClient.request(originPhaseSeedsQuery, {
              phaseId: originPhaseId,
              page: i + 2,
              perPage,
            })
          )
        )
        for (const r of remaining) {
          allNodes.push(...(r.phase?.seeds?.nodes ?? []))
        }
      }

      const map = new Map<string, OriginPhaseGroupInfo>()
      for (const node of allNodes) {
        if (!node?.entrant?.id || !node.phaseGroup?.id) continue
        map.set(String(node.entrant.id), {
          id: String(node.phaseGroup.id),
          displayIdentifier: node.phaseGroup.displayIdentifier ?? null,
        })
      }
      return map
    },
    enabled: enabled && originPhaseId != null,
    staleTime: 5 * 60 * 1000,
  })
}
