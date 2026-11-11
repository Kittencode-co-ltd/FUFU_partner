import { connection } from 'next/server'
import Landing from './components/landing'

export default async function HomePage() {
  // Render per request so Next.js can attach the CSP nonce set in server/middleware/security.js
  await connection()
  return <Landing />
}
