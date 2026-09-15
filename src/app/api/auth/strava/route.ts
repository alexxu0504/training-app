import { NextRequest, NextResponse } from 'next/server'
import { stravaAuthorizeUrl, stravaConfigured } from '@/lib/strava'

export function GET(request: NextRequest) {
  if (!stravaConfigured()) {
    return NextResponse.redirect(new URL('/import?error=strava_not_configured', request.url))
  }
  return NextResponse.redirect(stravaAuthorizeUrl(new URL(request.url).origin))
}
