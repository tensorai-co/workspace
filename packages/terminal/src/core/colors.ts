import { cellColor } from './line.js'

/** The colors a screen is drawn with, as 0xRRGGBB. */
export interface Theme {
  foreground: number
  background: number
  cursor: number
  cursorText: number
  /** Over the background, as it ends up. */
  selection: number
  selectionInactive: number
  /** The 16 colors programs name. */
  ansi: readonly number[]
}

/** The least contrast text has with what's behind it: the default. */
export const MIN_CONTRAST = 4.5

/** The full palette of 256: 16 of the theme, a 6×6×6 cube and 24 grays. */
export function palette(ansi: readonly number[]): number[] {
  const colors = ansi.slice(0, 16)
  const steps = [0, 95, 135, 175, 215, 255]
  for (const r of steps) for (const g of steps) for (const b of steps) colors.push((r << 16) | (g << 8) | b)
  for (let i = 0; i < 24; i++) colors.push((8 + i * 10) * 0x010101)
  return colors
}

export const hex = (rgb: number): string => `#${rgb.toString(16).padStart(6, '0')}`

/** One color over another. */
export function blend(under: number, over: number, alpha: number): number {
  const mix = (shift: number) => Math.round(((under >> shift) & 0xff) * (1 - alpha) + ((over >> shift) & 0xff) * alpha)
  return (mix(16) << 16) | (mix(8) << 8) | mix(0)
}

function luminance(r: number, g: number, b: number): number {
  const part = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return part(r) * 0.2126 + part(g) * 0.7152 + part(b) * 0.0722
}

const luminanceOf = (rgb: number) => luminance((rgb >> 16) & 0xff, (rgb >> 8) & 0xff, rgb & 0xff)

export function contrast(a: number, b: number): number {
  const x = luminanceOf(a)
  const y = luminanceOf(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** Moves a color a tenth of the way toward black or white at a time, until there's contrast enough or nowhere left. */
function shade(fg: number, bg: number, ratio: number, toward: 0 | 255): number {
  let parts = [(fg >> 16) & 0xff, (fg >> 8) & 0xff, fg & 0xff]
  let color = fg
  while (contrast(color, bg) < ratio && parts.some((v) => v !== toward)) {
    parts = parts.map((v) => (toward === 0 ? v - Math.ceil(v * 0.1) : Math.min(255, v + Math.ceil((255 - v) * 0.1))))
    color = (parts[0]! << 16) | (parts[1]! << 8) | parts[2]!
  }
  return color
}

/** Text's color, made readable on a background. It goes darker or lighter, whichever it already is, if that's enough. */
export function readable(fg: number, bg: number, ratio = MIN_CONTRAST): number {
  if (contrast(fg, bg) >= ratio) return fg
  const first = luminanceOf(fg) < luminanceOf(bg) ? 0 : 255
  const a = shade(fg, bg, ratio, first)
  if (contrast(a, bg) >= ratio) return a
  const b = shade(fg, bg, ratio, first === 0 ? 255 : 0)
  return contrast(a, bg) > contrast(b, bg) ? a : b
}

/** A color word's color. */
export function colorOf(word: number, colors: readonly number[], fallback: number): number {
  const color = cellColor(word)
  if (color.kind === 'default') return fallback
  return color.kind === 'palette' ? (colors[color.index] ?? fallback) : color.rgb
}
