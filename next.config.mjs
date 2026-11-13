import { BASE_SECURITY_HEADERS, PORTAL_CSP } from './server/middleware/security.js'

const toHeaders = (obj) => Object.entries(obj).map(([key, value]) => ({ key, value }))

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  compress: true,

  // On Vercel there is no Express server in front of Next.js, so the headers and
  // redirect that server/index.js normally adds are declared here as well.
  async headers() {
    return [
      { source: '/:path*', headers: toHeaders(BASE_SECURITY_HEADERS) },
      // Static partner portal pages (login / register / onboarding / dashboard)
      { source: '/:page(login|register|onboarding|dashboard|receipt).html', headers: toHeaders({ 'Content-Security-Policy': PORTAL_CSP }) },
    ]
  },

  async redirects() {
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/login.html', destination: '/login', permanent: false },
      { source: '/register.html', destination: '/register', permanent: false },
      { source: '/onboarding.html', destination: '/onboarding', permanent: false },
    ]
  },
}

export default nextConfig
