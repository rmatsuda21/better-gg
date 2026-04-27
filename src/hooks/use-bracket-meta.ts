import { useQuery } from '@tanstack/react-query'
import { graphql } from '../gql'
import { graphqlClient } from '../lib/graphql-client'
import type { SiblingPhaseInfo } from '../lib/bracket-utils'
import { STALE_TIME_MS } from '../lib/constants'

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
        type
        state
        phases {
          id
          name
          phaseOrder
          groupCount
        }
      }
      phaseGroups(query: { page: 1, perPage: 100 }) {
        nodes {
          id
          displayIdentifier
        }
      }
      progressingInData {
        origin
        numProgressing
      }
      seeds(query: { page: 1, perPage: 100 }) {
        nodes {
          entrant { id }
          phaseGroup { id }
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
  isTeamEvent: boolean
  currentPhaseOrder: number | null
  siblingPhases: SiblingPhaseInfo[]
  phaseGroupNodes: Array<{ id: string; displayIdentifier: string | null }>
  originPhaseIds: string[]
  entrantPgMap: Map<string, string>
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
        .map(p => ({ id: String(p.id!), name: p.name!, phaseOrder: p.phaseOrder!, groupCount: p.groupCount ?? null }))

      const phaseGroupNodes = (phase.phaseGroups?.nodes ?? [])
        .filter((pg): pg is NonNullable<typeof pg> => pg != null && pg.id != null)
        .map(pg => ({ id: String(pg.id!), displayIdentifier: pg.displayIdentifier ?? null }))

      // Build entrant → phaseGroup mapping from seeds
      const entrantPgMap = new Map<string, string>()
      for (const seed of phase.seeds?.nodes ?? []) {
        if (seed?.entrant?.id != null && seed?.phaseGroup?.id != null) {
          entrantPgMap.set(String(seed.entrant.id), String(seed.phaseGroup.id))
        }
      }

      return {
        phaseName: phase.name ?? null,
        bracketType: phase.bracketType ?? null,
        phaseState: phase.state ?? null,
        eventState: phase.event?.state ?? null,
        eventId: phase.event?.id ? String(phase.event.id) : null,
        isTeamEvent: phase.event?.type === 5,
        currentPhaseOrder: phase.phaseOrder ?? null,
        siblingPhases,
        phaseGroupNodes,
        originPhaseIds,
        entrantPgMap,
      }
    },
    enabled: !!phaseId,
    staleTime: STALE_TIME_MS.DEFAULT,
  })
}
