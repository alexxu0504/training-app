import { formatDateShort, metersToMiles } from '@/lib/format'

/** Weekly run-mileage bar chart (pure SVG, no deps). */
export function MileageChart({
  weeks,
}: {
  weeks: { weekStart: Date; miles: number; longestM: number }[]
}) {
  const W = 720
  const H = 160
  const pad = { t: 12, r: 0, b: 22, l: 34 }
  const max = Math.max(10, ...weeks.map((w) => w.miles))
  const bw = (W - pad.l - pad.r) / weeks.length

  const ticks = [0, Math.ceil(max / 2), Math.ceil(max)]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Weekly run mileage">
      {ticks.map((t) => {
        const y = pad.t + (1 - t / max) * (H - pad.t - pad.b)
        return (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="#27272a" strokeWidth="1" />
            <text x={pad.l - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#71717a">
              {t}
            </text>
          </g>
        )
      })}
      {weeks.map((w, i) => {
        const h = (w.miles / max) * (H - pad.t - pad.b)
        const x = pad.l + i * bw + 2
        const isLast = i === weeks.length - 1
        return (
          <g key={i}>
            <rect
              x={x}
              y={H - pad.b - h}
              width={bw - 4}
              height={Math.max(h, 1)}
              rx="3"
              fill={isLast ? '#34d399' : '#065f46'}
            />
            <circle
              cx={x + (bw - 4) / 2}
              cy={H - pad.b - (metersToMiles(w.longestM) / max) * (H - pad.t - pad.b)}
              r="2.5"
              fill="#fbbf24"
            />
            {(i % 3 === 0 || isLast) && (
              <text
                x={x + (bw - 4) / 2}
                y={H - 8}
                textAnchor="middle"
                fontSize="8.5"
                fill="#71717a"
              >
                {formatDateShort(w.weekStart)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
