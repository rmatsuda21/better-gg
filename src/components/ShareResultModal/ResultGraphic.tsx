import { forwardRef } from 'react'
import { getCharacterStockIcon } from '../../lib/character-utils'
import { formatPlacement } from '../../lib/format'
import styles from './ResultGraphic.module.css'

export interface SetSummary {
  opponentName: string
  isWin: boolean
  isDQ: boolean
  score: string // e.g. "3-1"
  fullRoundText: string | null
  upsetFactor: number | null
}

export interface CharacterEntry {
  characterId: number
  characterName: string
  percentage: number
}

interface ResultGraphicProps {
  tournamentName: string
  eventName: string
  tournamentLogo: string | null
  dateRange: string
  location: string
  numEntrants: number
  isOnline: boolean
  playerTag: string
  placement: number | null
  seed: number | null
  wins: number
  losses: number
  sets: SetSummary[]
  characters: CharacterEntry[]
}

function getPlacementColor(placement: number): string {
  if (placement === 1) return '#fbbf24' // gold
  if (placement === 2) return '#94a3b8' // silver
  if (placement === 3) return '#d97706' // bronze
  return '#6366f1' // accent
}

export const ResultGraphic = forwardRef<HTMLDivElement, ResultGraphicProps>(
  function ResultGraphic(props, ref) {
    const {
      tournamentName,
      eventName,
      tournamentLogo,
      dateRange,
      location,
      numEntrants,
      isOnline,
      playerTag,
      placement,
      seed,
      wins,
      losses,
      sets,
      characters,
    } = props

    const placementColor = placement ? getPlacementColor(placement) : '#6366f1'

    return (
      <div ref={ref} className={styles.graphic}>
        {/* Gradient top border */}
        <div className={styles.topBorder} />

        <div className={styles.content}>
          {/* Compact header: tournament info + placement/record */}
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              {tournamentLogo ? (
                <img
                  src={tournamentLogo}
                  alt=""
                  className={styles.logo}
                />
              ) : (
                <div className={styles.logoPlaceholder} />
              )}
              <div className={styles.tournamentText}>
                <div className={styles.tournamentName}>{tournamentName}</div>
                <div className={styles.eventName}>{eventName}</div>
                <div className={styles.meta}>
                  <span>{dateRange}</span>
                  {location && (
                    <>
                      <span className={styles.metaDot}>&middot;</span>
                      <span>{location}</span>
                    </>
                  )}
                  {isOnline && (
                    <>
                      <span className={styles.metaDot}>&middot;</span>
                      <span>Online</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className={styles.headerRight}>
              {placement != null && (
                <div className={styles.placementRow}>
                  <div
                    className={styles.placementValue}
                    style={{ color: placementColor }}
                  >
                    {formatPlacement(placement)}
                  </div>
                  <div className={styles.placementContext}>/ {numEntrants}</div>
                </div>
              )}
              <div className={styles.headerStats}>
                {wins}-{losses}
                {seed != null && <>&nbsp;&nbsp;#{seed}</>}
              </div>
            </div>
          </div>

          {/* Versus-style set rows */}
          {sets.length > 0 && (
            <div className={styles.setsSection}>
              <div className={styles.sectionLabel}>Matches</div>
              <div className={styles.setsList}>
                {sets.map((set, i) => {
                  const [userScore, oppScore] = set.isDQ
                    ? ['DQ', '']
                    : set.score.split('-')
                  return (
                    <div key={i} className={styles.setCard}>
                      {(set.fullRoundText || set.upsetFactor != null) && (
                        <div className={styles.setCardHeader}>
                          {set.fullRoundText && (
                            <div className={styles.roundLabel}>{set.fullRoundText}</div>
                          )}
                          {set.upsetFactor != null && (
                            <span className={`${styles.upsetBadge} ${set.isWin ? styles.upsetWin : styles.upsetLoss}`}>
                              UF {set.upsetFactor}
                            </span>
                          )}
                        </div>
                      )}
                      <div className={styles.setRow}>
                        <div
                          className={`${styles.setSide} ${styles.sideLeft} ${
                            !set.isDQ && set.isWin
                              ? styles.sideWin
                              : !set.isDQ
                                ? styles.sideLoss
                                : ''
                          }`}
                        >
                          <span className={styles.sideName}>{playerTag}</span>
                        </div>
                        <div
                          className={`${styles.scoreBox} ${
                            !set.isDQ && set.isWin
                              ? styles.scoreWin
                              : styles.scoreMuted
                          }`}
                        >
                          {userScore}
                        </div>
                        {!set.isDQ && (
                          <div
                            className={`${styles.scoreBox} ${
                              !set.isWin ? styles.scoreWin : styles.scoreMuted
                            }`}
                          >
                            {oppScore}
                          </div>
                        )}
                        <div
                          className={`${styles.setSide} ${styles.sideRight} ${
                            !set.isDQ && !set.isWin
                              ? styles.sideWin
                              : !set.isDQ
                                ? styles.sideLoss
                                : ''
                          }`}
                        >
                          <span className={styles.sideName}>
                            {set.opponentName}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Characters */}
          {characters.length > 0 && (
            <div className={styles.charsSection}>
              <div className={styles.sectionLabel}>Characters</div>
              <div className={styles.charsList}>
                {characters.slice(0, 4).map((c) => (
                  <div key={c.characterId} className={styles.charRow}>
                    <img
                      src={getCharacterStockIcon(c.characterId)}
                      alt=""
                      className={styles.charIcon}
                    />
                    <span className={styles.charName}>{c.characterName}</span>
                    <span className={styles.charPct}>
                      {Math.round(c.percentage * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.footerLine} />
          <span className={styles.watermark}>better.gg</span>
          <div className={styles.footerLine} />
        </div>
      </div>
    )
  },
)
