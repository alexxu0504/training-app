import Link from 'next/link'
import { Card, SportDot } from './ui'

export type DayActivity = { sports: string[]; count: number }

function isoDay(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function TrainingCalendar({ days }: { days: Record<string, DayActivity> }) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const first = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // Grid starts Monday.
  const lead = (first.getDay() + 6) % 7
  const cells: (Date | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ]
  while (cells.length % 7) cells.push(null)

  return (
    <Card title={monthName} right={
      <span className="flex items-center gap-3 text-[11px] text-zinc-500">
        <span className="flex items-center gap-1"><SportDot sport="swim" size={7} />Swim</span>
        <span className="flex items-center gap-1"><SportDot sport="bike" size={7} />Bike</span>
        <span className="flex items-center gap-1"><SportDot sport="run" size={7} />Run</span>
      </span>
    }>
      <div className="grid grid-cols-7 gap-1.5">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="pb-1 text-center text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const key = isoDay(d)
          const info = days[key]
          const isToday = key === isoDay(now)
          const isFuture = d > now
          return (
            <Link
              key={i}
              href={`/day/${key}`}
              className={`flex aspect-square flex-col items-center justify-center rounded-lg border text-sm transition-colors ${
                isToday
                  ? 'border-emerald-500/60 bg-emerald-950/30'
                  : 'border-zinc-800/70 bg-zinc-900/40 hover:border-zinc-600'
              } ${isFuture ? 'opacity-40' : ''}`}
            >
              <span className={`stat-num text-xs ${isToday ? 'font-bold text-emerald-300' : 'text-zinc-400'}`}>
                {d.getDate()}
              </span>
              <span className="mt-1 flex h-2 items-center gap-1">
                {info
                  ? info.sports.map((s, j) => <SportDot key={j} sport={s} size={6} />)
                  : !isFuture && <span className="text-[9px] text-zinc-700">·</span>}
              </span>
            </Link>
          )
        })}
      </div>
    </Card>
  )
}
