// Vercel entry point for the partner API.
// Every /api/* request is handed to the Express app in server/app.js, which keeps
// its own routing, auth, CORS, rate limits and error handling.
import { createApiApp } from '../../server/app.js'

let app // created on first request so builds don't need the runtime env vars

export default function handler(req, res) {
  // Next/Vercel exposes the catch-all segments in `req.query.path`, while the
  // URL passed to a custom Express app can be rewritten to the function-local
  // path (without `/api`). Rebuild the original API path so Express matches
  // the same `/api/*` routes used by the local server.
  const path = req.query?.path
  const segments = (Array.isArray(path) ? path : typeof path === 'string' ? path.split('/') : [])
    .filter(Boolean)

  if (segments.length) {
    const queryIndex = req.url?.indexOf('?') ?? -1
    const search = queryIndex >= 0 ? req.url.slice(queryIndex) : ''
    req.url = `/api/${segments.map(segment => encodeURIComponent(segment)).join('/')}${search}`
  }

  app ??= createApiApp()
  return app(req, res)
}

export const config = {
  api: {
    bodyParser: false,     // express.json() parses the body
    externalResolver: true, // Express sends the response
  },
}
