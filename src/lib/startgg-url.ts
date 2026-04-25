/**
 * Parse a start.gg URL or path and extract the tournament slug.
 *
 * Handles:
 *   - Full URLs: https://www.start.gg/tournament/lvl-up-expo-2026-1/details
 *   - Bare paths: /tournament/lvl-up-expo-2026-1
 *   - With protocol prefix (prepend use case): https://www.start.gg/tournament/...
 */
export function parseStartGGUrl(
  input: string,
): { type: 'tournament'; slug: string } | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // Strip protocol (handles both :// and :/ since browsers may normalize // in paths)
  let path = trimmed.replace(/^https?:\/\/?/i, '')

  // Check for start.gg / smash.gg host prefix
  const hostMatch = path.match(
    /^(?:www\.)?(?:start\.gg|smash\.gg)\/(.*)/i,
  )
  if (hostMatch) {
    path = hostMatch[1]
  } else if (
    path.startsWith('/tournament/') ||
    path.startsWith('tournament/')
  ) {
    path = path.replace(/^\//, '')
  } else {
    return null
  }

  // path is now e.g. "tournament/lvl-up-expo-2026-1/details" or "tournament/lvl-up-expo-2026-1"
  const segments = path.split('/').filter(Boolean)
  if (segments[0] !== 'tournament' || !segments[1]) return null

  return { type: 'tournament', slug: segments[1] }
}
