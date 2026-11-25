import { blend, colorOf, hex, readable } from '../core/colors.js'
import { glyph, isGlyph } from '../core/glyphs.js'
import { BLINK, BOLD, COLOR_MASK, DIM, INVERSE, INVISIBLE, ITALIC, OVERLINE, STRIKE, UNDERLINE, cellColor, type Line } from '../core/line.js'
import type { Colors } from './theme.js'

export interface RowContext {
  colors: Colors
  cell: { width: number; height: number }
  /** The cells selected, and whether the terminal has the focus. */
  selected: { from: number; to: number } | undefined
  focused: boolean
  /** DECSCNM: the screen's two own colors change places. */
  reverse: boolean
  /** Whether the font draws a character exactly one cell wide, so that it can be part of a run. */
  fits: (text: string) => boolean
  /** A minimum contrast for text. */
  contrast: number
}

const escape = (text: string) => text.replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'))
const UNDERLINES = ['', 'underline', 'underline double', 'underline wavy', 'underline dotted', 'underline dashed']
const glyphs = new Map<string, string>()

/** A mask that draws a box character's shape in a cell. */
function mask(code: number, width: number, height: number): string {
  const key = `${code} ${width} ${height}`
  let css = glyphs.get(key)
  if (!css) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${glyph(code, width, height)}</svg>`
    css = `url(&quot;data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}&quot;) 0 0/${width}px ${height}px repeat-x`
    glyphs.set(key, css)
  }
  return css
}

/** A row's cells as HTML. Everything that came from the program is escaped. */
export function rowHtml(line: Line, cols: number, c: RowContext): string {
  const { theme, all } = c.colors
  const { width: cw, height: ch } = c.cell
  const defaultFg = c.reverse ? theme.background : theme.foreground
  const defaultBg = c.reverse ? theme.foreground : theme.background
  const selectionColor = c.focused ? theme.selection : theme.selectionInactive

  // Nothing to draw past the last cell with something in it.
  let end = cols
  while (end > 0) {
    const x = end - 1
    if (line.has(x) || line.bg(x) & COLOR_MASK || line.fg(x) & INVERSE || (c.selected && x >= c.selected.from && x < c.selected.to)) break
    end--
  }

  let html = ''
  let run = ''
  let runStyle: string | undefined
  let runClass = ''
  const flush = () => {
    if (run) html += runStyle || runClass ? `<span${runClass ? ` class="${runClass}"` : ''}${runStyle ? ` style="${runStyle}"` : ''}>${run}</span>` : run
    run = ''
  }

  for (let x = 0; x < end; x++) {
    const width = line.width(x)
    if (width === 0) continue
    const char = line.char(x)
    const code = line.code(x)
    const fgWord = line.fg(x)
    const bgWord = line.bg(x)
    const ext = line.ext(x)
    const inverse = !!(fgWord & INVERSE)
    const bold = !!(fgWord & BOLD)
    const selected = !!c.selected && x >= c.selected.from && x < c.selected.to
    const drawn = char.length === 1 && isGlyph(code)

    // Colors: inverse swaps them, and bold makes the first eight bright.
    let textWord = (inverse ? bgWord : fgWord) & COLOR_MASK
    const backWord = (inverse ? fgWord : bgWord) & COLOR_MASK
    const text = cellColor(textWord)
    if (bold && text.kind === 'palette' && text.index < 8) textWord += 8
    let fg = colorOf(textWord, all, inverse ? defaultBg : defaultFg)
    let bg = colorOf(backWord, all, inverse ? defaultFg : defaultBg)
    const ownBg = backWord !== 0 || inverse
    if (selected) bg = ownBg ? blend(bg, selectionColor, 0.5) : selectionColor
    const dim = !!(bgWord & DIM)
    // Shapes are part of the picture: their colors stay.
    if (!drawn && c.contrast > 1) fg = readable(fg, bg, dim ? c.contrast / 2 : c.contrast)

    let style = ''
    const color = `${hex(fg)}${dim ? '80' : ''}`
    if (fg !== defaultFg || dim || fgWord & INVISIBLE) style += fgWord & INVISIBLE ? 'color:transparent;' : `color:${color};`
    if (ownBg || selected) style += `background:${hex(bg)};`
    if (bold) style += 'font-weight:bold;'
    if (bgWord & ITALIC) style += 'font-style:italic;'
    // A marked link shows as dashes, unless it has an underline of its own.
    const underline = fgWord & UNDERLINE ? ext?.underline || 1 : ext?.link ? 5 : 0
    const lines = [underline ? UNDERLINES[underline] : '', bgWord & OVERLINE ? 'overline' : '', fgWord & STRIKE ? 'line-through' : ''].filter(Boolean)
    if (lines.length) {
      style += `text-decoration:${lines.join(' ')}`
      if (underline && ext?.underlineColor) style += ` ${hex(colorOf(ext.underlineColor, all, fg))}`
      style += ';'
    }
    const cls = fgWord & BLINK ? 'ws-blink' : ''

    if (drawn && !(fgWord & INVISIBLE)) {
      // The same shape along a row is one element.
      flush()
      runStyle = undefined
      runClass = ''
      let n = 1
      while (x + n < end && line.code(x + n) === code && line.char(x + n) === char && line.fg(x + n) === fgWord && line.bg(x + n) === bgWord && line.ext(x + n) === ext && (!!c.selected && x + n >= c.selected.from && x + n < c.selected.to) === selected) n++
      const back = ownBg || selected ? `background:${hex(bg)};` : ''
      html += `<span class="ws-term-cells ${cls}" style="width:${n * cw}px;${back}"><i style="background:${color};mask:${mask(code, cw, ch)};-webkit-mask:${mask(code, cw, ch)}">${char.repeat(n)}</i></span>`
      x += n - 1
      continue
    }
    if (char && (width === 2 || !c.fits(char))) {
      // A character of another width has its own cells, so what follows stays in line.
      flush()
      runStyle = undefined
      runClass = ''
      html += `<span class="ws-term-cells ${cls}" style="width:${width * cw}px;${style}">${escape(char)}</span>`
      continue
    }
    if (style !== runStyle || cls !== runClass) {
      flush()
      runStyle = style
      runClass = cls
    }
    run += char ? escape(char) : ' '
  }
  flush()
  return html
}
