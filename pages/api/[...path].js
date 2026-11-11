// Vercel entry point for the partner API.
// Every /api/* request is handed to the Express app in server/app.js, which keeps
// its own routing, auth, CORS, rate limits and error handling.
import { createApiApp } from '../../server/app.js'

let app // created on first request so builds don't need the runtime env vars

export default function handler(req, res) {
  app ??= createApiApp()
  return app(req, res)
}

export const config = {
  api: {
    bodyParser: false,     // express.json() parses the body
    externalResolver: true, // Express sends the response
  },
}
