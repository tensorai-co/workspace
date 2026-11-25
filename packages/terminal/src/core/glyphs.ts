// Box drawing and block characters, drawn to fill their cells exactly so lines meet whatever the font has.

/**
 * Each character from U+2500: the weight of its lines up, right, down and left (0 none, 1 light, 2 heavy, 3 double), then
 * how many dashes, or "a" for an arc and "d" for a diagonal. From the names in the Unicode standard.
 */
const ARMS =
  '0101 0202 1010 2020 01013 02023 10103 20203 01014 02024 10104 20204 0110 0210 0120 0220 0011 0012 0021 0022 1100 1200 2100 2200 1001 1002 2001 2002 1110 1210 2110 1120 2120 2210 1220 2220 1011 1012 2011 1021 2021 2012 1022 2022 0111 0112 0211 0212 0121 0122 0221 0222 1101 1102 1201 1202 2101 2102 2201 2202 1111 1112 1211 1212 2111 1121 2121 2112 2211 1122 1221 2212 1222 2122 2221 2222 01012 02022 10102 20202 0303 3030 0310 0130 0330 0013 0031 0033 1300 3100 3300 1003 3001 3003 1310 3130 3330 1013 3031 3033 0313 0131 0333 1303 3101 3303 1313 3131 3333 0110a 0011a 1001a 1100a 0000d 0000d 0000d 0001 1000 0100 0010 0002 2000 0200 0020 0201 1020 0102 2010'.split(
    ' ',
  )

/** Whether a character is drawn here rather than by the font. */
export const isGlyph = (code: number): boolean => code >= 0x2500 && code <= 0x259f

const n = (value: number) => +value.toFixed(2)
const rect = (x0: number, y0: number, x1: number, y1: number) => (x1 > x0 && y1 > y0 ? `M${n(x0)} ${n(y0)}H${n(x1)}V${n(y1)}H${n(x0)}Z` : '')

/** A character's shape in a cell of this size, as the inside of an SVG filled with the text's color. */
export function glyph(code: number, w: number, h: number): string {
  if (code >= 0x2580) return block(code, w, h)
  const arms = ARMS[code - 0x2500]!
  const [up, right, down, left] = [...arms.slice(0, 4)].map(Number) as [number, number, number, number]
  const extra = arms[4]
  const cx = w / 2
  const cy = h / 2
  const light = 1

  if (extra === 'd') {
    const lines = [code !== 0x2572 ? `M${w} 0L0 ${h}` : '', code !== 0x2571 ? `M0 0L${w} ${h}` : '']
    return `<path d="${lines.join('')}" stroke="#000" stroke-width="${light}" fill="none"/>`
  }
  if (extra === 'a') {
    // A quarter turn, with straight ends to the edges.
    const r = Math.min(cx, cy)
    const ex = right ? w : 0
    const ey = down ? h : 0
    const sx = right ? 1 : -1
    const sy = down ? 1 : -1
    return `<path d="M${n(cx)} ${ey}V${n(cy + sy * r)}Q${n(cx)} ${n(cy)} ${n(cx + sx * r)} ${n(cy)}H${ex}" stroke="#000" stroke-width="${light}" fill="none"/>`
  }
  if (extra) {
    // Dashes, with the gaps half at either end so they tile.
    const count = Number(extra)
    const vertical = up > 0
    const length = vertical ? h : w
    const t = thickness(up || right) / 2
    const step = length / count
    const gap = Math.max(1, step * 0.3)
    let d = ''
    for (let i = 0; i < count; i++) {
      const a = i * step + gap / 2
      const b = (i + 1) * step - gap / 2
      d += vertical ? rect(cx - t, a, cx + t, b) : rect(a, cy - t, b, cy + t)
    }
    return `<path d="${d}"/>`
  }

  // Straight arms. `along` runs from the middle to the edge; `across` is the axis the line's width is on.
  const gap = 0.15 * w
  let d = ''
  const arm = (weight: number, opposite: number, sideA: number, sideB: number, draw: (from: number, offset: number, half: number) => string) => {
    if (!weight) return
    const half = thickness(weight) / 2
    if (weight === 3) {
      for (const [offset, near, far] of [
        [-gap, sideA, sideB],
        [gap, sideB, sideA],
      ] as const) {
        // Where this line of the two begins: at the crossing line on its own side, or round the outside of a corner.
        const from = near === 3 ? gap : near ? 0 : opposite === 3 ? 0 : far === 3 ? -gap : far ? -0.5 : 0
        d += draw(from - (near === 3 || far === 3 ? 0.5 : 0), offset, 0.5)
      }
      return
    }
    const doubles = (sideA === 3 ? 1 : 0) + (sideB === 3 ? 1 : 0)
    const cross = Math.max(sideA, sideB)
    const from = doubles === 2 ? (opposite ? 0 : gap - 0.5) : doubles === 1 ? -gap - 0.5 : cross ? -thickness(cross) / 2 : opposite ? -0.01 : 0
    d += draw(from, 0, half)
  }
  arm(up, down, left, right, (from, o, half) => rect(cx + o - half, 0, cx + o + half, cy - from))
  arm(down, up, left, right, (from, o, half) => rect(cx + o - half, cy + from, cx + o + half, h))
  arm(left, right, up, down, (from, o, half) => rect(0, cy + o - half, cx - from, cy + o + half))
  arm(right, left, up, down, (from, o, half) => rect(cx + from, cy + o - half, w, cy + o + half))
  return `<path d="${d}"/>`
}

const thickness = (weight: number) => (weight === 2 ? 3 : 1)

function block(code: number, w: number, h: number): string {
  const path = (d: string) => `<path d="${d}"/>`
  const eighth = (i: number, size: number) => (size * i) / 8
  if (code === 0x2580) return path(rect(0, 0, w, h / 2))
  if (code <= 0x2588) return path(rect(0, h - eighth(code - 0x2580, h), w, h))
  if (code <= 0x258f) return path(rect(0, 0, eighth(0x2590 - code, w), h))
  if (code === 0x2590) return path(rect(w / 2, 0, w, h))
  if (code <= 0x2593) return `<path d="${rect(0, 0, w, h)}" opacity="${(code - 0x2590) / 4}"/>`
  if (code === 0x2594) return path(rect(0, 0, w, eighth(1, h)))
  if (code === 0x2595) return path(rect(w - eighth(1, w), 0, w, h))
  // Quadrants: upper left, upper right, lower left, lower right.
  const quadrants = [0b0010, 0b0001, 0b1000, 0b1011, 0b1001, 0b1110, 0b1101, 0b0100, 0b0110, 0b0111][code - 0x2596]!
  let d = ''
  if (quadrants & 8) d += rect(0, 0, w / 2, h / 2)
  if (quadrants & 4) d += rect(w / 2, 0, w, h / 2)
  if (quadrants & 2) d += rect(0, h / 2, w / 2, h)
  if (quadrants & 1) d += rect(w / 2, h / 2, w, h)
  return path(d)
}
