export interface OriginSeedEntrant {
  id: string
  name: string
  seedNum: number | null
}

export interface ParsedPlaceholder {
  groupId: string
  path: 'Winners' | 'Losers'
}

interface DestSeed {
  seedNum: number
  placeholderName: string | null
}

interface OriginSeed {
  id?: string | number
  seedNum: number
  groupDisplayId: string | null
  entrant: OriginSeedEntrant | null
}

/**
 * Map origin phase entrants to destination seed numbers using progressionSeedId.
 *
 * Each destination seed may have a `progressionSeedId` that directly references
 * the origin seed's `id`. This is the most reliable mapping — no parsing needed.
 */
export function mapSeedsByProgressionId(
  destSeeds: Array<{ seedNum: number; progressionSeedId: number | null }>,
  originSeeds: Array<{ id: string | number; entrant: OriginSeedEntrant | null }>,
): Map<number, OriginSeedEntrant> {
  const result = new Map<number, OriginSeedEntrant>()

  // Build lookup from origin seed id → entrant
  const originById = new Map<number, OriginSeedEntrant>()
  for (const os of originSeeds) {
    if (os.entrant) {
      originById.set(Number(os.id), os.entrant)
    }
  }

  for (const ds of destSeeds) {
    if (ds.progressionSeedId == null) continue
    const entrant = originById.get(ds.progressionSeedId)
    if (entrant) {
      result.set(ds.seedNum, entrant)
    }
  }

  return result
}

/**
 * Parse a placeholder name like "予選 1: Winners" or "TOP64 1: Losers"
 * into { groupId: "1", path: "Winners" }.
 * Returns null if the format doesn't match.
 */
export function parsePlaceholderName(name: string | null | undefined): ParsedPlaceholder | null {
  if (!name) return null
  const match = name.match(/\s(\S+):\s*(Winners|Losers)\s*$/)
  if (!match) return null
  return { groupId: match[1], path: match[2] as 'Winners' | 'Losers' }
}

/**
 * Map origin phase entrants to destination seed numbers using placeholderName data.
 *
 * For each destination seed, placeholderName tells us which origin group and bracket
 * path (Winners/Losers) it expects to receive from. We group destination seeds by
 * (groupId, path), then assign origin seeds from the matching group in seed order.
 *
 * Within each origin group:
 * - Top W seeds → "Winners" destination slots
 * - Next L seeds → "Losers" destination slots
 * (where W = count of "Winners" dest seeds for that group, L = count of "Losers")
 */
export function mapSeedsByPlaceholder(
  destSeeds: DestSeed[],
  originSeeds: OriginSeed[],
): Map<number, OriginSeedEntrant> {
  const result = new Map<number, OriginSeedEntrant>()

  // Parse destination seeds and group by (groupId, path)
  const destByGroupPath = new Map<string, Array<{ seedNum: number; parsed: ParsedPlaceholder }>>()
  for (const ds of destSeeds) {
    const parsed = parsePlaceholderName(ds.placeholderName)
    if (!parsed) continue
    const key = `${parsed.groupId}:${parsed.path}`
    if (!destByGroupPath.has(key)) destByGroupPath.set(key, [])
    destByGroupPath.get(key)!.push({ seedNum: ds.seedNum, parsed })
  }

  // Sort each dest group by seedNum ascending
  for (const group of destByGroupPath.values()) {
    group.sort((a, b) => a.seedNum - b.seedNum)
  }

  // Group origin seeds by their phase group display identifier, sorted by seedNum
  const originByGroup = new Map<string, OriginSeed[]>()
  for (const os of originSeeds) {
    if (!os.groupDisplayId) continue
    if (!originByGroup.has(os.groupDisplayId)) originByGroup.set(os.groupDisplayId, [])
    originByGroup.get(os.groupDisplayId)!.push(os)
  }
  for (const group of originByGroup.values()) {
    group.sort((a, b) => a.seedNum - b.seedNum)
  }

  // For each origin group, split into Winners (top W) and Losers (next L)
  for (const [groupId, originGroup] of originByGroup) {
    const winnersKey = `${groupId}:Winners`
    const losersKey = `${groupId}:Losers`
    const winnersSlots = destByGroupPath.get(winnersKey) ?? []
    const losersSlots = destByGroupPath.get(losersKey) ?? []

    const wCount = winnersSlots.length
    const lCount = losersSlots.length

    // Top wCount origin seeds → Winners slots
    for (let i = 0; i < wCount && i < originGroup.length; i++) {
      const entrant = originGroup[i].entrant
      if (entrant) {
        result.set(winnersSlots[i].seedNum, entrant)
      }
    }

    // Next lCount origin seeds → Losers slots
    for (let i = 0; i < lCount && wCount + i < originGroup.length; i++) {
      const entrant = originGroup[wCount + i].entrant
      if (entrant) {
        result.set(losersSlots[i].seedNum, entrant)
      }
    }
  }

  return result
}
