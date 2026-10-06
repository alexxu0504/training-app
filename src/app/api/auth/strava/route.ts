import { NextRequest, NextResponse } from 'next/server'
import { stravaAuthorizeUrl, stravaConfigured } from '@/lib/strava'
import { appOrigin } from '@/lib/url'

export function GET(request: NextRequest) {
  const origin = appOrigin(request)
  if (!stravaConfigured()) {
    return NextResponse.redirect(new URL('/import?error=strava_not_configured', origin))
  }
  return NextResponse.redirect(stravaAuthorizeUrl(origin))
}
