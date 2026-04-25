import { createFileRoute, Navigate } from '@tanstack/react-router'
import { parseStartGGUrl } from '../lib/startgg-url'

export const Route = createFileRoute('/$')({
  component: CatchAllRedirect,
})

function CatchAllRedirect() {
  const { _splat } = Route.useParams()

  // Try parsing as a start.gg URL (prepend use case)
  const parsed = parseStartGGUrl(_splat ?? '')

  if (parsed) {
    return (
      <Navigate
        to="/tournament/$tournamentId"
        params={{ tournamentId: parsed.slug }}
        replace
      />
    )
  }

  // Try matching /tournament/<slug>/... paths that didn't match the param route
  const segments = (_splat ?? '').split('/').filter(Boolean)
  if (segments[0] === 'tournament' && segments[1]) {
    return (
      <Navigate
        to="/tournament/$tournamentId"
        params={{ tournamentId: segments[1] }}
        replace
      />
    )
  }

  return <Navigate to="/" replace />
}
