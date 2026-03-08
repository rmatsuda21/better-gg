const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export function formatDate(unixSeconds: number): string {
  return dateFormatter.format(new Date(unixSeconds * 1000))
}

export function formatPlacement(placement: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd']
  const v = placement % 100
  const suffix = suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]
  return `${placement}${suffix}`
}

export function formatWinRate(wins: number, losses: number): string {
  const total = wins + losses
  if (total === 0) return 'N/A'
  const rate = Math.round((wins / total) * 100)
  return `${rate}% (${wins}-${losses})`
}

export function formatDateRange(startAt: number, endAt: number): string {
  const start = new Date(startAt * 1000)
  const end = new Date(endAt * 1000)

  if (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate()
  ) {
    return formatDate(startAt)
  }

  return `${formatDate(startAt)} - ${formatDate(endAt)}`
}
