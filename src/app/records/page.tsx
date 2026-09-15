import Link from 'next/link'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/user'
import { Card } from '@/components/ui'
import {
  formatDate,
  formatDuration,
  formatMiles,
  formatSpeedMph,
} from '@/lib/format'
import type { PersonalRecord } from '@prisma/client'

export const dynamic = 'force-dynamic'

const GROUPS: { title: string; cats: string[] }[] = [
  { title: 'Running', cats: ['run_5k', 'run_10k', 'run_half', 'run_marathon', 'run_longest'] },
  { title: 'Cycling', cats: ['bike_longest', 'bike_fastest_20mi'] },
  { title: 'Swimming', cats: ['swim_longest', 'swim_100', 'swim_1000', 'swim_2000'] },
  { title: 'Training', cats: ['week_run_mileage', 'week_hours', 'streak_days'] },
]

function value(pr: PersonalRecord) {
  if (pr.valueSec != null) return formatDuration(pr.valueSec)
  if (pr.category === 'bike_fastest_20mi') return formatSpeedMph(pr.valueNum)
  if (pr.category === 'week_hours') return `${pr.valueNum?.toFixed(1)} hrs`
  if (pr.category === 'streak_days') return `${Math.round(pr.valueNum ?? 0)} days`
  if (pr.valueM != null) return formatMiles(pr.valueM)
  return '—'
}

export default async function RecordsPage() {
  const user = await getCurrentUser()
  const prs = await prisma.personalRecord.findMany({ where: { userId: user.id } })
  const byCat = new Map(prs.map((p) => [p.category, p]))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-wide">Personal records</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Computed from imported activities. Time PRs use splits when available.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {GROUPS.map((g) => (
          <Card key={g.title} title={g.title}>
            <ul className="divide-y divide-zinc-800/70">
              {g.cats.map((cat) => {
                const pr = byCat.get(cat)
                return (
                  <li key={cat} className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-zinc-400">
                      {pr?.label ?? cat}
                    </span>
                    {pr ? (
                      <span className="text-right">
                        {pr.activityId ? (
                          <Link
                            href={`/activities/${pr.activityId}`}
                            className="stat-num font-semibold text-zinc-100 hover:text-emerald-300"
                          >
                            {value(pr)}
                          </Link>
                        ) : (
                          <span className="stat-num font-semibold">{value(pr)}</span>
                        )}
                        <span className="ml-2 text-xs text-zinc-600">
                          {formatDate(pr.achievedAt)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-sm text-zinc-600">—</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  )
}
