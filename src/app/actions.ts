'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/user'
import { syncStrava } from '@/lib/strava'
import { parseActivityFile } from '@/lib/import'
import { saveImportedActivity } from '@/lib/import/save'

export type ActionResult = { ok: boolean; message: string }

/** Update the primary race's goal finish time. `goal` is "H:MM:SS" or "MM:SS". */
export async function updateGoalTime(raceId: string, goal: string): Promise<ActionResult> {
  const parts = goal.split(':').map((p) => parseInt(p, 10))
  if (parts.some((n) => isNaN(n) || n < 0) || parts.length < 2 || parts.length > 3) {
    return { ok: false, message: 'Use H:MM:SS or MM:SS format.' }
  }
  const sec =
    parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1]
  if (sec <= 0) return { ok: false, message: 'Goal time must be positive.' }

  await prisma.race.update({ where: { id: raceId }, data: { goalSec: sec } })
  revalidatePath('/')
  return { ok: true, message: 'Goal updated.' }
}

export async function syncStravaAction(): Promise<ActionResult> {
  try {
    const user = await getCurrentUser()
    const r = await syncStrava(user.id)
    revalidatePath('/')
    return {
      ok: true,
      message: `Synced: ${r.imported} new, ${r.updated} updated, ${r.duplicates} duplicates linked.`,
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Sync failed.' }
  }
}

export async function importFileAction(formData: FormData): Promise<ActionResult> {
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Choose a .fit, .tcx, or .gpx file.' }
  }
  try {
    const user = await getCurrentUser()
    const parsed = await parseActivityFile(file.name, Buffer.from(await file.arrayBuffer()))
    if (!parsed) return { ok: false, message: 'No activity data found in that file.' }
    await saveImportedActivity(user.id, parsed, file.name)
    revalidatePath('/')
    return { ok: true, message: `Imported "${parsed.name}".` }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Import failed.' }
  }
}
