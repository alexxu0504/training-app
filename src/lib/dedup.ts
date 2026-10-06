import { prisma } from './db'
import type { Activity } from '@prisma/client'

const TIME_WINDOW_SEC = 180 // ±3 min start-time window
const TOLERANCE = 0.03 // 3% distance/duration tolerance

type DedupShape = Pick<Activity, 'startTime' | 'sport' | 'distanceM' | 'durationSec'>

export function activitiesLikelySame(a: DedupShape, b: DedupShape): boolean {
  if (a.sport !== b.sport) return false
  const dt = Math.abs(a.startTime.getTime() - b.startTime.getTime()) / 1000
  if (dt > TIME_WINDOW_SEC) return false

  const longer = Math.max(a.distanceM, b.distanceM)
  // Near-zero distance on one side (manual entry / treadmill with no GPS):
  // fall back to duration-only matching.
  if (longer >= 200) {
    if (Math.abs(a.distanceM - b.distanceM) / longer > TOLERANCE) return false
  }
  const longerDur = Math.max(a.durationSec, b.durationSec)
  if (longerDur > 0 && Math.abs(a.durationSec - b.durationSec) / longerDur > TOLERANCE)
    return false
  return true
}

const SOURCE_WEIGHT: Record<string, number> = {
  garmin: 30,
  file: 20,
  strava: 10,
}

/** Higher score wins: prefer the data-richest copy of a duplicated workout. */
export function richnessScore(a: {
  source: string
  hasGps: boolean
  avgHr: number | null
  maxHr: number | null
  elevGainM: number | null
  movingSec: number | null
  splits?: { length: number } | unknown[]
}): number {
  let s = SOURCE_WEIGHT[a.source] ?? 0
  if (a.hasGps) s += 10
  if (a.avgHr) s += 5
  if (a.maxHr) s += 3
  if (a.elevGainM) s += 2
  if (a.movingSec) s += 1
  if (a.splits && a.splits.length > 0) s += 3
  return s
}

/**
 * Scan a user's activities and link duplicates.
 * The loser keeps its row (with duplicateOfId set) so sources stay auditable;
 * all metric queries filter `duplicateOfId: null`.
 */
export async function linkDuplicatesForUser(userId: string) {
  const activities = await prisma.activity.findMany({
    where: { userId },
    select: {
      id: true,
      sport: true,
      startTime: true,
      distanceM: true,
      durationSec: true,
      source: true,
      hasGps: true,
      avgHr: true,
      maxHr: true,
      elevGainM: true,
      movingSec: true,
      duplicateOfId: true,
      splits: { select: { id: true } },
    },
    orderBy: { startTime: 'asc' },
  })

  const winners: typeof activities = []
  let linked = 0

  for (const act of activities) {
    const dup = winners.find(
      (w) =>
        w.sport === act.sport &&
        Math.abs(w.startTime.getTime() - act.startTime.getTime()) / 1000 <= TIME_WINDOW_SEC &&
        activitiesLikelySame(w, act)
    )
    if (!dup) {
      winners.push(act)
      continue
    }

    // Decide which record is the richer one.
    const keepAct =
      richnessScore({ ...act, splits: act.splits }) >
      richnessScore({ ...dup, splits: dup.splits })
    const [keep, drop] = keepAct ? [act, dup] : [dup, act]

    if (keep === act) {
      // New arrival is richer: repoint, and clear the old winner from the list.
      winners.splice(winners.indexOf(dup), 1)
      winners.push(keep)
      if (dup.duplicateOfId !== keep.id) {
        await prisma.activity.update({
          where: { id: dup.id },
          data: { duplicateOfId: keep.id },
        })
        linked++
      }
    } else if (act.duplicateOfId !== keep.id) {
      await prisma.activity.update({
        where: { id: drop.id },
        data: { duplicateOfId: keep.id },
      })
      linked++
    }
  }
  return linked
}
