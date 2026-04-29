import { useQuery } from '@tanstack/react-query'
import { fetchPhaseSeeds, phaseSeedsQueryKey } from '../lib/phase-seeds'
import { STALE_TIME_MS } from '../lib/constants'

export interface OriginPhaseGroupInfo {
  id: string
  displayIdentifier: string | null
}

/**
 * Fetches origin phase seeds and builds entrant ID → phaseGroup mapping.
 * Used to show which pool/bracket each entrant came from in source nav nodes.
 *
 * Shares its `phaseSeeds` query/cache with `useCrossPhaseOverrides` so the
 * origin phase's seeds are fetched at most once per page load even when both
 * hooks are active.
 */
export function useOriginPhaseMap(originPhaseId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: originPhaseId ? phaseSeedsQueryKey(originPhaseId) : ['phaseSeeds', 'disabled'] as const,
    queryFn: () => fetchPhaseSeeds(originPhaseId!),
    enabled: enabled && originPhaseId != null,
    staleTime: STALE_TIME_MS.BRACKET,
    select: (nodes): Map<string, OriginPhaseGroupInfo> => {
      const map = new Map<string, OriginPhaseGroupInfo>()
      for (const node of nodes) {
        if (!node?.entrant?.id || !node.phaseGroup?.id) continue
        map.set(String(node.entrant.id), {
          id: String(node.phaseGroup.id),
          displayIdentifier: node.phaseGroup.displayIdentifier ?? null,
        })
      }
      return map
    },
  })
}
