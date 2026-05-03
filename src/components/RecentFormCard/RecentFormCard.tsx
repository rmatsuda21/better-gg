import { useMemo } from 'react'
import { useAuth } from '../../hooks/use-auth'
import { usePlayerSets } from '../../hooks/use-player-sets'
import { usePlayerRecentEvents } from '../../hooks/use-player-recent-events'
import { useCharacters } from '../../hooks/use-characters'
import { computeWinRate, computeCharacterUsage } from '../../lib/stats-utils'
import { buildPlacementsFromEvents } from '../../lib/placement-utils'
import { buildCharacterMap, getCharacterStockIcon } from '../../lib/character-utils'
import { formatWinRate, formatPlacement } from '../../lib/format'
import { ULTIMATE_VIDEOGAME_ID, ALL_SMASH_VIDEOGAME_IDS, isSmashGame } from '../../lib/smash-games'
import { StatBlock } from '../StatBlock/StatBlock'
import { Skeleton } from '../Skeleton/Skeleton'
import styles from './RecentFormCard.module.css'

interface RecentFormCardProps {
  playerId: string
}

export function RecentFormCard({ playerId }: RecentFormCardProps) {
  const { user: authUser } = useAuth()
  const userId = authUser?.id ?? undefined
  const setsQuery = usePlayerSets(playerId, 1)
  const recentEventsQuery = usePlayerRecentEvents(playerId, userId, ALL_SMASH_VIDEOGAME_IDS)
  const { data: charData } = useCharacters(ULTIMATE_VIDEOGAME_ID)

  const characterMap = useMemo(
    () => buildCharacterMap(charData?.videogame?.characters),
    [charData?.videogame?.characters],
  )

  const validSets = useMemo(() => {
    const firstPage = setsQuery.data?.pages?.[0]
    const nodes = firstPage?.player?.sets?.nodes ?? []
    return nodes
      .filter((s): s is NonNullable<typeof s> => s != null)
      .filter((s) => isSmashGame(s.event?.videogame?.id))
  }, [setsQuery.data?.pages])

  const winRate = useMemo(() => {
    if (validSets.length === 0) return null
    return computeWinRate(validSets, playerId)
  }, [validSets, playerId])

  const topCharacter = useMemo(() => {
    if (validSets.length === 0) return null
    const usage = computeCharacterUsage(validSets, playerId).filter(
      (c) => characterMap.size === 0 || characterMap.has(c.characterId),
    )
    return usage[0] ?? null
  }, [validSets, playerId, characterMap])

  const last5Placements = useMemo(() => {
    const pages = recentEventsQuery.data?.pages
    if (!pages || pages.length === 0) return []
    return buildPlacementsFromEvents([pages[0]], playerId).slice(0, 5)
  }, [recentEventsQuery.data?.pages, playerId])

  const setsLoading = setsQuery.isLoading && !setsQuery.data
  const eventsLoading = recentEventsQuery.isLoading && !recentEventsQuery.data
  const isEmpty =
    !setsLoading && !eventsLoading && validSets.length === 0 && last5Placements.length === 0

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.title}>Your Recent Form</h3>
      </div>

      {isEmpty ? (
        <p className={styles.empty}>Play a tournament to see your form.</p>
      ) : (
        <>
          <div className={styles.stats}>
            {setsLoading ? (
              <>
                <Skeleton width={110} height={56} borderRadius={6} />
                <Skeleton width={140} height={56} borderRadius={6} />
              </>
            ) : (
              <>
                <StatBlock
                  label="Set Win Rate"
                  value={winRate ? formatWinRate(winRate.wins, winRate.losses) : 'N/A'}
                />
                <div className={styles.charBlock}>
                  {topCharacter ? (
                    <>
                      <img
                        src={getCharacterStockIcon(topCharacter.characterId)}
                        alt=""
                        className={styles.charIcon}
                      />
                      <div className={styles.charInfo}>
                        <span className={styles.charValue}>
                          {characterMap.get(topCharacter.characterId) ?? `#${topCharacter.characterId}`}
                        </span>
                        <span className={styles.charLabel}>
                          Most Used · {Math.round(topCharacter.percentage * 100)}%
                        </span>
                      </div>
                    </>
                  ) : (
                    <StatBlock label="Most Used" value="—" />
                  )}
                </div>
              </>
            )}
          </div>

          <div className={styles.placementsWrap}>
            <span className={styles.placementsLabel}>Last 5 Placements</span>
            <div className={styles.placements}>
              {eventsLoading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} width={36} height={22} borderRadius={4} />
                ))
              ) : last5Placements.length > 0 ? (
                last5Placements.map((p, i) => (
                  <span
                    key={p.eventId ?? i}
                    className={`${styles.chip} ${
                      p.placement === 1
                        ? styles.chipGold
                        : p.placement <= 3
                          ? styles.chipBronze
                          : p.placement <= 8
                            ? styles.chipTop8
                            : ''
                    }`}
                    title={`${p.tournamentName} — ${p.eventName}`}
                  >
                    {formatPlacement(p.placement)}
                  </span>
                ))
              ) : (
                <span className={styles.noPlacements}>No recent placements</span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
