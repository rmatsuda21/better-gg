const STOP_WORDS = new Set([
  'the', 'a', 'an', 'of', 'in', 'at', 'to', 'for', 'and', 'or', 'vs', 'by',
])

/**
 * The start.gg API `name` filter does broad OR-based token matching on multi-word
 * queries, drowning distinctive terms in common-word matches. This extracts the
 * single most distinctive word to send as the API search term, paired with
 * client-side filtering via `matchesAllQueryWords`.
 */
export function extractApiSearchTerm(query: string): string {
  const trimmed = query.trim()
  const words = trimmed.split(/\s+/)
  if (words.length <= 1) return trimmed

  const distinctive = words.find(
    (w) => w.length >= 3 && !STOP_WORDS.has(w.toLowerCase()) && !/^\d+$/.test(w),
  )
  return distinctive ?? trimmed
}

/** Returns true if every word in `query` appears as a substring in `name` (case-insensitive). */
export function matchesAllQueryWords(name: string, query: string): boolean {
  const nameLower = name.toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => nameLower.includes(word))
}
