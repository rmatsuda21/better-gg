import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

export function authProxyPlugin(): Plugin {
  return {
    name: 'auth-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'POST') return next()

        const clientId = process.env.START_GG_CLIENT_ID ?? process.env.VITE_START_GG_CLIENT_ID
        const clientSecret = process.env.START_GG_CLIENT_SECRET

        if (!clientId || !clientSecret) {
          if (req.url === '/api/auth/token' || req.url === '/api/auth/refresh') {
            sendJson(res, 500, { error: 'OAuth not configured' })
            return
          }
          return next()
        }

        if (req.url === '/api/auth/token') {
          try {
            const body = JSON.parse(await readBody(req))
            const response = await fetch('https://api.start.gg/oauth/access_token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                grant_type: 'authorization_code',
                code: body.code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: body.redirect_uri,
                scope: 'user.identity',
              }),
            })
            const data = await response.json()
            if (!response.ok) {
              sendJson(res, response.status, data)
              return
            }
            sendJson(res, 200, data)
          } catch (err) {
            sendJson(res, 500, { error: String(err) })
          }
          return
        }

        if (req.url === '/api/auth/refresh') {
          try {
            const body = JSON.parse(await readBody(req))
            const response = await fetch('https://api.start.gg/oauth/refresh', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                grant_type: 'refresh_token',
                refresh_token: body.refresh_token,
                client_id: clientId,
                client_secret: clientSecret,
              }),
            })
            const data = await response.json()
            if (!response.ok) {
              sendJson(res, response.status, data)
              return
            }
            sendJson(res, 200, data)
          } catch (err) {
            sendJson(res, 500, { error: String(err) })
          }
          return
        }

        next()
      })
    },
  }
}
