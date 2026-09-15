import { Card, Stat } from './ui'
import {
  formatDuration,
  formatMiles,
  formatPaceSecPerMile,
} from '@/lib/format'
import type { DashboardData } from '@/lib/metrics'

export function ReadinessCard({ data }: { data: DashboardData }) {
  const r = data.run
  return (
    <Card title="Race readiness" right={
      data.race ? (
        <span className="text-xs text-zinc-500">
          {data.race.name} · {data.daysToRace} days away
        </span>
      ) : undefined
    }>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Weekly mileage" value={`${r.weeklyMiles.toFixed(1)} mi`} />
        <Stat label="4-week avg" value={`${r.fourWeekAvgMiles.toFixed(1)} mi`} />
        <Stat
          label="Longest recent run"
          value={r.longestRecentM ? formatMiles(r.longestRecentM) : '—'}
          sub="last 28 days"
        />
        <Stat label="Runs this week" value={r.runsThisWeek} />
        <Stat
          label="Consistency"
          value={r.consistencyPct != null ? `${r.consistencyPct}%` : '—'}
          sub="active days, last 28d"
        />
        <Stat label="Run time / week" value={formatDuration(r.weeklySec)} />
        <Stat
          label="Avg run pace"
          value={formatPaceSecPerMile(r.avgRunPaceSecPerMile)}
          sub="last 28 days"
        />
        <Stat
          label="Avg run HR"
          value={r.avgRunHr ? `${r.avgRunHr} bpm` : '—'}
          sub="last 28 days"
        />
        <Stat
          label="Since last long run"
          value={r.daysSinceLongRun != null ? `${r.daysSinceLongRun}d` : '—'}
        />
        <Stat
          label="Runs 10+ / 13+ mi"
          value={`${r.runsOver10} / ${r.runsOver13}`}
          sub="last 28 days"
        />
      </div>

      {data.insights.length > 0 && (
        <div className="mt-5 border-t border-zinc-800 pt-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Observations
          </div>
          <ul className="space-y-1.5">
            {data.insights.map((ins, i) => (
              <li key={i} className="flex gap-2 text-sm text-zinc-300">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                {ins}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
