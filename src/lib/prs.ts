import { prisma } from './db'
import { M_PER_MI } from './format'

const HALF_M = 21097.5
const MARATHON_M = 42195

type Split = { distanceM: number; durationSec: number }

/** Fastest cumulative time covering `targetM` using consecutive splits. */
function bestTimeOverDistance(splits: Split[], targetM: number): number | null {
  if (!splits.length) return null
  // Prefix sums over split index.
  const cumD: number[] = [0]
  const cumT: number[] = [0]
  for (const s of splits) {
    cumD.push(cumD[cumD.length - 1] + s.distanceM)
    cumT.push(cumT[cumT.length - 1] + s.durationSec)
  }
  if (cumD[cumD.length - 1] < targetM * 0.98) return null

  let best: number | null = null
  let i = 0
  for (let j = 1; j < cumD.length; j++) {
    while (i < j - 1 && cumD[i + 1] <= cumD[j] - targetM) i++
    const covered = cumD[j] - cumD[i]
    if (covered >= targetM * 0.98) {
      // Scale elapsed time down to exactly targetM.
      const t = (cumT[j] - cumT[i]) * (targetM / covered)
      if (best === null || t < best) best = t
    }
  }
  return best
}

async function upsertPR(
  userId: string,
  category: string,
  label: string,
  v: { valueSec?: number | null; valueM?: number | null; valueNum?: number | null; activityId?: string | null; achievedAt: Date }
) {
  await prisma.personalRecord.upsert({
    where: { userId_category: { userId, category } },
    create: { userId, category, label, ...v },
    update: { label, ...v },
  })
}

/** Recompute all PRs from stored activities. Time PRs favor lower; distance/num favor higher. */
export async function recomputePRs(userId: string) {
  const activities = await prisma.activity.findMany({
    where: { userId, duplicateOfId: null },
    include: { splits: { orderBy: { index: 'asc' } } },
    orderBy: { startTime: 'asc' },
  })

  const runs = activities.filter((a) => a.sport === 'run')
  const rides = activities.filter((a) => a.sport === 'bike')
  const swims = activities.filter((a) => a.sport === 'swim')

  // --- Run time PRs ---
  const runTargets: [string, string, number][] = [
    ['run_5k', '5K', 5000],
    ['run_10k', '10K', 10000],
    ['run_half', 'Half Marathon', HALF_M],
    ['run_marathon', 'Marathon', MARATHON_M],
  ]
  for (const [cat, label, target] of runTargets) {
    let best: { t: number; id: string; at: Date } | null = null
    for (const a of runs) {
      let t: number | null = null
      if (a.splits.length) {
        t = bestTimeOverDistance(
          a.splits.map((s) => ({ distanceM: s.distanceM, durationSec: s.durationSec })),
          target
        )
      } else if (
        a.distanceM >= target * 0.98 &&
        a.distanceM <= target * 1.1 &&
        a.movingSec
      ) {
        // Whole-activity effort within 10% of the target distance.
        t = a.movingSec * (target / a.distanceM)
      }
      if (t !== null && (best === null || t < best.t))
        best = { t, id: a.id, at: a.startTime }
    }
    if (best)
      await upsertPR(userId, cat, label, {
        valueSec: Math.round(best.t),
        activityId: best.id,
        achievedAt: best.at,
      })
  }

  // --- Longest efforts ---
  const longestOf = async (
    xs: typeof activities,
    cat: string,
    label: string
  ) => {
    const top = xs.reduce<(typeof xs)[number] | null>(
      (mx, a) => (a.distanceM > (mx?.distanceM ?? 0) ? a : mx),
      null
    )
    if (top)
      await upsertPR(userId, cat, label, {
        valueM: top.distanceM,
        activityId: top.id,
        achievedAt: top.startTime,
      })
  }
  await longestOf(runs, 'run_longest', 'Longest Run')
  await longestOf(rides, 'bike_longest', 'Longest Ride')
  await longestOf(swims, 'swim_longest', 'Longest Swim')

  // --- Bike: fastest avg speed over >= 20 mi ---
  const fastRides = rides.filter((a) => a.distanceM >= 20 * M_PER_MI && a.avgSpeedMs)
  const fastestRide = fastRides.reduce<(typeof rides)[number] | null>(
    (mx, a) => ((a.avgSpeedMs ?? 0) > (mx?.avgSpeedMs ?? 0) ? a : mx),
    null
  )
  if (fastestRide)
    await upsertPR(userId, 'bike_fastest_20mi', 'Fastest Ride (20+ mi avg speed)', {
      valueNum: fastestRide.avgSpeedMs,
      activityId: fastestRide.id,
      achievedAt: fastestRide.startTime,
    })

  // --- Swim pace PRs from splits (seconds per 100 units of pool length) ---
  const swimTargets: [string, string, number][] = [
    ['swim_100', 'Fastest 100 (pool)', 100],
    ['swim_1000', 'Fastest 1,000', 1000],
    ['swim_2000', 'Fastest 2,000', 2000],
  ]
  for (const [cat, label, target] of swimTargets) {
    let best: { t: number; id: string; at: Date } | null = null
    for (const a of swims) {
      if (!a.splits.length) continue
      const t = bestTimeOverDistance(
        a.splits.map((s) => ({ distanceM: s.distanceM, durationSec: s.durationSec })),
        target
      )
      if (t !== null && (best === null || t < best.t))
        best = { t, id: a.id, at: a.startTime }
    }
    if (best)
      await upsertPR(userId, cat, label, {
        valueSec: Math.round(best.t),
        activityId: best.id,
        achievedAt: best.at,
      })
  }

  // --- Training records from weekly metrics ---
  const weeks = await prisma.weeklyMetric.findMany({ where: { userId } })
  const runWeeks = weeks.filter((w) => w.sport === 'run')
  const allWeeks = weeks.filter((w) => w.sport === 'all')

  const topRunWeek = runWeeks.reduce<(typeof weeks)[number] | null>(
    (mx, w) => (w.distanceM > (mx?.distanceM ?? 0) ? w : mx),
    null
  )
  if (topRunWeek)
    await upsertPR(userId, 'week_run_mileage', 'Highest Weekly Run Mileage', {
      valueM: topRunWeek.distanceM,
      achievedAt: topRunWeek.weekStart,
    })

  const topHoursWeek = allWeeks.reduce<(typeof weeks)[number] | null>(
    (mx, w) => (w.durationSec > (mx?.durationSec ?? 0) ? w : mx),
    null
  )
  if (topHoursWeek)
    await upsertPR(userId, 'week_hours', 'Highest Weekly Training Hours', {
      valueNum: topHoursWeek.durationSec / 3600,
      achievedAt: topHoursWeek.weekStart,
    })

  // --- Longest consecutive-day training streak ---
  const days = [...new Set(activities.map((a) => a.startTime.toDateString()))]
    .map((s) => new Date(s))
    .sort((a, b) => a.getTime() - b.getTime())
  let streak = 0
  let bestStreak = 0
  let streakEnd: Date | null = null
  let bestEnd: Date | null = null
  for (const d of days) {
    if (streakEnd && d.getTime() - streakEnd.getTime() <= 86400000 * 1.5) {
      streak++
    } else {
      streak = 1
    }
    streakEnd = d
    if (streak > bestStreak) {
      bestStreak = streak
      bestEnd = d
    }
  }
  if (bestEnd)
    await upsertPR(userId, 'streak_days', 'Longest Training Streak (days)', {
      valueNum: bestStreak,
      achievedAt: bestEnd,
    })
}
