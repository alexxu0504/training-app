import { createHash } from 'crypto'
import { prisma } from '../db'
import { linkDuplicatesForUser } from '../dedup'
import { recomputeWeeklyMetrics } from '../metrics'
import { recomputePRs } from '../prs'
import type { ParsedActivity } from './index'

/**
 * Persist a parsed file import (FIT/TCX/GPX from Garmin Connect, etc.)
 * under source "file", then re-link duplicates and recompute rollups.
 */
export async function saveImportedActivity(userId: string, p: ParsedActivity, filename: string) {
  // Stable external id from content so re-uploading the same file is idempotent.
  const externalId = createHash('sha1')
    .update(`${filename}|${p.startTime.toISOString()}|${p.distanceM}|${p.durationSec}`)
    .digest('hex')
    .slice(0, 20)

  const existing = await prisma.activity.findUnique({
    where: { source_externalId: { source: 'file', externalId } },
    select: { id: true },
  })

  const activity = existing
    ? await prisma.activity.update({
        where: { id: existing.id },
        data: {
          name: p.name,
          sport: p.sport,
          sportDetail: p.sportDetail,
          startTime: p.startTime,
          durationSec: p.durationSec,
          movingSec: p.movingSec,
          distanceM: p.distanceM,
          elevGainM: p.elevGainM,
          avgHr: p.avgHr,
          maxHr: p.maxHr,
          avgSpeedMs: p.avgSpeedMs,
          calories: p.calories,
          hasGps: Boolean(p.polyline),
          polyline: p.polyline,
        },
      })
    : await prisma.activity.create({
        data: {
          userId,
          source: 'file',
          externalId,
          name: p.name,
          sport: p.sport,
          sportDetail: p.sportDetail,
          startTime: p.startTime,
          durationSec: p.durationSec,
          movingSec: p.movingSec,
          distanceM: p.distanceM,
          elevGainM: p.elevGainM,
          avgHr: p.avgHr,
          maxHr: p.maxHr,
          avgSpeedMs: p.avgSpeedMs,
          calories: p.calories,
          hasGps: Boolean(p.polyline),
          polyline: p.polyline,
        },
      })

  await prisma.activitySplit.deleteMany({ where: { activityId: activity.id } })
  if (p.splits.length) {
    await prisma.activitySplit.createMany({
      data: p.splits.map((s, i) => ({
        activityId: activity.id,
        index: i,
        distanceM: s.distanceM,
        durationSec: s.durationSec,
        avgHr: s.avgHr ?? null,
        elevDiffM: s.elevDiffM ?? null,
      })),
    })
  }

  await linkDuplicatesForUser(userId)
  await recomputeWeeklyMetrics(userId)
  await recomputePRs(userId)
  return activity
}
