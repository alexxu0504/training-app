import Link from 'next/link'
import { SportBadge } from './ui'
import {
  formatDateShort,
  formatDuration,
  formatMiles,
  formatPaceSecPerMile,
  formatSpeedMph,
  formatSwimPace,
  paceSecPerMileFromSpeed,
} from '@/lib/format'
import type { Activity } from '@prisma/client'

function metricFor(a: Activity) {
  if (a.sport === 'bike') return formatSpeedMph(a.avgSpeedMs)
  if (a.sport === 'swim')
    return a.avgSpeedMs ? formatSwimPace(100 / a.avgSpeedMs) : '—'
  return formatPaceSecPerMile(paceSecPerMileFromSpeed(a.avgSpeedMs))
}

export function ActivityTable({ activities }: { activities: Activity[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-[11px] uppercase tracking-[0.14em] text-zinc-500">
            <th className="pb-2 pr-4 font-medium">Date</th>
            <th className="pb-2 pr-4 font-medium">Activity</th>
            <th className="pb-2 pr-4 font-medium">Sport</th>
            <th className="pb-2 pr-4 font-medium text-right">Distance</th>
            <th className="pb-2 pr-4 font-medium text-right">Time</th>
            <th className="pb-2 pr-4 font-medium text-right">Pace/Speed</th>
            <th className="pb-2 pr-4 font-medium text-right">HR</th>
            <th className="pb-2 font-medium text-right">Source</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((a) => (
            <tr
              key={a.id}
              className="border-b border-zinc-800/60 transition-colors last:border-0 hover:bg-zinc-800/30"
            >
              <td className="py-2.5 pr-4 whitespace-nowrap text-zinc-400">
                {formatDateShort(a.startTime)}
              </td>
              <td className="py-2.5 pr-4">
                <Link
                  href={`/activities/${a.id}`}
                  className="font-medium text-zinc-100 hover:text-emerald-300"
                >
                  {a.name}
                </Link>
              </td>
              <td className="py-2.5 pr-4">
                <SportBadge sport={a.sport} detail={a.sportDetail} />
              </td>
              <td className="stat-num py-2.5 pr-4 text-right">
                {a.distanceM > 0 ? formatMiles(a.distanceM) : '—'}
              </td>
              <td className="stat-num py-2.5 pr-4 text-right">{formatDuration(a.movingSec ?? a.durationSec)}</td>
              <td className="stat-num py-2.5 pr-4 text-right">{metricFor(a)}</td>
              <td className="stat-num py-2.5 pr-4 text-right text-zinc-400">
                {a.avgHr ? `${a.avgHr}` : '—'}
              </td>
              <td className="py-2.5 text-right">
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                  {a.source}
                </span>
                {a.duplicateOfId && (
                  <span className="ml-1 text-[10px] text-zinc-600" title="Duplicate of another source">
                    dup
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
