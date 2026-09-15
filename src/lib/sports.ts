export type Sport = 'swim' | 'bike' | 'run' | 'other'

const STRAVA_MAP: Record<string, Sport> = {
  Run: 'run',
  TrailRun: 'run',
  VirtualRun: 'run',
  Treadmill: 'run',
  Ride: 'bike',
  VirtualRide: 'bike',
  EBikeRide: 'bike',
  GravelRide: 'bike',
  MountainBikeRide: 'bike',
  EMountainBikeRide: 'bike',
  Handcycle: 'bike',
  Velomobile: 'bike',
  Swim: 'swim',
  OpenWaterSwim: 'swim',
  PoolSwim: 'swim',
}

const GARMIN_MAP: Record<string, Sport> = {
  running: 'run',
  trail_running: 'run',
  treadmill_running: 'run',
  cycling: 'bike',
  indoor_cycling: 'bike',
  mountain_biking: 'bike',
  lap_swimming: 'swim',
  pool_swimming: 'swim',
  open_water_swimming: 'swim',
  swimming: 'swim',
}

export function normalizeSport(raw: string | null | undefined, source = 'strava'): Sport {
  if (!raw) return 'other'
  if (source === 'garmin' || source === 'file') {
    const g = GARMIN_MAP[raw.toLowerCase()]
    if (g) return g
  }
  return STRAVA_MAP[raw] ?? STRAVA_MAP[raw.replace(/\s/g, '')] ?? 'other'
}

export const SPORT_LABEL: Record<Sport, string> = {
  swim: 'Swim',
  bike: 'Bike',
  run: 'Run',
  other: 'Other',
}

export const SPORT_COLOR: Record<Sport, string> = {
  swim: '#22d3ee', // cyan-400
  bike: '#fb923c', // orange-400
  run: '#34d399', // emerald-400
  other: '#a1a1aa', // zinc-400
}

/** A "long run" for readiness metrics: >= 10 miles or >= 90 minutes. */
export function isLongRun(a: { sport: string; distanceM: number; durationSec: number }) {
  return a.sport === 'run' && (a.distanceM >= 10 * 1609.344 || a.durationSec >= 90 * 60)
}
