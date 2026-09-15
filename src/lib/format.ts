export const M_PER_MI = 1609.344
export const M_PER_KM = 1000
export const M_PER_FT = 0.3048

export function milesToMeters(mi: number) {
  return mi * M_PER_MI
}

export function metersToMiles(m: number) {
  return m / M_PER_MI
}

export function formatMiles(m: number, digits = 1) {
  return `${(m / M_PER_MI).toFixed(digits)} mi`
}

export function formatMeters(m: number) {
  return `${Math.round(m).toLocaleString()} m`
}

export function formatElevation(m: number | null | undefined) {
  if (m == null) return '—'
  return `${Math.round(m / M_PER_FT).toLocaleString()} ft`
}

/** 3661 -> "1:01:01", 540 -> "9:00" */
export function formatDuration(sec: number | null | undefined) {
  if (sec == null || !isFinite(sec)) return '—'
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
  return `${m}:${String(r).padStart(2, '0')}`
}

/** Seconds-per-mile -> "8:24 /mi" */
export function formatPaceSecPerMile(secPerMile: number | null | undefined) {
  if (secPerMile == null || !isFinite(secPerMile) || secPerMile <= 0) return '—'
  const m = Math.floor(secPerMile / 60)
  const s = Math.round(secPerMile % 60)
  return `${m}:${String(s).padStart(2, '0')} /mi`
}

export function paceSecPerMileFromSpeed(avgSpeedMs: number | null | undefined) {
  if (!avgSpeedMs || avgSpeedMs <= 0) return null
  return M_PER_MI / avgSpeedMs
}

/** m/s -> "18.2 mph" */
export function formatSpeedMph(avgSpeedMs: number | null | undefined) {
  if (!avgSpeedMs) return '—'
  return `${(avgSpeedMs * 2.236936).toFixed(1)} mph`
}

/** seconds per 100 units (yd or m) -> "1:42 /100" */
export function formatSwimPace(secPer100: number | null | undefined) {
  if (secPer100 == null || !isFinite(secPer100) || secPer100 <= 0) return '—'
  const m = Math.floor(secPer100 / 60)
  const s = Math.round(secPer100 % 60)
  return `${m}:${String(s).padStart(2, '0')} /100`
}

export function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDateShort(d: Date | string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatDateTime(d: Date | string) {
  return new Date(d).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatWeekday(d: Date | string) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short' })
}

/** Percent change; null when no prior baseline. */
export function pctChange(current: number, previous: number): number | null {
  if (!previous || previous <= 0) return null
  return ((current - previous) / previous) * 100
}
