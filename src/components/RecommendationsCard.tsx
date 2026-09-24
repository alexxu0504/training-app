import { Card } from './ui'
import type { Recommendation } from '@/lib/recommendations'

const TONE = {
  good: { dot: 'bg-emerald-400', label: 'On track' },
  warn: { dot: 'bg-amber-400', label: 'Watch' },
  info: { dot: 'bg-sky-400', label: 'Note' },
} as const

export function RecommendationsCard({ recs }: { recs: Recommendation[] }) {
  if (!recs.length) return null
  return (
    <Card title="Recommendations" right={
      <span className="text-[11px] text-zinc-500">from your training data</span>
    }>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {recs.map((r, i) => (
          <li key={i} className="flex gap-3 rounded-lg border border-zinc-800/70 bg-zinc-900/40 p-3.5">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE[r.tone].dot}`} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-zinc-100">{r.title}</span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                  {TONE[r.tone].label}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">{r.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
