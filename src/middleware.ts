// Auth middleware. In Phase 1 the only protected surface is the landing page
// itself, which handles its own session check server-side. This file is here so
// Phase 2's /api/ingest/* and other protected routes can just land in the
// matcher below without more wiring.
export { default } from 'next-auth/middleware'

export const config = {
  // Intentionally narrow in Phase 1. Expand in Phase 2 when more routes exist.
  matcher: [
    // '/api/protected/:path*',
  ],
}
