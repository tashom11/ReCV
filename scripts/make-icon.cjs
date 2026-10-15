// Rebuilds the small sizes (16 to 32 px) of build/icon.ico with a simplified drawing: "Re:" is unreadable that small,
// and the near-black tile vanishes in dark title bars. The larger sizes (48 px and more) are kept as they are.
// Run with: node scripts/make-icon.cjs      Optional: ICON_PREVIEW=<file.png> writes a magnified contact sheet.
// Pure Node, no dependency: shapes are rasterised with supersampling and encoded as PNG.
const { readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const zlib = require('node:zlib')

const ICO = join(__dirname, '..', 'build', 'icon.ico')
const SMALL = [16, 20, 24, 32]
const KEEP_FROM = 48
const SUPERSAMPLING = 8

// Colors sampled from the logo: tile, lime accent of "Re:", off-white of "CV".
const TILE = [0x13, 0x15, 0x1a]
const LIME = [0xc8, 0xf7, 0x32]
const PAPER = [0xf4, 0xf4, 0xee]
const RIM = [0xff, 0xff, 0xff]
const RIM_ALPHA = 0.4

// --- geometry, in fractions of the icon size ---------------------------------------------------------------------
const CORNER = 0.22
const THICKNESS = 0.105
const LETTER_TOP = 0.34
const LETTER_BOTTOM = 0.9
// The C is an ellipse: letters this tall would not fit side by side in a square otherwise.
const C = { x: 0.31, y: (LETTER_TOP + LETTER_BOTTOM) / 2, rx: 0.2, ry: (LETTER_BOTTOM - LETTER_TOP) / 2, gap: 0.62 }
const V = { left: 0.54, right: 0.89, bottomX: 0.715 }

const insideRoundedRect = (x, y, inset) => {
  const lo = inset
  const hi = 1 - inset
  if (x < lo || x > hi || y < lo || y > hi) return false
  const r = Math.max(0, CORNER - inset)
  const cx = Math.min(Math.max(x, lo + r), hi - r)
  const cy = Math.min(Math.max(y, lo + r), hi - r)
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}

const distanceToSegment = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

const inLetterC = (x, y) => {
  const d = Math.hypot((x - C.x) / C.rx, (y - C.y) / C.ry)
  if (d > 1 || d < 1 - THICKNESS / C.rx) return false
  // Opening on the right: angles within +-gap of the horizontal axis (gap in radians).
  return Math.abs(Math.atan2(y - C.y, x - C.x)) > C.gap
}

const inLetterV = (x, y) =>
  distanceToSegment(x, y, V.left, LETTER_TOP, V.bottomX, LETTER_BOTTOM) <= THICKNESS / 2 ||
  distanceToSegment(x, y, V.right, LETTER_TOP, V.bottomX, LETTER_BOTTOM) <= THICKNESS / 2

const inAccent = (x, y, size) =>
  size >= 24 ? Math.hypot(x - 0.22, y - 0.2) <= 0.08 : x >= 0.13 && x <= 0.4 && y >= 0.13 && y <= 0.23

/** RGBA of one sample point (alpha 0 outside the tile). */
function sample(x, y, size) {
  if (!insideRoundedRect(x, y, 0)) return [0, 0, 0, 0]
  const rim = Math.max(1 / size, 0.045)
  if (!insideRoundedRect(x, y, rim)) {
    // Light rim over the tile: separates the icon from dark title bars.
    return TILE.map((c, i) => c * (1 - RIM_ALPHA) + RIM[i] * RIM_ALPHA).concat(255)
  }
  if (inLetterC(x, y) || inLetterV(x, y)) return [...PAPER, 255]
  if (inAccent(x, y, size)) return [...LIME, 255]
  return [...TILE, 255]
}

function render(size) {
  const rgba = Buffer.alloc(size * size * 4)
  const n = SUPERSAMPLING
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < n; sy++) {
        for (let sx = 0; sx < n; sx++) {
          const s = sample((px + (sx + 0.5) / n) / size, (py + (sy + 0.5) / n) / size, size)
          if (s[3] > 0) {
            r += s[0]
            g += s[1]
            b += s[2]
            a += 1
          }
        }
      }
      const at = (py * size + px) * 4
      if (a > 0) {
        rgba[at] = Math.round(r / a)
        rgba[at + 1] = Math.round(g / a)
        rgba[at + 2] = Math.round(b / a)
        rgba[at + 3] = Math.round((a / (n * n)) * 255)
      }
    }
  }
  return rgba
}

// --- PNG encoding ------------------------------------------------------------------------------------------------
const crcTable = Array.from({ length: 256 }, (_, i) => {
  let c = i
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buffer) => {
  let c = 0xffffffff
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data])
  const out = Buffer.alloc(8 + data.length + 4)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc32(body), 8 + data.length)
  return out
}
function encodePng(rgba, width, height) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  const rows = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) rgba.copy(rows, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// --- ICO read / write --------------------------------------------------------------------------------------------
function readIco(buffer) {
  const count = buffer.readUInt16LE(4)
  return Array.from({ length: count }, (_, i) => {
    const at = 6 + i * 16
    const size = buffer[at] || 256
    const length = buffer.readUInt32LE(at + 8)
    const offset = buffer.readUInt32LE(at + 12)
    return { size, data: buffer.subarray(offset, offset + length) }
  })
}
function writeIco(images) {
  const header = Buffer.alloc(6 + images.length * 16)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = header.length
  images.forEach(({ size, data }, i) => {
    const at = 6 + i * 16
    header[at] = size === 256 ? 0 : size
    header[at + 1] = size === 256 ? 0 : size
    header.writeUInt16LE(1, at + 4)
    header.writeUInt16LE(32, at + 6)
    header.writeUInt32LE(data.length, at + 8)
    header.writeUInt32LE(offset, at + 12)
    offset += data.length
  })
  return Buffer.concat([header, ...images.map((i) => i.data)])
}

const existing = readIco(readFileSync(ICO)).filter((i) => i.size >= KEEP_FROM)
const small = SMALL.map((size) => {
  const rgba = render(size)
  return { size, rgba, data: encodePng(rgba, size, size) }
})
const all = [...small, ...existing].sort((a, b) => a.size - b.size)
writeFileSync(ICO, writeIco(all))
console.log(`icon.ico: ${all.map((i) => i.size).join(', ')}`)

if (process.env.ICON_PREVIEW) {
  // Contact sheet: every small size magnified 8x (nearest neighbour), on a dark and on a light background.
  const zoom = 8
  const gap = 12
  const width = small.reduce((sum, i) => sum + i.size * zoom + gap, gap)
  const rowHeight = SMALL[SMALL.length - 1] * zoom + gap * 2
  const height = rowHeight * 2
  const sheet = Buffer.alloc(width * height * 4)
  for (let row = 0; row < 2; row++) {
    const bg = row === 0 ? [0x20, 0x20, 0x20] : [0xf3, 0xf3, 0xf3]
    for (let y = 0; y < rowHeight; y++) {
      for (let x = 0; x < width; x++) sheet.set([...bg, 255], ((row * rowHeight + y) * width + x) * 4)
    }
    let left = gap
    for (const { size, rgba } of small) {
      for (let y = 0; y < size * zoom; y++) {
        for (let x = 0; x < size * zoom; x++) {
          const s = (Math.floor(y / zoom) * size + Math.floor(x / zoom)) * 4
          const a = rgba[s + 3] / 255
          const at = ((row * rowHeight + gap + y) * width + left + x) * 4
          for (let k = 0; k < 3; k++) sheet[at + k] = Math.round(rgba[s + k] * a + bg[k] * (1 - a))
        }
      }
      left += size * zoom + gap
    }
  }
  writeFileSync(process.env.ICON_PREVIEW, encodePng(sheet, width, height))
}
