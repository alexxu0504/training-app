import type { ReactNode } from 'react'
import { SPORT_COLOR, type Sport } from '@/lib/sports'

export function Card({
  title,
  children,
  className = '',
  right,
}: {
  title?: string
  children: ReactNode
  className?: string
  right?: ReactNode
}) {
  return (
    <section className={`rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 ${className}`}>
      {(title || right) && (
        <div className="mb-4 flex items-center justify-between">
          {title && (
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              {title}
            </h2>
          )}
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">{label}</div>
      <div className="stat-num mt-1 text-xl font-semibold text-zinc-100 md:text-2xl">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-zinc-500">{sub}</div>}
    </div>
  )
}

/** +x% / -x% vs previous period; positive = up. `goodWhenUp` colors accordingly. */
export function Delta({ pct, goodWhenUp = true }: { pct: number | null; goodWhenUp?: boolean }) {
  if (pct === null) return <span className="text-xs text-zinc-600">—</span>
  const up = pct >= 0
  const good = up === goodWhenUp
  return (
    <span className={`text-xs font-medium ${good ? 'text-emerald-400' : 'text-amber-400'}`}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(0)}% vs last wk
    </span>
  )
}

export function SportDot({ sport, size = 8 }: { sport: Sport | string; size?: number }) {
  return (
    <span
      className="inline-block rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: SPORT_COLOR[(sport as Sport)] ?? SPORT_COLOR.other,
      }}
    />
  )
}

export function SportBadge({ sport, detail }: { sport: string; detail?: string | null }) {
  const s = (['swim', 'bike', 'run'].includes(sport) ? sport : 'other') as Sport
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700/80 px-2.5 py-0.5 text-xs font-medium text-zinc-300">
      <SportDot sport={s} size={7} />
      {detail ?? s[0].toUpperCase() + s.slice(1)}
    </span>
  )
}
