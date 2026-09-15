// Generates PNG app icons (no deps): dark rounded tile + emerald "E".
// Usage: node scripts/gen-icons.mjs
import zlib from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const BG = [9, 9, 11, 255] // zinc-950
const FG = [52, 211, 153, 255] // emerald-400

function drawIcon(size, { fullBleed = false } = {}) {
  const px = Buffer.alloc(size * size * 4)
  const radius = fullBleed ? 0 : size * 0.22
  const set = (x, y, c) => {
    const i = (y * size + x) * 4
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = c[3]
  }
  const inRounded = (x, y) => {
    if (fullBleed) return true
    const r = radius
    const corners = [[r, r], [size - r, r], [r, size - r], [size - r, size - r]]
    const inCornerZone =
      (x < r || x >= size - r) && (y < r || y >= size - r)
    if (!inCornerZone) return true
    const cx = x < r ? r : size - r
    const cy = y < r ? r : size - r
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
  }

  // "E" letterform as fraction of size.
  const E = [
    [0.28, 0.22, 0.40, 0.78], // stem
    [0.28, 0.22, 0.74, 0.32], // top bar
    [0.28, 0.45, 0.66, 0.55], // mid bar
    [0.28, 0.68, 0.74, 0.78], // bottom bar
  ]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!inRounded(x, y)) {
        set(x, y, [0, 0, 0, 0])
        continue
      }
      const fx = x / size
      const fy = y / size
      const inE = E.some(([x1, y1, x2, y2]) => fx >= x1 && fx < x2 && fy >= y1 && fy < y2)
      set(x, y, inE ? FG : BG)
    }
  }
  return encodePng(size, px)
}

mkdirSync('public/icons', { recursive: true })
const jobs = [
  ['public/icons/icon-192.png', 192, {}],
  ['public/icons/icon-512.png', 512, {}],
  ['public/icons/icon-512-maskable.png', 512, { fullBleed: true }],
  ['src/app/apple-icon.png', 180, { fullBleed: true }],
  ['src/app/icon.png', 32, {}],
]
for (const [path, size, opts] of jobs) {
  writeFileSync(path, drawIcon(size, opts))
  console.log(`wrote ${path} (${size}px)`)
}
