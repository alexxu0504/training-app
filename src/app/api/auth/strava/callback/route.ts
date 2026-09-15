import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/user'
import { exchangeCode } from '@/lib/strava'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  if (error || !code) {
    return NextResponse.redirect(new URL('/import?error=strava_denied', url.origin))
  }

  try {
    const token = await exchangeCode(code)
    const user = await getCurrentUser()
    await prisma.connectedAccount.upsert({
      where: { userId_provider: { userId: user.id, provider: 'strava' } },
      create: {
        userId: user.id,
        provider: 'strava',
        providerUserId: token.athlete?.id != null ? String(token.athlete.id) : null,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: token.expires_at,
        scope: url.searchParams.get('scope'),
      },
      update: {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: token.expires_at,
        scope: url.searchParams.get('scope'),
      },
    })
    return NextResponse.redirect(new URL('/import?connected=strava', url.origin))
  } catch {
    return NextResponse.redirect(new URL('/import?error=strava_exchange', url.origin))
  }
}
