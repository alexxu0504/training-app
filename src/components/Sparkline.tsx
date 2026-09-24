/** Tiny inline trend sparkline (pure SVG). */
export function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const W = 96
  const H = 28
  const max = Math.max(...data, 1)
  const step = W / (data.length - 1)
  const pts = data
    .map((v, i) => `${(i * step).toFixed(1)},${(H - 3 - (v / max) * (H - 6)).toFixed(1)}`)
    .join(' ')
  const last = pts.split(' ').pop()!.split(',')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-7 w-24" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" opacity="0.85" />
      <circle cx={last[0]} cy={last[1]} r="2.25" fill={color} />
    </svg>
  )
}
