import { deflateSync } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))

// ── CRC32 + PNG chunk ─────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (const b of buf) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ b) & 0xFF]
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type)
  const len = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length)
  const crcVal = Buffer.allocUnsafe(4); crcVal.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])))
  return Buffer.concat([len, typeBytes, data, crcVal])
}

// ── SVG geometry (512×512 source space) ──────────────────────────────────────

const SRC = 512
const RX  = 92   // rounded-rect corner radius from SVG

// Colors (RGBA)
const BG      = [0x0d, 0x11, 0x17, 255]  // #0d1117
const CYAN    = [0x06, 0xb6, 0xd4, 255]  // #06b6d4  (upper diamond, fully opaque)
// Lower diamond: #06b6d4 @ opacity 0.35, pre-composited over #0d1117
const CYAN_DIM = [
  Math.round(0.35 * 0x06 + 0.65 * 0x0d),
  Math.round(0.35 * 0xb6 + 0.65 * 0x11),
  Math.round(0.35 * 0xd4 + 0.65 * 0x17),
  255,
]

// Triangle vertices [x, y] in 512-space
const TRI_UP   = [[256, 77],  [406, 241], [106, 241]]
const TRI_DOWN = [[256, 435], [406, 271], [106, 271]]

// ── Geometry helpers ──────────────────────────────────────────────────────────

function triSign(p1x, p1y, p2x, p2y, p3x, p3y) {
  return (p1x - p3x) * (p2y - p3y) - (p2x - p3x) * (p1y - p3y)
}

function inTri(px, py, [[ax, ay], [bx, by], [cx, cy]]) {
  const d1 = triSign(px, py, ax, ay, bx, by)
  const d2 = triSign(px, py, bx, by, cx, cy)
  const d3 = triSign(px, py, cx, cy, ax, ay)
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))
}

function inRoundedRect(px, py, W, r) {
  const nx = Math.max(r, Math.min(px, W - r))
  const ny = Math.max(r, Math.min(py, W - r))
  return (px - nx) ** 2 + (py - ny) ** 2 <= r * r
}

function sample(sx, sy) {
  if (!inRoundedRect(sx, sy, SRC, RX)) return [0, 0, 0, 0]  // transparent outside rounded corners
  if (inTri(sx, sy, TRI_UP))           return CYAN
  if (inTri(sx, sy, TRI_DOWN))         return CYAN_DIM
  return BG
}

// ── PNG encoder (RGBA, 4× supersampled) ──────────────────────────────────────

function createPNG(size) {
  const SS = 4
  const scale = SRC / size
  const rows = []

  for (let y = 0; y < size; y++) {
    const row = Buffer.allocUnsafe(1 + size * 4)
    row[0] = 0  // PNG filter: None
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const [cr, cg, cb, ca] = sample(
            (x + (sx + 0.5) / SS) * scale,
            (y + (sy + 0.5) / SS) * scale,
          )
          r += cr; g += cg; b += cb; a += ca
        }
      }
      const n = SS * SS
      row[1 + x * 4] = Math.round(r / n)
      row[2 + x * 4] = Math.round(g / n)
      row[3 + x * 4] = Math.round(b / n)
      row[4 + x * 4] = Math.round(a / n)
    }
    rows.push(row)
  }

  const ihdr = Buffer.allocUnsafe(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0  // 8-bit RGBA

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Output ────────────────────────────────────────────────────────────────────

const outDir = join(__dir, '../public/icons')
mkdirSync(outDir, { recursive: true })
for (const size of [16, 48, 128]) {
  writeFileSync(join(outDir, `icon${size}.png`), createPNG(size))
  console.log(`✓ icon${size}.png`)
}
