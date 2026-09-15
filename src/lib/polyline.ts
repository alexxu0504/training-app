/** Google encoded polyline decode -> [lat, lng][] */
export function decodePolyline(str: string): [number, number][] {
  const coords: [number, number][] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < str.length) {
    let shift = 0
    let result = 0
    let byte: number
    do {
      byte = str.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    lat += result & 1 ? ~(result >> 1) : result >> 1

    shift = 0
    result = 0
    do {
      byte = str.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    lng += result & 1 ? ~(result >> 1) : result >> 1

    coords.push([lat / 1e5, lng / 1e5])
  }
  return coords
}

/** [lat, lng][] -> Google encoded polyline (used for imported file routes) */
export function encodePolyline(coords: [number, number][]): string {
  let out = ''
  let prevLat = 0
  let prevLng = 0

  const enc = (n: number) => {
    let v = n < 0 ? ~(n << 1) : n << 1
    while (v >= 0x20) {
      out += String.fromCharCode((0x20 | (v & 0x1f)) + 63)
      v >>= 5
    }
    out += String.fromCharCode(v + 63)
  }

  for (const [lat, lng] of coords) {
    const la = Math.round(lat * 1e5)
    const ln = Math.round(lng * 1e5)
    enc(la - prevLat)
    enc(ln - prevLng)
    prevLat = la
    prevLng = ln
  }
  return out
}

/** Downsample coordinates to at most `max` points, preserving start/end. */
export function downsample<T>(coords: T[], max = 400): T[] {
  if (coords.length <= max) return coords
  const step = (coords.length - 1) / (max - 1)
  const out: T[] = []
  for (let i = 0; i < max - 1; i++) out.push(coords[Math.round(i * step)])
  out.push(coords[coords.length - 1])
  return out
}

/** Great-circle distance in meters. */
export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
