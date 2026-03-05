const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export function formatDate(unixSeconds: number): string {
  return dateFormatter.format(new Date(unixSeconds * 1000))
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
