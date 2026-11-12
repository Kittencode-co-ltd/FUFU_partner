// Vercel entry point for the partner API.
// Every /api/* request is handed to the Express app in server/app.js, which keeps
// its own routing, auth, CORS, rate limits and error handling.
import { createApiApp } from '../../server/app.js'

let app // created on first request so builds don't need the runtime env vars

function normalizeApiUrl(req) {
  const rawPath = req.query?.path
  const rawSegments = Array.isArray(rawPath)
    ? rawPath
    : typeof rawPath === 'string' ? [rawPath] : []
  const segments = rawSegments.flatMap(value => {
    let decoded = String(value)
    try { decoded = decodeURIComponent(decoded) } catch {}
    return decoded.split('/').filter(Boolean)
  })

  while (segments[0] === 'api') segments.shift()

  const queryIndex = req.url?.indexOf('?') ?? -1
  const currentPath = (queryIndex >= 0 ? req.url.slice(0, queryIndex) : req.url) || '/'
  const search = queryIndex >= 0 ? req.url.slice(queryIndex) : ''
  let pathname

  if (segments.length) {
    pathname = `/api/${segments.map(segment => encodeURIComponent(segment)).join('/')}`
  } else if (currentPath === '/api' || currentPath.startsWith('/api/')) {
    pathname = currentPath
  } else {
    pathname = `/api${currentPath.startsWith('/') ? currentPath : `/${currentPath}`}`
  }

  req.url = `${pathname}${search}`
}

export default function handler(req, res) {
  // Next/Vercel exposes the catch-all segments in `req.query.path`, while the
  // URL passed to a custom Express app can be rewritten to the function-local
  // path (without `/api`). Rebuild the original API path so Express matches
  // the same `/api/*` routes used by the local server.
  normalizeApiUrl(req)

  app ??= createApiApp()
  return app(req, res)
}

export const config = {
  api: {
    bodyParser: false,     // express.json() parses the body
    externalResolver: true, // Express sends the response
  },
}
