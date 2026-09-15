import { decodePolyline } from '@/lib/polyline'
import { SPORT_COLOR, type Sport } from '@/lib/sports'

/** Static SVG route rendering from an encoded polyline — no external tiles. */
export function RouteMap({ polyline, sport }: { polyline: string; sport: string }) {
  const coords = decodePolyline(polyline)
  if (coords.length < 2) return null

  const lats = coords.map((c) => c[0])
  const lngs = coords.map((c) => c[1])
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)

  const W = 800
  const H = 320
  const pad = 24
  const spanLat = Math.max(maxLat - minLat, 1e-6)
  const spanLng = Math.max(maxLng - minLng, 1e-6)
  // Preserve aspect ratio (cos(lat) corrects longitude squash).
  const cosLat = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180))
  const sx = (W - 2 * pad) / (spanLng * cosLat)
  const sy = (H - 2 * pad) / spanLat
  const s = Math.min(sx, sy)

  const pts = coords
    .map(
      ([lat, lng]) =>
        `${(pad + (lng - minLng) * cosLat * s + ((W - 2 * pad) - spanLng * cosLat * s) / 2).toFixed(1)},${(H - pad - (lat - minLat) * s - ((H - 2 * pad) - spanLat * s) / 2).toFixed(1)}`
    )
    .join(' ')

  const color = SPORT_COLOR[(sport as Sport)] ?? SPORT_COLOR.other
  const [slat, slng] = coords[0]
  const [elat, elng] = coords[coords.length - 1]
  const proj = (lat: number, lng: number) => ({
    x: pad + (lng - minLng) * cosLat * s + ((W - 2 * pad) - spanLng * cosLat * s) / 2,
    y: H - pad - (lat - minLat) * s - ((H - 2 * pad) - spanLat * s) / 2,
  })
  const start = proj(slat, slng)
  const end = proj(elat, elng)

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-[#0c0f14]">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
        {/* subtle grid */}
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`v${i}`} x1={(W / 8) * i} x2={(W / 8) * i} y1={0} y2={H} stroke="#18181b" strokeWidth="1" />
        ))}
        {Array.from({ length: 5 }, (_, i) => (
          <line key={`h${i}`} y1={(H / 4) * i} y2={(H / 4) * i} x1={0} x2={W} stroke="#18181b" strokeWidth="1" />
        ))}
        <polyline
          points={pts}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.9"
        />
        <circle cx={start.x} cy={start.y} r="5" fill="#34d399" stroke="#09090b" strokeWidth="2" />
        <circle cx={end.x} cy={end.y} r="5" fill="#f87171" stroke="#09090b" strokeWidth="2" />
      </svg>
    </div>
  )
}
