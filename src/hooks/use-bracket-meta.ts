import { useQuery } from '@tanstack/react-query'
import { graphql } from '../gql'
import { graphqlClient } from '../lib/graphql-client'
import type { SiblingPhaseInfo } from '../lib/bracket-utils'

const bracketMetaQuery = graphql(`
  query PhaseBracketMeta($phaseId: ID!) {
    phase(id: $phaseId) {
      id
      name
      phaseOrder
      bracketType
      state
      event {
        id
        state
        phases {
          id
          name
          phaseOrder
        }
      }
      phaseGroups {
        nodes {
          id
          displayIdentifier
        }
      }
      progressingInData {
        origin
        numProgressing
      }
      seeds(query: { page: 1, perPage: 5 }) {
        nodes {
          progressionSource {
            originPhase { id name }
          }
        }
      }
    }
  }
`)

export interface BracketMeta {
  phaseName: string | null
  bracketType: string | null
  phaseState: string | null
  eventState: string | null
  eventId: string | null
  currentPhaseOrder: number | null
  siblingPhases: SiblingPhaseInfo[]
  phaseGroupNodes: Array<{ id: string; displayIdentifier: string | null }>
  originPhaseIds: string[]
}

export function useBracketMeta(phaseId: string) {
  return useQuery({
    queryKey: ['bracketMeta', phaseId],
    queryFn: async (): Promise<BracketMeta> => {
      const meta = await graphqlClient.request(bracketMetaQuery, { phaseId })
      const phase = meta.phase
      if (!phase) throw new Error('Phase not found')

      const originPhaseIds: string[] = (phase.progressingInData ?? [])
        .filter((d): d is NonNullable<typeof d> => d != null && d.origin != null)
        .map(d => String(d.origin!))

      // Fallback: use seeds' progressionSource when progressingInData is empty
      if (originPhaseIds.length === 0) {
        const seedOrigin = (phase.seeds?.nodes ?? [])
          .find(s => s?.progressionSource?.originPhase?.id != null)
          ?.progressionSource?.originPhase
        if (seedOrigin) {
          originPhaseIds.push(String(seedOrigin.id))
        }
      }

      const siblingPhases: SiblingPhaseInfo[] = (phase.event?.phases ?? [])
        .filter((p): p is NonNullable<typeof p> => p != null && p.id != null && p.name != null && p.phaseOrder != null)
        .map(p => ({ id: String(p.id!), name: p.name!, phaseOrder: p.phaseOrder! }))

      const phaseGroupNodes = (phase.phaseGroups?.nodes ?? [])
        .filter((pg): pg is NonNullable<typeof pg> => pg != null && pg.id != null)
        .map(pg => ({ id: pg.id!, displayIdentifier: pg.displayIdentifier ?? null }))

      return {
        phaseName: phase.name ?? null,
        bracketType: phase.bracketType ?? null,
        phaseState: phase.state ?? null,
        eventState: phase.event?.state ?? null,
        eventId: phase.event?.id ? String(phase.event.id) : null,
        currentPhaseOrder: phase.phaseOrder ?? null,
        siblingPhases,
        phaseGroupNodes,
        originPhaseIds,
      }
    },
    enabled: !!phaseId,
    staleTime: 5 * 60 * 1000,
  })
}
