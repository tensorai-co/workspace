import { EditorState, EditorView } from '@tensorai-co/workspace/editor'
import type { CompletionItem } from '@tensorai-co/workspace/host'
import { languageById } from '@tensorai-co/workspace/languages'
import { ScriptedLanguageService } from '@tensorai-co/workspace/testing'
import { round, settle, type Check } from './measure'
import * as ref from './reference'

/** Math's members for `Math.`. */
const MATH: CompletionItem[] = [
  ...['E', 'LN10', 'LN2', 'LOG10E', 'LOG2E', 'PI', 'SQRT1_2', 'SQRT2'].map((label): CompletionItem => ({ label, kind: 'field', detail: `(property) Math.${label}: number` })),
  ...['abs', 'acos', 'acosh', 'asin', 'asinh', 'atan', 'floor', 'log', 'log10', 'log1p', 'log2', 'max', 'min'].map((label): CompletionItem => ({ label, kind: 'method', detail: `(method) Math.${label}(x: number): number` })),
]
MATH.push({ label: 'Symbol', kind: 'variable', detail: 'var Symbol: SymbolConstructor' })
MATH.find((i) => i.label === 'log')!.documentation = 'Returns the natural logarithm (base e) of a number.\n\n*@param* `x` — A numeric expression.'

const DOC = "const total: number = 'x'\nMath."

/** The suggest list, its details, the hover and the wavy lines, against the reference. */
export async function checkLanguages(is: Check): Promise<void> {
  const l = ref.languages
  const parent = document.createElement('div')
  parent.style.cssText = 'position:fixed;left:0;top:0;width:600px;height:300px;z-index:10'
  document.body.append(parent)
  const service = new ScriptedLanguageService({
    completions: MATH,
    diagnostics: [
      { from: 6, to: 11, severity: 'error', message: "Type 'string' is not assignable to type 'number'.", source: 'ts', code: 2322 },
      { from: 22, to: 25, severity: 'warning', message: 'W' },
      { from: 26, to: 30, severity: 'info', message: 'I' },
    ],
    hover: { contents: '```typescript\nconst total: number\n```' },
  })
  const view = new EditorView({ parent, state: EditorState.create({ doc: DOC, selection: DOC.length, language: languageById('typescript') }), languages: { service } })
  const css = getComputedStyle
  const rel = (el: Element | Range, from: Element) => {
    const a = el.getBoundingClientRect()
    const b = from.getBoundingClientRect()
    return [a.left - b.left, a.top - b.top, a.width, a.height].map(round)
  }
  const text = (el: Element) => {
    const r = document.createRange()
    r.selectNodeContents(el)
    return r
  }
  try {
    view.focus()
    view.triggerSuggest()
    await settle()
    const w = parent.querySelector<HTMLElement>('.ws-suggest')!
    const cursor = view.coordsAt(DOC.length)!
    const wb = w.getBoundingClientRect()
    is('suggest: place', `${round(wb.top - cursor.bottom)} ${round(Math.min(Math.round(cursor.left), innerWidth - l.suggest.rightMargin - l.suggest.width) - wb.left)}`, '0 0')
    is('suggest: size', `${round(wb.width)} ${round(wb.height)}`, `${l.suggest.width} ${l.suggest.heights[12]}`)
    const c = css(w)
    is('suggest: look', [c.backgroundColor, c.color, `${c.borderTopWidth} ${c.borderTopColor}`, c.borderRadius, c.fontSize].join(' / '), l.suggest.look)
    const rows = [...w.querySelectorAll<HTMLElement>('.ws-suggest-row')]
    is('suggest: row', rel(rows[0]!, w).join(','), l.suggest.row)
    is('suggest: row step', round(rows[1]!.getBoundingClientRect().top - rows[0]!.getBoundingClientRect().top), l.suggest.rowStep)
    is('suggest: icon', rel(rows[0]!.querySelector('.ws-suggest-icon')!, w).join(','), l.suggest.icon)
    const label = rows[0]!.querySelector('.ws-suggest-label')!
    const [ll, lt, , lh] = rel(text(label), w)
    is('suggest: label', `${ll},${lt},${lh} ${css(label).fontSize} ${css(label).color}`, l.suggest.label)
    const detail = rows[0]!.querySelector('.ws-suggest-detail')!
    is('suggest: detail', `${round(text(detail).getBoundingClientRect().right - wb.left)} ${css(detail).fontSize}`, l.suggest.detail)
    const f = css(rows[0]!)
    is('suggest: selected', [f.backgroundColor, `${f.outlineColor} ${f.outlineWidth} ${f.outlineStyle}`, f.borderRadius].join(' / '), l.suggest.focused)
    const icon = (i: number) => css(rows[i]!.querySelector('.ws-suggest-icon')!).color
    is('suggest: icon colors', `${icon(rows.findIndex((r) => r.textContent!.startsWith('abs')))} ${icon(1)} ${icon(0)}`, l.suggest.iconColors)

    // "lo": eight rows, and the details under them.
    view.dispatch({ changes: { from: DOC.length, insert: 'lo' }, selection: { anchor: DOC.length + 2 }, userEvent: 'input.type' })
    await settle()
    is('suggest: height of 8 rows', round(w.getBoundingClientRect().height), l.suggest.heights[8])
    const mark = w.querySelector('.ws-suggest-row.ws-focused .ws-suggest-highlight')!
    is('suggest: highlight', `${css(mark).color} ${css(mark).fontWeight}`, l.suggest.highlight)
    view.triggerSuggest()
    await settle()
    const d = parent.querySelector<HTMLElement>('.ws-suggest-details')!
    is('details: under the list', round(w.getBoundingClientRect().bottom - d.getBoundingClientRect().top), l.details.overlap)
    const dc = css(d)
    is('details: look', [dc.backgroundColor, dc.color, `${dc.borderTopWidth} ${dc.borderTopColor}`, dc.borderRadius, dc.fontSize, dc.lineHeight].join(' / '), l.details.look)
    const type = d.querySelector('.ws-suggest-details-type')!
    const [tl, tt, , th] = rel(text(type), d)
    is('details: type', `${tl},${tt},${th} ${css(type).opacity} ${css(type).fontSize}`, l.details.type)
    is('details: close', rel(d.querySelector('.ws-suggest-details-close')!, d).join(','), l.details.close)
    const p = d.querySelector('.ws-suggest-docs p')!
    const [pl, pt, , ph] = rel(p, d)
    is('details: docs', `${pl},${pt},${ph}`, l.details.docs)
    view.suggest!.close()
    await settle()

    // Problems: wavy lines over the words.
    const squiggles = [...parent.querySelectorAll<HTMLElement>('.ws-squiggle')]
    const color = (kind: string) => css(squiggles.find((s) => s.classList.contains(`ws-${kind}`))!).backgroundColor
    is('squiggles', `${color('error')} ${color('warning')} ${color('info')} ${round(squiggles[0]!.getBoundingClientRect().height)}`, `${l.squiggle.error} ${l.squiggle.warning} ${l.squiggle.info} ${l.squiggle.height}`)
    const word = view.coordsAt(6)!
    const end = view.coordsAt(11)!
    const sb = squiggles[0]!.getBoundingClientRect()
    is('squiggle: over its word', `${Math.round(sb.left - word.left)} ${Math.round(sb.width - (end.left - word.left))} ${Math.round(sb.top - word.top)}`, '0 0 0')

    // The hover over `total`, on the first line: under it.
    view.showHover(8)
    await settle()
    const h = parent.querySelector<HTMLElement>('.ws-editor-hover')!
    const hb = h.getBoundingClientRect()
    const hc = css(h)
    is('hover: look', [hc.backgroundColor, hc.color, `${hc.borderTopWidth} ${hc.borderTopColor}`, hc.borderRadius, hc.boxShadow].join(' / '), l.hover.look)
    is('hover: under the line', round(hb.top - word.bottom), l.hover.below)
    is('hover: size', `${round(hb.width)} ${round(hb.height)}`, `${l.hover.width} ${l.hover.height}`)
    const [marker, code] = [...h.querySelectorAll<HTMLElement>('.ws-editor-hover-row')]
    const [ml, mt, , mh] = rel(marker!, h)
    is('hover: problem row', `${ml},${mt},${mh}`, l.hover.marker.row)
    const severity = marker!.querySelector('.ws-editor-hover-severity')!
    is('hover: problem icon', `${rel(severity, h).join(',')} ${css(severity).color}`, l.hover.marker.icon)
    const message = marker!.querySelector('.ws-editor-hover-message > span')!
    const [xl, xt, , xh] = rel(text(message), h)
    is('hover: problem message', `${xl},${xt},${xh} ${css(message).fontSize}`, l.hover.marker.message)
    const [cl, ct, , ch] = rel(code!, h)
    is('hover: code row', `${cl},${ct},${ch}`, l.hover.code.row)
    const block = code!.querySelector('.ws-rendered-code')!
    const [bl, bt, , bh] = rel(block, h)
    is('hover: code', `${bl},${bt},${bh} ${css(block).fontSize}`, l.hover.code.text)
    is('hover: row line', `${css(code!).borderTopWidth} ${rgba(css(code!).borderTopColor)}`, l.hover.rowBorder)
    // With room over the line, it goes there.
    parent.style.top = '200px'
    view.showHover(8)
    await settle()
    is('hover: over the line', round(view.coordsAt(6)!.top - h.getBoundingClientRect().bottom), l.hover.above)
  } finally {
    view.destroy()
    parent.remove()
  }
}

/** A computed color as rgba(), as color-mix() comes back in color(srgb …). */
function rgba(color: string): string {
  const m = /^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)$/.exec(color)
  if (!m) return color
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => Math.round(Number(x) * 255))
  return m[4] === undefined || m[4] === '1' ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${Number(m[4])})`
}
