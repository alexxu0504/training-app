import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { Card, SportBadge, Stat } from '@/components/ui'
import { RouteMap } from '@/components/RouteMap'
import {
  formatDateTime,
  formatDuration,
  formatElevation,
  formatMiles,
  formatPaceSecPerMile,
  formatSpeedMph,
  formatSwimPace,
  paceSecPerMileFromSpeed,
} from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const a = await prisma.activity.findUnique({
    where: { id },
    include: { splits: { orderBy: { index: 'asc' } }, duplicates: true },
  })
  if (!a) notFound()

  const paceOrSpeed =
    a.sport === 'bike'
      ? formatSpeedMph(a.avgSpeedMs)
      : a.sport === 'swim'
        ? a.avgSpeedMs
          ? formatSwimPace(100 / a.avgSpeedMs)
          : '—'
        : formatPaceSecPerMile(paceSecPerMileFromSpeed(a.avgSpeedMs))

  const splitPace = (distM: number, sec: number) => {
    if (a.sport === 'bike') return formatSpeedMph(distM / sec)
    if (a.sport === 'swim') return formatSwimPace((sec / distM) * 100)
    return formatPaceSecPerMile(sec / (distM / 1609.344))
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href="/activities" className="text-xs text-zinc-500 hover:text-zinc-300">
          ← Activities
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{a.name}</h1>
          <SportBadge sport={a.sport} detail={a.sportDetail} />
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
            {a.source}
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-500">{formatDateTime(a.startTime)}</p>
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
          <Stat label="Distance" value={a.distanceM > 0 ? formatMiles(a.distanceM) : '—'} />
          <Stat label="Total time" value={formatDuration(a.durationSec)} />
          <Stat label="Moving time" value={formatDuration(a.movingSec)} />
          <Stat label={a.sport === 'bike' ? 'Avg speed' : 'Avg pace'} value={paceOrSpeed} />
          <Stat label="Avg HR" value={a.avgHr ? `${a.avgHr} bpm` : '—'} />
          <Stat label="Max HR" value={a.maxHr ? `${a.maxHr} bpm` : '—'} />
          <Stat label="Elevation gain" value={formatElevation(a.elevGainM)} />
          <Stat label="Calories" value={a.calories ? a.calories.toLocaleString() : '—'} />
        </div>
        {a.duplicates.length > 0 && (
          <p className="mt-4 border-t border-zinc-800 pt-3 text-xs text-zinc-500">
            Also recorded by: {a.duplicates.map((d) => d.source).join(', ')} (deduplicated — this is the primary record)
          </p>
        )}
        {a.duplicateOfId && (
          <p className="mt-4 border-t border-zinc-800 pt-3 text-xs text-amber-400/80">
            This activity is a duplicate of{' '}
            <Link href={`/activities/${a.duplicateOfId}`} className="underline">
                  another record
            </Link>{' '}
            and is excluded from metrics.
          </p>
        )}
      </Card>

      {a.polyline && <RouteMap polyline={a.polyline} sport={a.sport} />}

      {a.splits.length > 0 && (
        <Card title="Splits">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                  <th className="pb-2 pr-4 font-medium">#</th>
                  <th className="pb-2 pr-4 font-medium text-right">Distance</th>
                  <th className="pb-2 pr-4 font-medium text-right">Time</th>
                  <th className="pb-2 pr-4 font-medium text-right">Pace/Speed</th>
                  <th className="pb-2 pr-4 font-medium w-28"></th>
                  <th className="pb-2 pr-4 font-medium text-right">Avg HR</th>
                  <th className="pb-2 font-medium text-right">Elev Δ</th>
                </tr>
              </thead>
              <tbody>
                {a.splits.map((s) => {
                  const speed = s.distanceM / s.durationSec
                  const maxSpeed = Math.max(...a.splits.map((x) => x.distanceM / x.durationSec))
                  return (
                    <tr key={s.id} className="border-b border-zinc-800/60 last:border-0">
                      <td className="stat-num py-2 pr-4 text-zinc-400">{s.index + 1}</td>
                      <td className="stat-num py-2 pr-4 text-right">
                        {a.sport === 'swim'
                          ? `${Math.round(s.distanceM)}`
                          : (s.distanceM / 1609.344).toFixed(2)}
                      </td>
                      <td className="stat-num py-2 pr-4 text-right">{formatDuration(s.durationSec)}</td>
                      <td className="stat-num py-2 pr-4 text-right">{splitPace(s.distanceM, s.durationSec)}</td>
                      <td className="py-2 pr-4">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-emerald-500/80"
                            style={{ width: `${Math.max(8, (speed / maxSpeed) * 100)}%` }}
                          />
                        </div>
                      </td>
                      <td className="stat-num py-2 pr-4 text-right text-zinc-400">{s.avgHr ?? '—'}</td>
                      <td className="stat-num py-2 text-right text-zinc-400">
                        {s.elevDiffM != null ? `${Math.round(s.elevDiffM / 0.3048)} ft` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
