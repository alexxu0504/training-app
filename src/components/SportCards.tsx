import { Card, Delta, SportDot } from './ui'
import { Sparkline } from './Sparkline'
import {
  formatDuration,
  formatMiles,
  formatPaceSecPerMile,
  formatSpeedMph,
  formatSwimPace,
  paceSecPerMileFromSpeed,
} from '@/lib/format'
import type { SportWeek } from '@/lib/metrics'
import { SPORT_COLOR, type Sport } from '@/lib/sports'

function SportCard({
  sport,
  label,
  week,
  history,
}: {
  sport: Sport
  label: string
  week: SportWeek
  history: number[]
}) {
  const color = SPORT_COLOR[sport]
  const metric =
    sport === 'bike'
      ? formatSpeedMph(week.avgSpeedMs)
      : sport === 'swim'
        ? formatSwimPace(week.avgSpeedMs ? 100 / week.avgSpeedMs : null)
        : formatPaceSecPerMile(paceSecPerMileFromSpeed(week.avgSpeedMs))
  const metricLabel = sport === 'bike' ? 'Avg speed' : 'Avg pace'

  return (
    <Card className="relative overflow-hidden transition-colors hover:border-zinc-700">
      <div
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: `linear-gradient(90deg, ${color}, transparent)` }}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SportDot sport={sport} size={10} />
          <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-zinc-200">
            {label}
          </h3>
        </div>
        <Sparkline data={history} color={color} />
      </div>
      <div className="mt-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-zinc-500">Distance</span>
          <span className="stat-num text-xl font-semibold">{formatMiles(week.distanceM)}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-zinc-500">Time</span>
          <span className="stat-num text-lg font-medium text-zinc-300">
            {formatDuration(week.durationSec)}
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-zinc-500">{metricLabel}</span>
          <span className="stat-num text-lg font-medium text-zinc-300">{metric}</span>
        </div>
        <div className="flex items-baseline justify-between border-t border-zinc-800 pt-3">
          <span className="text-xs text-zinc-500">{week.count} sessions</span>
          <Delta pct={week.distChangePct} />
        </div>
      </div>
    </Card>
  )
}

export function SportCards({
  swim,
  bike,
  run,
  history,
}: {
  swim: SportWeek
  bike: SportWeek
  run: SportWeek
  history: Record<'swim' | 'bike' | 'run', number[]>
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <SportCard sport="swim" label="Swim" week={swim} history={history.swim} />
      <SportCard sport="bike" label="Bike" week={bike} history={history.bike} />
      <SportCard sport="run" label="Run" week={run} history={history.run} />
    </div>
  )
}
