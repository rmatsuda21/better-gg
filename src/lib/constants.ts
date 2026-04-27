// ============================================================================
// 1. STATUS ENUMS
// ============================================================================

export const ACTIVITY_STATE = {
  CREATED: 'CREATED',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
} as const
export type ActivityState = typeof ACTIVITY_STATE[keyof typeof ACTIVITY_STATE]

export const BRACKET_TYPE = {
  SINGLE_ELIMINATION: 'SINGLE_ELIMINATION',
  DOUBLE_ELIMINATION: 'DOUBLE_ELIMINATION',
  ROUND_ROBIN: 'ROUND_ROBIN',
  SWISS: 'SWISS',
} as const
export type BracketType = typeof BRACKET_TYPE[keyof typeof BRACKET_TYPE]

// ============================================================================
// 2. PAGINATION (GraphQL perPage)
// ============================================================================

export const PAGINATION = {
  BRACKET_META: 100,
  ACTIVE_SETS: 50,
  CREATED_SETS: 35,
  RECENT_EVENTS: 15,
  ENTRANT_SEARCH: 10,
  EVENT_ENTRANT_SEARCH: 20,
  TOURNAMENT_PARTICIPANTS: 50,
  UPCOMING_EVENTS: 8,
  PLAYER_SETS: 25,
  ENTRANT_SETS_SIMPLE: 25,
  ENTRANT_SETS_EXTENDED: 35,
  PHASE_SEEDS: 100,
  EVENT_STANDINGS: 100,
  CROSS_PHASE_SEEDS: 80,
  TOURNAMENT_LIST: 24,
  TOURNAMENT_LIST_MULTI_WORD: 60,
  TOURNAMENT_SEARCH: 8,
  TOURNAMENT_SEARCH_MULTI_WORD: 30,
  USER_TOURNAMENTS: 20,
} as const

// ============================================================================
// 3. STALE TIMES (React Query, ms)
// ============================================================================

export const STALE_TIME_MS = {
  CHARACTERS: 24 * 60 * 60 * 1000,
  CURRENT_USER: 30 * 60 * 1000,
  PLAYER_PROFILE: 15 * 60 * 1000,
  PLAYER_SETS: 10 * 60 * 1000,
  OPPONENT_STATS: 10 * 60 * 1000,
  RECENT_EVENTS: 10 * 60 * 1000,
  DEFAULT: 5 * 60 * 1000,
  TOURNAMENT_LIST: 2 * 60 * 1000,
  NEVER: Infinity,
} as const

// ============================================================================
// 4. TIMING (ms)
// ============================================================================

export const TIMING_MS = {
  SEARCH_DEBOUNCE: 200,
  TOURNAMENT_SEARCH_DEBOUNCE: 300,
  COPY_FEEDBACK: 2000,
  BRACKET_SCROLL_RETRY: 150,
  BRACKET_SCROLL_RETRY_FAST: 50,
  STAGGER_ANIMATION: 40,
} as const

export const BRACKET_SCROLL_MAX_ATTEMPTS = 20

// ============================================================================
// 5. THRESHOLDS
// ============================================================================

export const THRESHOLDS = {
  MIN_TOURNAMENT_SEARCH_LENGTH: 3,
  MIN_PLAYER_SEARCH_LENGTH: 2,
  MIN_BRACKET_SEARCH_LENGTH: 1,
  DRAG_PX: 5,
  LAZY_LOAD_ROOT_MARGIN: '200px',
} as const

// ============================================================================
// 6. LAYOUT
// ============================================================================

export const LAYOUT = {
  PLAYER_ROW_HEIGHT: 44,
  PARTICIPANT_ROW_HEIGHT: 44,
  STANDINGS_ROW_HEIGHT: 36,
  MAX_VISIBLE_EVENTS: 3,
  MAX_BRACKET_SEARCH_RESULTS: 20,
  VIRTUALIZER_OVERSCAN: 20,
  DESKTOP_MQ: '(min-width: 641px)',
} as const

// ============================================================================
// 7. TIME WINDOWS
// ============================================================================

export const TIME_WINDOWS = {
  SOON_THRESHOLD_MS: 7 * 24 * 60 * 60 * 1000,
  THREE_YEARS_S: 3 * 365.25 * 24 * 60 * 60,
} as const
