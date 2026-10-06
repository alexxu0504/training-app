import { NextRequest } from 'next/server'

/**
 * Public origin of the app. Behind a proxy (Vercel), `request.url` can report
 * an internal host or http:// — prefer NEXT_PUBLIC_APP_URL when set.
 */
export function appOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL
  if (configured) return new URL(configured).origin
  return new URL(request.url).origin
}
