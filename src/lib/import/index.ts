import { XMLParser } from 'fast-xml-parser'
import { haversineM, encodePolyline, downsample, M_PER_MI } from './geo'
import { normalizeSport } from '../sports'

export type ParsedPoint = {
  t: number // epoch ms
  lat?: number
  lng?: number
  ele?: number
  hr?: number
  distM?: number
}

export type ParsedActivity = {
  name: string
  sport: string
  sportDetail: string | null
  startTime: Date
  durationSec: number
  movingSec: number | null
  distanceM: number
  elevGainM: number | null
  avgHr: number | null
  maxHr: number | null
  avgSpeedMs: number | null
  calories: number | null
  polyline: string | null
  splits: { distanceM: number; durationSec: number; avgHr?: number | null; elevDiffM?: number | null }[]
}

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
})

function toArray<T>(x: T | T[] | undefined | null): T[] {
  if (x == null) return []
  return Array.isArray(x) ? x : [x]
}

function elevGain(points: ParsedPoint[]): number | null {
  let gain = 0
  let prev: number | undefined
  for (const p of points) {
    if (p.ele == null) continue
    if (prev != null && p.ele > prev) gain += p.ele - prev
    prev = p.ele
  }
  return gain > 0 ? Math.round(gain) : null
}

function hrStats(points: ParsedPoint[]) {
  const hrs = points.map((p) => p.hr).filter((h): h is number => h != null)
  if (!hrs.length) return { avgHr: null, maxHr: null }
  return {
    avgHr: Math.round(hrs.reduce((s, h) => s + h, 0) / hrs.length),
    maxHr: Math.max(...hrs),
  }
}

/** Compute distance + per-mile splits from a point stream. */
function distanceAndSplits(points: ParsedPoint[]) {
  let dist = 0
  let prev: ParsedPoint | undefined
  const splits: ParsedActivity['splits'] = []
  let splitStart = 0
  let splitStartDist = 0
  const splitHrs: number[] = []
  let splitElevStart: number | undefined

  for (const p of points) {
    if (prev?.lat != null && prev?.lng != null && p.lat != null && p.lng != null) {
      dist += haversineM(prev.lat, prev.lng, p.lat, p.lng)
    }
    if (p.hr) splitHrs.push(p.hr)
    if (splitElevStart == null && p.ele != null) splitElevStart = p.ele
    prev = p

    while (dist - splitStartDist >= M_PER_MI && p.t > splitStart) {
      splits.push({
        distanceM: M_PER_MI,
        durationSec: Math.round((p.t - splitStart) / 1000),
        avgHr: splitHrs.length
          ? Math.round(splitHrs.reduce((s, h) => s + h, 0) / splitHrs.length)
          : null,
        elevDiffM:
          splitElevStart != null && p.ele != null ? p.ele - splitElevStart : null,
      })
      splitStart = p.t
      splitStartDist += M_PER_MI
      splitHrs.length = 0
      splitElevStart = p.ele
    }
  }

  // Trailing partial split.
  const rem = dist - splitStartDist
  const last = points[points.length - 1]
  if (rem > 100 && last && last.t > splitStart) {
    splits.push({
      distanceM: Math.round(rem),
      durationSec: Math.round((last.t - splitStart) / 1000),
      avgHr: splitHrs.length
        ? Math.round(splitHrs.reduce((s, h) => s + h, 0) / splitHrs.length)
        : null,
    })
  }
  return { dist, splits }
}

function finishParsed(
  name: string,
  sportRaw: string,
  points: ParsedPoint[],
  opts: { distanceM?: number; durationSec?: number; splits?: ParsedActivity['splits']; avgHr?: number | null; maxHr?: number | null; calories?: number | null } = {}
): ParsedActivity | null {
  if (!points.length) return null
  const start = points[0].t
  const end = points[points.length - 1].t
  const computed = distanceAndSplits(points)
  const distanceM = opts.distanceM ?? computed.dist
  const durationSec = opts.durationSec ?? Math.round((end - start) / 1000)
  if (durationSec <= 0) return null

  const hrs = hrStats(points)
  const coords = downsample(
    points.filter((p): p is ParsedPoint & { lat: number; lng: number } => p.lat != null && p.lng != null)
      .map((p) => [p.lat, p.lng] as [number, number])
  )

  return {
    name,
    sport: normalizeSport(sportRaw, 'file'),
    sportDetail: sportRaw,
    startTime: new Date(start),
    durationSec,
    movingSec: durationSec,
    distanceM: Math.round(distanceM),
    elevGainM: elevGain(points),
    avgHr: opts.avgHr ?? hrs.avgHr,
    maxHr: opts.maxHr ?? hrs.maxHr,
    avgSpeedMs: distanceM > 0 ? distanceM / durationSec : null,
    calories: opts.calories ?? null,
    polyline: coords.length >= 2 ? encodePolyline(coords) : null,
    splits: opts.splits?.length ? opts.splits : computed.splits,
  }
}

export function parseGpx(buf: Buffer, filename: string): ParsedActivity | null {
  const doc = xml.parse(buf.toString('utf8'))
  const gpx = doc.gpx ?? doc.Gpx ?? doc
  const trk = toArray(gpx.trk)[0]
  if (!trk) return null
  const name = trk.name ?? filename.replace(/\.gpx$/i, '')
  const sportRaw = trk.type ?? 'run'

  const points: ParsedPoint[] = []
  for (const seg of toArray(trk.trkseg)) {
    for (const p of toArray(seg?.trkpt)) {
      const t = p.time ? Date.parse(p.time) : NaN
      if (isNaN(t)) continue
      const ext = p.extensions?.TrackPointExtension ?? p.extensions
      points.push({
        t,
        lat: parseFloat(p['@_lat']),
        lng: parseFloat(p['@_lon']),
        ele: p.ele != null ? parseFloat(p.ele) : undefined,
        hr: ext?.hr != null ? parseInt(ext.hr) : ext?.heart_rate != null ? parseInt(ext.heart_rate) : undefined,
      })
    }
  }
  return finishParsed(name, sportRaw, points)
}

export function parseTcx(buf: Buffer, filename: string): ParsedActivity | null {
  const doc = xml.parse(buf.toString('utf8'))
  const act = toArray(doc.TrainingCenterDatabase?.Activities?.Activity)[0]
  if (!act) return null
  const sportRaw = act['@_Sport'] ?? 'run'
  const name = act.Id ?? filename.replace(/\.tcx$/i, '')

  const points: ParsedPoint[] = []
  const splits: ParsedActivity['splits'] = []
  for (const lap of toArray(act.Lap)) {
    for (const tp of toArray(lap?.Track?.Trackpoint)) {
      const t = tp.Time ? Date.parse(tp.Time) : NaN
      if (isNaN(t)) continue
      points.push({
        t,
        lat: tp.Position ? parseFloat(tp.Position.LatitudeDegrees) : undefined,
        lng: tp.Position ? parseFloat(tp.Position.LongitudeDegrees) : undefined,
        ele: tp.AltitudeMeters != null ? parseFloat(tp.AltitudeMeters) : undefined,
        hr: tp.HeartRateBpm?.Value != null ? parseInt(tp.HeartRateBpm.Value) : undefined,
        distM: tp.DistanceMeters != null ? parseFloat(tp.DistanceMeters) : undefined,
      })
    }
    if (lap?.TotalTimeSeconds && lap?.DistanceMeters) {
      splits.push({
        distanceM: parseFloat(lap.DistanceMeters),
        durationSec: Math.round(parseFloat(lap.TotalTimeSeconds)),
        avgHr: lap.AverageHeartRateBpm?.Value != null ? parseInt(lap.AverageHeartRateBpm.Value) : null,
      })
    }
  }
  const totalDist = points.map((p) => p.distM).filter((d): d is number => d != null).pop()
  return finishParsed(name, sportRaw, points, {
    distanceM: totalDist,
    splits,
  })
}

export async function parseFit(buf: Buffer, filename: string): Promise<ParsedActivity | null> {
  // fit-file-parser is CommonJS with a callback API.
  const mod = await import('fit-file-parser')
  const FitParser = (mod as { default?: unknown }).default ?? mod
  const data = await new Promise<Record<string, unknown>>((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new (FitParser as any)({ force: true, speedUnit: 'm/s', lengthUnit: 'm' }).parse(
      buf,
      (err: unknown, d: Record<string, unknown>) => (err ? reject(err) : resolve(d))
    )
  })

  const sessions = toArray(data.sessions as Record<string, unknown> | Record<string, unknown>[])
  const session = sessions[0] ?? {}
  const sportRaw = (session.sport as string) ?? 'run'
  const name = (session.sport as string)
    ? `${String(session.sport).replace(/_/g, ' ')} — ${filename.replace(/\.fit$/i, '')}`
    : filename.replace(/\.fit$/i, '')

  const SEMI = 180 / 2 ** 31
  const records = toArray(data.records as Record<string, unknown> | Record<string, unknown>[])
  const points: ParsedPoint[] = records
    .map((r) => ({
      t: r.timestamp ? new Date(r.timestamp as string).getTime() : NaN,
      lat: r.position_lat != null ? (r.position_lat as number) * SEMI : undefined,
      lng: r.position_long != null ? (r.position_long as number) * SEMI : undefined,
      ele: (r.enhanced_altitude ?? r.altitude) as number | undefined,
      hr: r.heart_rate as number | undefined,
      distM: r.distance as number | undefined,
    }))
    .filter((p) => !isNaN(p.t))

  const laps = toArray(data.laps as Record<string, unknown> | Record<string, unknown>[])
  const splits: ParsedActivity['splits'] = laps
    .filter((l) => l.total_distance && l.total_timer_time)
    .map((l) => ({
      distanceM: l.total_distance as number,
      durationSec: Math.round(l.total_timer_time as number),
      avgHr: (l.avg_heart_rate as number) ?? null,
    }))

  return finishParsed(name, sportRaw, points, {
    distanceM: (session.total_distance as number) ?? points.map((p) => p.distM).filter((d): d is number => d != null).pop(),
    durationSec: session.total_elapsed_time ? Math.round(session.total_elapsed_time as number) : undefined,
    splits,
    avgHr: (session.avg_heart_rate as number) ?? null,
    maxHr: (session.max_heart_rate as number) ?? null,
    calories: (session.total_calories as number) ?? null,
  })
}

export async function parseActivityFile(filename: string, buf: Buffer): Promise<ParsedActivity | null> {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.gpx')) return parseGpx(buf, filename)
  if (lower.endsWith('.tcx')) return parseTcx(buf, filename)
  if (lower.endsWith('.fit') || lower.endsWith('.zip')) return parseFit(buf, filename)
  throw new Error(`Unsupported file type: ${filename}`)
}
