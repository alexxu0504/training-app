import { Card } from './ui'
import { GoalTimeForm } from './GoalTimeForm'
import {
  formatDate,
  formatDuration,
  formatPaceSecPerMile,
  metersToMiles,
} from '@/lib/format'
import type { Race } from '@prisma/client'

export function GoalRaceCard({
  race,
  daysToRace,
  weeksToRace,
  phase,
  goalPaceSecPerMile,
}: {
  race: Race | null
  daysToRace: number | null
  weeksToRace: number | null
  phase: string | null
  goalPaceSecPerMile: number | null
}) {
  if (!race) {
    return (
      <Card className="border-dashed">
        <p className="text-sm text-zinc-400">No goal race set. Seed data or add one.</p>
      </Card>
    )
  }

  return (
    <Card className="relative overflow-hidden border-emerald-900/50 bg-gradient-to-br from-zinc-900 via-zinc-900 to-emerald-950/40">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-400">
            Goal race · {race.raceType}
          </div>
          <h1 className="mt-2 text-2xl font-bold uppercase tracking-wide text-zinc-50 md:text-4xl">
            {race.name}
          </h1>
          <div className="stat-num mt-3 flex items-baseline gap-3">
            <span className="text-5xl font-bold text-zinc-50 md:text-7xl">
              {daysToRace ?? '—'}
            </span>
            <span className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-400">
              days to race day
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-10 gap-y-4 md:text-right">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Race date</div>
            <div className="stat-num mt-1 text-lg font-semibold">{formatDate(race.date)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Distance</div>
            <div className="stat-num mt-1 text-lg font-semibold">
              {metersToMiles(race.distanceM).toFixed(1)} mi
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
              Goal time <GoalTimeForm raceId={race.id} goalSec={race.goalSec} />
            </div>
            <div className="stat-num mt-1 text-lg font-semibold text-emerald-300">
              {race.goalSec ? formatDuration(race.goalSec) : '—'}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Goal pace</div>
            <div className="stat-num mt-1 text-lg font-semibold text-emerald-300">
              {formatPaceSecPerMile(goalPaceSecPerMile)}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
              Weeks remaining
            </div>
            <div className="stat-num mt-1 text-lg font-semibold">{weeksToRace ?? '—'}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
              Training phase
            </div>
            <div className="stat-num mt-1 text-lg font-semibold">{phase ?? '—'}</div>
          </div>
        </div>
      </div>

      {daysToRace !== null && daysToRace > 0 && (
        <div className="mt-6">
          <div className="mb-1.5 flex justify-between text-[10px] uppercase tracking-[0.16em] text-zinc-500">
            <span>Final 16 weeks</span>
            <span>{Math.min(100, Math.max(0, Math.round(((112 - daysToRace) / 112) * 100)))}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all"
              style={{
                width: `${Math.min(100, Math.max(0, ((112 - daysToRace) / 112) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}
    </Card>
  )
}
