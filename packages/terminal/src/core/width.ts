import { DOUBLE_WIDTH, ZERO_WIDTH } from '../data/widths.js'

const inRanges = (ranges: readonly number[], code: number): boolean => {
  let low = 0
  let high = ranges.length / 2 - 1
  while (low <= high) {
    const mid = (low + high) >> 1
    if (code < ranges[mid * 2]!) high = mid - 1
    else if (code > ranges[mid * 2 + 1]!) low = mid + 1
    else return true
  }
  return false
}

/** Widths of the first 65,536 code points, filled in when first needed: most text is here. */
let table: Uint8Array | undefined

const build = (): Uint8Array => {
  const widths = new Uint8Array(0x10000).fill(1)
  for (const [ranges, width] of [
    [ZERO_WIDTH, 0],
    [DOUBLE_WIDTH, 2],
  ] as const)
    for (let i = 0; i < ranges.length && ranges[i]! < 0x10000; i += 2) widths.fill(width, ranges[i]!, Math.min(0xffff, ranges[i + 1]!) + 1)
  return widths
}

/** How many cells a code point takes: 0, 1 or 2. Control characters aren't counted here; give it printable ones. */
export function charWidth(code: number): 0 | 1 | 2 {
  if (code < 0x7f) return 1
  if (code < 0x10000) return (table ??= build())[code] as 0 | 1 | 2
  if (inRanges(DOUBLE_WIDTH, code)) return 2
  return inRanges(ZERO_WIDTH, code) ? 0 : 1
}

/** How many cells a string takes. */
export function stringWidth(text: string): number {
  let width = 0
  for (const char of text) width += charWidth(char.codePointAt(0)!)
  return width
}
