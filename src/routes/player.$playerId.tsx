import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useOpponentStats } from '../hooks/use-opponent-stats'
import { useCharacters } from '../hooks/use-characters'
import { buildCharacterMap } from '../lib/character-utils'
import {
  computeWinRate,
  computeAverageSeed,
  computeCharacterUsage,
} from '../lib/stats-utils'
import { formatWinRate } from '../lib/format'
import { StatBlock } from '../components/StatBlock/StatBlock'
import { CharacterBar } from '../components/CharacterBar/CharacterBar'
import { PlacementList } from '../components/PlacementList/PlacementList'
import { Skeleton } from '../components/Skeleton/Skeleton'
import { ErrorMessage } from '../components/ErrorMessage/ErrorMessage'
import styles from './player.$playerId.module.css'

const ULTIMATE_VIDEOGAME_ID = '1386'

export const Route = createFileRoute('/player/$playerId')({
  component: PlayerPage,
})

function PlayerPage() {
  const { playerId } = Route.useParams()
  const router = useRouter()
  const { data, isLoading, isError, error, refetch } = useOpponentStats(playerId, true, ULTIMATE_VIDEOGAME_ID)
  const { data: charData } = useCharacters(ULTIMATE_VIDEOGAME_ID)

  if (isLoading) {
    return (
      <div className={styles.container}>
        <Skeleton width="40%" height={36} borderRadius={8} />
        <Skeleton width="100%" height={80} borderRadius={8} />
        <Skeleton width="100%" height={120} borderRadius={8} />
      </div>
    )
  }

  if (isError) {
    return (
      <ErrorMessage
        message={error instanceof Error ? error.message : 'Failed to load player'}
        onRetry={() => refetch()}
      />
    )
  }

  const player = data?.player
  if (!player) {
    return <ErrorMessage message="Player not found" />
  }

  const characterMap = buildCharacterMap(charData?.videogame?.characters)
  const sets = player.sets?.nodes ?? []
  const standings = player.recentStandings ?? []

  const validSets = sets
    .filter((s): s is NonNullable<typeof s> => s != null)
    .filter((s) => String(s.event?.videogame?.id) === ULTIMATE_VIDEOGAME_ID)
  const validStandings = standings.filter((s): s is NonNullable<typeof s> => s != null)

  const winRate = computeWinRate(validSets, player.id!)
  const avgSeed = validStandings.length > 0 ? computeAverageSeed(validStandings) : null
  const charUsage = computeCharacterUsage(validSets, player.id!).filter(
    (c) => characterMap.size === 0 || characterMap.has(c.characterId),
  )

  const placements = validStandings
    .filter((s) => s.placement != null && s.container)
    .map((s) => ({
      placement: s.placement!,
      eventName: (s.container as { name?: string })?.name ?? '',
      tournamentName:
        (s.container as { tournament?: { name?: string } })?.tournament?.name ?? '',
      numEntrants: (s.container as { numEntrants?: number })?.numEntrants,
    }))

  return (
    <div className={styles.container}>
      <button className={styles.backLink} onClick={() => router.history.back()}>
        &larr; Back
      </button>

      <div className={styles.playerHeader}>
        <h2 className={styles.gamerTag}>{player.gamerTag}</h2>
      </div>

      <div className={styles.statsGrid}>
        <StatBlock
          label="Win Rate"
          value={formatWinRate(winRate.wins, winRate.losses)}
        />
        {avgSeed != null && avgSeed > 0 && (
          <StatBlock label="Avg Placement" value={avgSeed.toFixed(1)} />
        )}
      </div>

      {charUsage.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Characters</h3>
          <CharacterBar usage={charUsage} characterMap={characterMap} />
        </div>
      )}

      {placements.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Recent Placements</h3>
          <PlacementList placements={placements} />
        </div>
      )}
    </div>
  )
}
