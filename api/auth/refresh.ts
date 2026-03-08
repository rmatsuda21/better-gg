import type { IncomingMessage, ServerResponse } from 'node:http'

interface VercelRequest extends IncomingMessage {
  body: Record<string, unknown>
  method: string
}

interface VercelResponse extends ServerResponse {
  status(code: number): VercelResponse
  json(data: unknown): void
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const clientId = process.env.START_GG_CLIENT_ID ?? process.env.VITE_START_GG_CLIENT_ID
  const clientSecret = process.env.START_GG_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    res.status(500).json({ error: 'OAuth not configured' })
    return
  }

  try {
    const { refresh_token } = req.body

    const response = await fetch('https://api.start.gg/oauth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      res.status(response.status).json(data)
      return
    }

    res.status(200).json(data)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
}
