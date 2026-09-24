import { formatDateShort } from '@/lib/format'
import { SPORT_COLOR } from '@/lib/sports'

/** Weekly training hours, stacked by sport (pure SVG). */
export function StackedHoursChart({
  weeks,
}: {
  weeks: { weekStart: Date; swim: number; bike: number; run: number; other: number }[]
}) {
  const W = 720
  const H = 170
  const pad = { t: 12, r: 0, b: 22, l: 34 }
  const totals = weeks.map((w) => w.swim + w.bike + w.run + w.other)
  const max = Math.max(4, ...totals)
  const bw = (W - pad.l - pad.r) / weeks.length
  const y = (h: number) => pad.t + (1 - h / max) * (H - pad.t - pad.b)

  const segments = [
    ['run', SPORT_COLOR.run],
    ['bike', SPORT_COLOR.bike],
    ['swim', SPORT_COLOR.swim],
    ['other', SPORT_COLOR.other],
  ] as const

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Weekly training hours by sport">
      {[0, max / 2, max].map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W} y1={y(t)} y2={y(t)} stroke="#27272a" strokeWidth="1" />
          <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill="#71717a">
            {Math.round(t)}h
          </text>
        </g>
      ))}
      {weeks.map((w, i) => {
        const x = pad.l + i * bw + 3
        let acc = 0
        const isLast = i === weeks.length - 1
        return (
          <g key={i}>
            {segments.map(([sport, color]) => {
              const h = w[sport]
              if (h <= 0) return null
              const y1 = y(acc + h)
              const y0 = y(acc)
              acc += h
              return (
                <rect
                  key={sport}
                  x={x}
                  y={y1}
                  width={bw - 6}
                  height={Math.max(y0 - y1, 0.5)}
                  fill={color}
                  opacity={isLast ? 1 : 0.55}
                  rx="1.5"
                />
              )
            })}
            {(i % 3 === 0 || isLast) && (
              <text x={x + (bw - 6) / 2} y={H - 8} textAnchor="middle" fontSize="8.5" fill="#71717a">
                {formatDateShort(w.weekStart)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
