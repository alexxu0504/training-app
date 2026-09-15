import { prisma } from './db'
import { normalizeSport } from './sports'
import { linkDuplicatesForUser } from './dedup'
import { recomputeWeeklyMetrics } from './metrics'
import { recomputePRs } from './prs'

const STRAVA_API = 'https://www.strava.com/api/v3'
const STRAVA_OAUTH = 'https://www.strava.com/oauth'

export function stravaConfigured() {
  return Boolean(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET)
}

export function stravaAuthorizeUrl(origin: string) {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID ?? '',
    redirect_uri: `${origin}/api/auth/strava/callback`,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'read,activity:read_all',
  })
  return `${STRAVA_OAUTH}/authorize?${params}`
}

type TokenResponse = {
  access_token: string
  refresh_token: string
  expires_at: number
  athlete?: { id: number }
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch(`${STRAVA_OAUTH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Strava token exchange failed: ${res.status} ${await res.text()}`)
  return res.json()
}

async function refresh(accountId: string, refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(`${STRAVA_OAUTH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Strava token refresh failed: ${res.status}`)
  const data = (await res.json()) as TokenResponse
  await prisma.connectedAccount.update({
    where: { id: accountId },
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at,
    },
  })
  return data
}

async function validToken(userId: string): Promise<{ token: string; accountId: string } | null> {
  const account = await prisma.connectedAccount.findUnique({
    where: { userId_provider: { userId, provider: 'strava' } },
  })
  if (!account?.accessToken) return null
  // Refresh 5 min early.
  if (account.expiresAt && account.expiresAt < Date.now() / 1000 + 300) {
    if (!account.refreshToken) return null
    const t = await refresh(account.id, account.refreshToken)
    return { token: t.access_token, accountId: account.id }
  }
  return { token: account.accessToken, accountId: account.id }
}

async function stravaGet(token: string, path: string) {
  const res = await fetch(`${STRAVA_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Strava API ${path} -> ${res.status}`)
  return res.json()
}

type StravaSummary = {
  id: number
  name: string
  sport_type?: string
  type?: string
  start_date: string
  timezone?: string
  elapsed_time: number
  moving_time?: number
  distance: number
  total_elevation_gain?: number
  average_heartrate?: number
  max_heartrate?: number
  average_speed?: number
  calories?: number
  map?: { summary_polyline?: string }
}

type StravaDetail = StravaSummary & {
  splits_metric?: {
    distance: number
    elapsed_time: number
    moving_time?: number
    average_speed?: number
    average_heartrate?: number
    elevation_difference?: number
  }[]
  laps?: { distance: number; elapsed_time: number }[]
}

function summaryToActivity(userId: string, s: StravaSummary) {
  return {
    userId,
    source: 'strava',
    externalId: String(s.id),
    name: s.name || 'Activity',
    sport: normalizeSport(s.sport_type ?? s.type, 'strava'),
    sportDetail: s.sport_type ?? s.type ?? null,
    startTime: new Date(s.start_date),
    timezone: s.timezone ?? null,
    durationSec: s.elapsed_time ?? 0,
    movingSec: s.moving_time ?? null,
    distanceM: s.distance ?? 0,
    elevGainM: s.total_elevation_gain ?? null,
    avgHr: s.average_heartrate ? Math.round(s.average_heartrate) : null,
    maxHr: s.max_heartrate ? Math.round(s.max_heartrate) : null,
    avgSpeedMs: s.average_speed ?? null,
    calories: s.calories ?? null,
    hasGps: Boolean(s.map?.summary_polyline),
    polyline: s.map?.summary_polyline || null,
    rawJson: JSON.stringify(s),
  }
}

/**
 * Pull activities from Strava. Fetches full detail (for splits) on up to
 * `detailBudget` recent activities per sync to stay inside rate limits
 * (100 req / 15 min, 1000 / day on a standard app).
 */
export async function syncStrava(userId: string, detailBudget = 40) {
  const auth = await validToken(userId)
  if (!auth) throw new Error('Strava is not connected')
  const { token } = auth

  const account = await prisma.connectedAccount.findUnique({
    where: { userId_provider: { userId, provider: 'strava' } },
  })
  const after = account?.lastSyncAt
    ? Math.floor(account.lastSyncAt.getTime() / 1000)
    : 0

  let imported = 0
  let updated = 0
  let page = 1
  for (;;) {
    const batch = (await stravaGet(
      token,
      `/athlete/activities?per_page=100&page=${page}${after ? `&after=${after}` : ''}`
    )) as StravaSummary[]
    if (!batch.length) break

    for (const s of batch) {
      const data = summaryToActivity(userId, s)
      const existing = await prisma.activity.findUnique({
        where: { source_externalId: { source: 'strava', externalId: String(s.id) } },
        select: { id: true },
      })
      if (existing) {
        await prisma.activity.update({ where: { id: existing.id }, data })
        updated++
      } else {
        await prisma.activity.create({ data })
        imported++
      }
    }
    if (batch.length < 100) break
    page++
  }

  // Hydrate splits for recent activities missing them (PR accuracy).
  const missing = await prisma.activity.findMany({
    where: {
      userId,
      source: 'strava',
      splits: { none: {} },
      distanceM: { gt: 800 },
    },
    orderBy: { startTime: 'desc' },
    take: detailBudget,
    select: { id: true, externalId: true },
  })
  for (const m of missing) {
    try {
      const d = (await stravaGet(token, `/activities/${m.externalId}`)) as StravaDetail
      const splits = (d.splits_metric ?? []).map((sp, i) => ({
        activityId: m.id,
        index: i,
        distanceM: sp.distance,
        durationSec: sp.elapsed_time,
        movingSec: sp.moving_time ?? null,
        avgSpeedMs: sp.average_speed ?? null,
        avgHr: sp.average_heartrate ? Math.round(sp.average_heartrate) : null,
        elevDiffM: sp.elevation_difference ?? null,
      }))
      if (splits.length) await prisma.activitySplit.createMany({ data: splits })
    } catch {
      // Skip on rate limit or missing detail; next sync retries.
      break
    }
  }

  await prisma.connectedAccount.update({
    where: { userId_provider: { userId, provider: 'strava' } },
    data: { lastSyncAt: new Date() },
  })

  const duplicates = await linkDuplicatesForUser(userId)
  await recomputeWeeklyMetrics(userId)
  await recomputePRs(userId)

  return { imported, updated, splitsHydrated: missing.length, duplicates }
}
