import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useOpponentStats } from '../../hooks/use-opponent-stats'
import { useCharacters } from '../../hooks/use-characters'
import { buildCharacterMap } from '../../lib/character-utils'
import {
  computeWinRate,
  computeAverageSeed,
  computeCharacterUsage,
} from '../../lib/stats-utils'
import { formatWinRate } from '../../lib/format'
import { StatBlock } from '../StatBlock/StatBlock'
import { CharacterBar } from '../CharacterBar/CharacterBar'
import { PlacementList } from '../PlacementList/PlacementList'
import { Skeleton } from '../Skeleton/Skeleton'
import styles from './OpponentCard.module.css'

const ULTIMATE_VIDEOGAME_ID = '1386'

interface OpponentCardProps {
  name: string
  playerId: string | null
  setResult?: string | null
  roundText?: string | null
  won?: boolean
  headToHead?: { wins: number; losses: number }
  seedNum?: number | null
  isTBD?: boolean
}

export function OpponentCard({
  name,
  playerId,
  setResult,
  roundText,
  won,
  headToHead,
  seedNum,
  isTBD,
}: OpponentCardProps) {
  const [expanded, setExpanded] = useState(false)
  const { data: statsData, isLoading: statsLoading } = useOpponentStats(
    playerId ?? undefined,
    expanded,
    ULTIMATE_VIDEOGAME_ID,
  )
  const { data: charData } = useCharacters(
    expanded ? ULTIMATE_VIDEOGAME_ID : undefined,
  )

  const characterMap = buildCharacterMap(charData?.videogame?.characters)
  const player = statsData?.player
  const sets = player?.sets?.nodes ?? []
  const standings = player?.recentStandings ?? []

  const validSets = sets
    .filter((s): s is NonNullable<typeof s> => s != null)
    .filter((s) => String(s.event?.videogame?.id) === ULTIMATE_VIDEOGAME_ID)
  const winRate = player
    ? computeWinRate(validSets, player.id!)
    : null
  const avgSeed = standings.length > 0
    ? computeAverageSeed(standings.filter((s): s is NonNullable<typeof s> => s != null))
    : null
  const charUsage = player
    ? computeCharacterUsage(validSets, player.id!).filter(
        (c) => characterMap.size === 0 || characterMap.has(c.characterId),
      )
    : []

  const placements = standings
    .filter((s): s is NonNullable<typeof s> => s != null)
    .filter((s) => s.placement != null && s.container)
    .map((s) => ({
      placement: s.placement!,
      eventName: (s.container as { name?: string })?.name ?? '',
      tournamentName:
        (s.container as { tournament?: { name?: string } })?.tournament?.name ?? '',
      numEntrants: (s.container as { numEntrants?: number })?.numEntrants,
    }))

  return (
    <div className={`${styles.card} ${isTBD ? styles.cardTBD : ''}`}>
      <button
        className={styles.header}
        onClick={() => !isTBD && playerId && setExpanded(!expanded)}
        disabled={isTBD || !playerId}
      >
        <div className={styles.headerLeft}>
          <span
            className={`${styles.resultDot} ${won === true ? styles.win : won === false ? styles.loss : ''} ${isTBD ? styles.dotTBD : ''}`}
          />
          {playerId ? (
            <Link
              to="/player/$playerId"
              params={{ playerId }}
              search={{}}
              className={styles.nameLink}
              onClick={(e) => e.stopPropagation()}
            >
              {name}
            </Link>
          ) : (
            <span className={styles.name}>{name}</span>
          )}
          {seedNum != null && (
            <span className={styles.seed}>#{seedNum}</span>
          )}
          {headToHead && (headToHead.wins > 0 || headToHead.losses > 0) && (
            <span className={styles.h2h}>
              H2H: {headToHead.wins}-{headToHead.losses}
            </span>
          )}
        </div>
        <div className={styles.headerRight}>
          {roundText && <span className={styles.round}>{roundText}</span>}
          {setResult && <span className={styles.score}>{setResult}</span>}
          {!isTBD && playerId && (
            <span className={styles.chevron}>{expanded ? '\u25B2' : '\u25BC'}</span>
          )}
        </div>
      </button>

      {expanded && (
        <div className={styles.details}>
          {statsLoading ? (
            <div className={styles.loading}>
              <Skeleton width="100%" height={60} borderRadius={6} />
              <Skeleton width="100%" height={40} borderRadius={6} />
            </div>
          ) : player ? (
            <>
              <div className={styles.stats}>
                {winRate && (
                  <StatBlock
                    label="Win Rate"
                    value={formatWinRate(winRate.wins, winRate.losses)}
                  />
                )}
                {avgSeed != null && avgSeed > 0 && (
                  <StatBlock
                    label="Avg Placement"
                    value={avgSeed.toFixed(1)}
                  />
                )}
              </div>
              {charUsage.length > 0 && (
                <div className={styles.characters}>
                  <span className={styles.detailLabel}>Characters</span>
                  <CharacterBar usage={charUsage} characterMap={characterMap} />
                </div>
              )}
              {placements.length > 0 && (
                <div className={styles.placements}>
                  <span className={styles.detailLabel}>Recent Placements</span>
                  <PlacementList placements={placements.slice(0, 8)} />
                </div>
              )}
            </>
          ) : (
            <p className={styles.noData}>No stats available</p>
          )}
        </div>
      )}
    </div>
  )
}
