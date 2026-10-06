import { prisma } from './db'
import { isLongRun, type Sport } from './sports'
import { metersToMiles, M_PER_MI, pctChange } from './format'
import type { Activity, Race } from '@prisma/client'

/** Activity without the heavy payload columns (rawJson/streamsJson/polyline). */
export type ActivityLean = Omit<Activity, 'rawJson' | 'streamsJson' | 'polyline'>
const ACTIVITY_OMIT = { rawJson: true, streamsJson: true, polyline: true } as const

export function startOfWeekMonday(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = x.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  return x
}

export function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** Rebuild the WeeklyMetric rollup for a user (per sport + "all"). */
export async function recomputeWeeklyMetrics(userId: string) {
  const activities = await prisma.activity.findMany({
    where: { userId, duplicateOfId: null },
    select: {
      sport: true,
      startTime: true,
      distanceM: true,
      durationSec: true,
      movingSec: true,
      avgHr: true,
      avgSpeedMs: true,
    },
  })

  const buckets = new Map<
    string,
    {
      weekStart: Date
      sport: string
      count: number
      distanceM: number
      durationSec: number
      longestM: number
      hrSum: number
      hrN: number
      speedSum: number
      speedN: number
    }
  >()

  const add = (weekStart: Date, sport: string, a: (typeof activities)[number]) => {
    const key = `${weekStart.toISOString()}|${sport}`
    let b = buckets.get(key)
    if (!b) {
      b = {
        weekStart,
        sport,
        count: 0,
        distanceM: 0,
        durationSec: 0,
        longestM: 0,
        hrSum: 0,
        hrN: 0,
        speedSum: 0,
        speedN: 0,
      }
      buckets.set(key, b)
    }
    b.count += 1
    b.distanceM += a.distanceM
    b.durationSec += a.movingSec ?? a.durationSec
    b.longestM = Math.max(b.longestM, a.distanceM)
    if (a.avgHr) {
      b.hrSum += a.avgHr
      b.hrN += 1
    }
    if (a.avgSpeedMs) {
      b.speedSum += a.avgSpeedMs
      b.speedN += 1
    }
  }

  for (const a of activities) {
    const ws = startOfWeekMonday(a.startTime)
    add(ws, a.sport, a)
    add(ws, 'all', a)
  }

  await prisma.weeklyMetric.deleteMany({ where: { userId } })
  if (buckets.size) {
    await prisma.weeklyMetric.createMany({
      data: [...buckets.values()].map((b) => ({
        userId,
        weekStart: b.weekStart,
        sport: b.sport,
        count: b.count,
        distanceM: b.distanceM,
        durationSec: b.durationSec,
        longestM: b.longestM,
        avgHr: b.hrN ? b.hrSum / b.hrN : null,
        avgSpeedMs: b.speedN ? b.speedSum / b.speedN : null,
      })),
    })
  }
}

export type SportWeek = {
  count: number
  distanceM: number
  durationSec: number
  avgSpeedMs: number | null
  avgHr: number | null
  distChangePct: number | null
  timeChangePct: number | null
}

function toSportWeek(
  cur: { count: number; distanceM: number; durationSec: number; avgSpeedMs: number | null; avgHr: number | null } | undefined,
  prev: { distanceM: number; durationSec: number } | undefined
): SportWeek {
  const c = cur ?? { count: 0, distanceM: 0, durationSec: 0, avgSpeedMs: null, avgHr: null }
  return {
    ...c,
    distChangePct: prev ? pctChange(c.distanceM, prev.distanceM) : null,
    timeChangePct: prev ? pctChange(c.durationSec, prev.durationSec) : null,
  }
}

function trainingPhase(daysToRace: number): string {
  if (daysToRace <= 0) return 'Post-race'
  if (daysToRace <= 7) return 'Race week'
  if (daysToRace <= 21) return 'Taper'
  if (daysToRace <= 56) return 'Specific / peak'
  if (daysToRace <= 84) return 'Build'
  return 'Base'
}

export type DashboardData = {
  race: Race | null
  daysToRace: number | null
  weeksToRace: number | null
  phase: string | null
  goalPaceSecPerMile: number | null
  weekStart: Date
  thisWeek: Record<Sport, SportWeek>
  thisWeekTotals: SportWeek
  run: {
    weeklyMiles: number
    weeklySec: number
    longestThisWeekM: number
    longestRecentM: number
    runsThisWeek: number
    fourWeekAvgMiles: number
    priorFourWeekAvgMiles: number
    mileageChangePct: number | null
    consistencyPct: number | null
    daysSinceLongRun: number | null
    runsOver10: number
    runsOver13: number
    highestWeekMiles: number
    avgRunPaceSecPerMile: number | null
    avgRunHr: number | null
    longRunStreakWeeks: number
    longestRunPrevM: number | null
    longestRunRecentM: number | null
  }
  weeklyRunHistory: { weekStart: Date; miles: number; longestM: number }[]
  /** Last 8 weeks, miles per sport (for sparklines). */
  sportHistory: Record<'swim' | 'bike' | 'run', number[]>
  /** Last 12 weeks, training hours per sport (for stacked chart). */
  weeklyHours: { weekStart: Date; swim: number; bike: number; run: number; other: number }[]
  /** Runs from the last 28 days (used by recommendations). */
  recentRuns: ActivityLean[]
  insights: string[]
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const now = new Date()
  const thisWeekStart = startOfWeekMonday(now)
  const prevWeekStart = addDays(thisWeekStart, -7)

  const [race, metrics, activities] = await Promise.all([
    prisma.race.findFirst({ where: { userId, isPrimary: true }, orderBy: { date: 'asc' } }),
    prisma.weeklyMetric.findMany({ where: { userId }, orderBy: { weekStart: 'asc' } }),
    prisma.activity.findMany({
      where: { userId, duplicateOfId: null },
      orderBy: { startTime: 'desc' },
      omit: ACTIVITY_OMIT,
    }),
  ])

  const metricAt = (weekStart: Date, sport: string) =>
    metrics.find(
      (m) => m.sport === sport && m.weekStart.getTime() === weekStart.getTime()
    )

  const thisWeek: Record<Sport, SportWeek> = {
    swim: toSportWeek(metricAt(thisWeekStart, 'swim'), metricAt(prevWeekStart, 'swim')),
    bike: toSportWeek(metricAt(thisWeekStart, 'bike'), metricAt(prevWeekStart, 'bike')),
    run: toSportWeek(metricAt(thisWeekStart, 'run'), metricAt(prevWeekStart, 'run')),
    other: toSportWeek(metricAt(thisWeekStart, 'other'), metricAt(prevWeekStart, 'other')),
  }
  const thisWeekTotals = toSportWeek(
    metricAt(thisWeekStart, 'all'),
    metricAt(prevWeekStart, 'all')
  )

  // ---- Run analytics ----
  const runs = activities.filter((a) => a.sport === 'run')
  const runsThisWeek = runs.filter((a) => a.startTime >= thisWeekStart)
  const longestThisWeekM = runsThisWeek.reduce((mx, a) => Math.max(mx, a.distanceM), 0)

  const since = (days: number) => addDays(now, -days)
  const last28 = runs.filter((a) => a.startTime >= since(28))
  const prior28 = runs.filter((a) => a.startTime >= since(56) && a.startTime < since(28))

  const sumM = (xs: ActivityLean[]) => xs.reduce((s, a) => s + a.distanceM, 0)
  const fourWeekAvgMiles = metersToMiles(sumM(last28)) / 4
  const priorFourWeekAvgMiles = metersToMiles(sumM(prior28)) / 4

  // Consistency: share of the last 28 days with at least one workout.
  const activeDays = new Set(
    activities
      .filter((a) => a.startTime >= since(28))
      .map((a) => a.startTime.toDateString())
  )
  const consistencyPct = activities.length
    ? Math.round((activeDays.size / 28) * 100)
    : null

  const lastLongRun = runs.find(isLongRun)
  const daysSinceLongRun = lastLongRun
    ? Math.floor((now.getTime() - lastLongRun.startTime.getTime()) / 86400000)
    : null

  const runsOver10 = last28.filter((a) => a.distanceM >= 10 * M_PER_MI).length
  const runsOver13 = last28.filter((a) => a.distanceM >= 13 * M_PER_MI).length

  const runWeeks = metrics.filter((m) => m.sport === 'run')
  const highestWeek = runWeeks.reduce<typeof runWeeks[number] | null>(
    (mx, m) => (m.distanceM > (mx?.distanceM ?? 0) ? m : mx),
    null
  )

  // Pace/HR over last 4 weeks of runs.
  const withSpeed = last28.filter((a) => a.avgSpeedMs)
  const avgSpeed =
    withSpeed.reduce((s, a) => s + (a.avgSpeedMs ?? 0), 0) / (withSpeed.length || 1)
  const withHr = last28.filter((a) => a.avgHr)
  const avgRunHr = withHr.length
    ? Math.round(withHr.reduce((s, a) => s + (a.avgHr ?? 0), 0) / withHr.length)
    : null

  // Long-run streak: consecutive recent weeks (ending this week) containing a long run.
  const longRunWeeks = new Set(
    runs.filter(isLongRun).map((a) => startOfWeekMonday(a.startTime).getTime())
  )
  let longRunStreakWeeks = 0
  let cursor = thisWeekStart.getTime()
  // If this week has no long run yet, streak counts back from last week.
  if (!longRunWeeks.has(cursor)) cursor -= 7 * 86400000
  while (longRunWeeks.has(cursor)) {
    longRunStreakWeeks++
    cursor -= 7 * 86400000
  }

  // Longest run: recent (last 28d) vs prior 28d.
  const longestRunRecentM = last28.reduce((mx, a) => Math.max(mx, a.distanceM), 0)
  const longestRunPrevM = prior28.length
    ? prior28.reduce((mx, a) => Math.max(mx, a.distanceM), 0)
    : null

  // ---- Weekly run history for chart (last 16 weeks) ----
  const weeklyRunHistory: DashboardData['weeklyRunHistory'] = []
  for (let i = 15; i >= 0; i--) {
    const ws = addDays(thisWeekStart, -7 * i)
    const m = metricAt(ws, 'run')
    weeklyRunHistory.push({
      weekStart: ws,
      miles: metersToMiles(m?.distanceM ?? 0),
      longestM: m?.longestM ?? 0,
    })
  }

  // ---- Per-sport series for charts ----
  const sportHistory = { swim: [] as number[], bike: [] as number[], run: [] as number[] }
  for (let i = 7; i >= 0; i--) {
    const ws = addDays(thisWeekStart, -7 * i)
    for (const s of ['swim', 'bike', 'run'] as const) {
      sportHistory[s].push(metersToMiles(metricAt(ws, s)?.distanceM ?? 0))
    }
  }
  const weeklyHours: DashboardData['weeklyHours'] = []
  for (let i = 11; i >= 0; i--) {
    const ws = addDays(thisWeekStart, -7 * i)
    weeklyHours.push({
      weekStart: ws,
      swim: (metricAt(ws, 'swim')?.durationSec ?? 0) / 3600,
      bike: (metricAt(ws, 'bike')?.durationSec ?? 0) / 3600,
      run: (metricAt(ws, 'run')?.durationSec ?? 0) / 3600,
      other: (metricAt(ws, 'other')?.durationSec ?? 0) / 3600,
    })
  }

  // ---- Race / goal ----
  let daysToRace: number | null = null
  let weeksToRace: number | null = null
  let phase: string | null = null
  let goalPaceSecPerMile: number | null = null
  if (race) {
    daysToRace = Math.ceil((race.date.getTime() - now.getTime()) / 86400000)
    weeksToRace = Math.floor(daysToRace / 7)
    phase = trainingPhase(daysToRace)
    if (race.goalSec) goalPaceSecPerMile = race.goalSec / metersToMiles(race.distanceM)
  }

  // ---- Insights: generated only from real data ----
  const insights: string[] = []
  const mileageChange = pctChange(fourWeekAvgMiles, priorFourWeekAvgMiles)
  if (mileageChange !== null && Math.abs(mileageChange) >= 3) {
    const dir = mileageChange >= 0 ? 'increased' : 'decreased'
    insights.push(
      `Your running volume has ${dir} ${Math.abs(Math.round(mileageChange))}% over the last four weeks versus the prior four.`
    )
  }
  if (longestRunPrevM && longestRunRecentM > longestRunPrevM * 1.03) {
    insights.push(
      `Your longest run increased from ${metersToMiles(longestRunPrevM).toFixed(1)} to ${metersToMiles(longestRunRecentM).toFixed(1)} miles.`
    )
  }
  if (longRunStreakWeeks >= 3) {
    insights.push(
      `You have completed a long run in each of the past ${longRunStreakWeeks} weeks.`
    )
  }
  if (daysSinceLongRun !== null && daysSinceLongRun > 12 && daysToRace && daysToRace > 21) {
    insights.push(`It has been ${daysSinceLongRun} days since your last long run.`)
  }
  if (runsOver13 >= 3) {
    insights.push(`You have logged ${runsOver13} runs over 13 miles in the last four weeks.`)
  }

  return {
    race,
    daysToRace,
    weeksToRace,
    phase,
    goalPaceSecPerMile,
    weekStart: thisWeekStart,
    thisWeek,
    thisWeekTotals,
    run: {
      weeklyMiles: metersToMiles(thisWeek.run.distanceM),
      weeklySec: thisWeek.run.durationSec,
      longestThisWeekM: longestThisWeekM,
      longestRecentM: longestRunRecentM,
      runsThisWeek: runsThisWeek.length,
      fourWeekAvgMiles,
      priorFourWeekAvgMiles,
      mileageChangePct: mileageChange,
      consistencyPct,
      daysSinceLongRun,
      runsOver10,
      runsOver13,
      highestWeekMiles: metersToMiles(highestWeek?.distanceM ?? 0),
      avgRunPaceSecPerMile: withSpeed.length ? M_PER_MI / avgSpeed : null,
      avgRunHr,
      longRunStreakWeeks,
      longestRunPrevM,
      longestRunRecentM,
    },
    weeklyRunHistory,
    sportHistory,
    weeklyHours,
    recentRuns: last28,
    insights,
  }
}
