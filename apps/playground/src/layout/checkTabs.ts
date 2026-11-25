import * as ref from './reference'
import { all, box, css, find, settle, textBox, type Check } from './measure'

/** A computed color as rgb() or rgba(): what color-mix() gives is written another way. */
const plain = (color: string) => {
  const mixed = /^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)$/.exec(color)
  if (!mixed) return color
  const [r, g, b] = mixed.slice(1, 4).map((n) => Math.round(Number(n) * 255))
  return mixed[4] ? `rgba(${r}, ${g}, ${b}, ${mixed[4]})` : `rgb(${r}, ${g}, ${b})`
}

/** The tab row, the sashes and the lines between panes. */
export async function checkTabs(is: Check): Promise<void> {
  const strip = find('#check-tabs .ws-tabs')
  const tabs = all('.ws-tab', strip)
  is('tab row: height', strip.offsetHeight, ref.tabs.height)
  is('tab row: background', css(strip).backgroundColor, ref.tabs.strip)
  const line = getComputedStyle(strip, '::after')
  is('tab row: line', `${line.height} ${line.backgroundColor}`, ref.tabs.line)
  tabs.forEach((tab, i) => {
    const at = (what: string) => `tab ${i + 1}: ${what}`
    const [left, , width] = box(tab, strip)
    is(at('box'), [left, width], ref.tabs.boxes[i])
    is(at('height'), tab.offsetHeight, 31)
    is(at('text'), textBox(find('.ws-tab-name', tab), strip), ref.tabs.text[i])
    // An inactive tab's fill, or the active tab's joined shape.
    const fill = find(':scope > .ws-tab-fill, :scope > .ws-joined', tab)
    is(at('fill'), box(fill, strip), ref.tabs.fills[i])
    is(at('fill color'), css(fill).backgroundColor, ref.tabs.fillColors[i])
    is(at('fill radius'), css(fill).borderRadius, ref.tabs.fillRadii[i])
    const button = find('button', tab)
    is(at('close button'), box(button, strip), ref.tabs.buttons[i])
    is(at('close button opacity'), css(button).opacity, ref.tabs.buttonOpacity[i])
    const name = css(find('.ws-tab-name', tab))
    is(at('color'), name.color, ref.tabs.colors[i])
    is(at('style'), name.fontStyle, ref.tabs.fontStyle[i])
    is(at('font'), `${name.fontSize} ${name.fontWeight} ${name.lineHeight}`, ref.tabs.font)
  })
  const [first, second, active] = tabs
  const icon = find('.ws-preview-icon', first)
  is('preview icon', `${box(icon, first!)} ${box(find('.ws-tab-name', first), icon)[0]} ${css(icon).color}`, ref.tabs.previewIcon)
  is('tab icon: box', box(find('.ws-file-icon', second), strip), ref.tabs.icon)
  is('tab icon: glyph', box(find('.ws-file-icon > svg', second), find('.ws-file-icon', second)), ref.tabs.glyph)
  const divider = find('.ws-tab-divider', second)
  is('tab divider', `${box(divider, strip)} ${css(divider).backgroundColor}`, ref.tabs.divider)
  is('tab divider: beside the active tab', css(find('.ws-tab-divider', active)).display, 'none')
  const edge = find('.ws-joined-edge', active)
  is('active tab: edge', `${box(edge, strip)} ${css(edge).borderLeftWidth} ${css(edge).borderLeftColor} ${css(edge).clipPath}`, ref.tabs.edge)
  for (const [which, want] of [
    ['::after', ref.tabs.shoulderAfter],
    ['::before', ref.tabs.shoulderBefore],
  ] as const) {
    const s = getComputedStyle(find('.ws-joined', active!), which)
    is(`active tab: shoulder ${which}`, `${s.width} ${s.height} ${s.borderBottomWidth} ${s.borderBottomColor} ${s.borderRadius} ${s.boxShadow}`, want)
  }
  is('last tab: margin', css(active!).marginRight, ref.tabs.lastMargin)
  const actions = all('.ws-tab-action', strip)
  is('tab actions', actions.map((a) => box(a, strip)).join(';'), ref.tabs.actions)
  is('tab actions: color', css(actions[0]!).color, ref.tabs.actionColor)
  is('tab actions: padding', css(actions[0]!).padding, ref.tabs.actionPadding)

  const gaps = find('#check-gaps .ws-split')
  const sash = find('.ws-sash', gaps)
  is('sash in a gap', box(sash, gaps).slice(0, 3), ref.split.sash)
  is('sash: cursor', css(sash).cursor, ref.split.cursor)
  is('second pane', box(all('.ws-pane', gaps)[1]!, gaps)[0], ref.split.secondPane)
  const grip = getComputedStyle(sash, '::after')
  is('sash: grip', `${grip.width} ${grip.height} ${plain(grip.backgroundColor)}`, ref.split.grip)
  is('sash: radius', getComputedStyle(sash, '::before').borderRadius, ref.split.radius)
  sash.classList.add('ws-hover')
  await settle()
  is('sash: hover color', getComputedStyle(sash, '::before').backgroundColor, ref.split.hover)
  sash.classList.remove('ws-hover')
  const lines = find('#check-lines .ws-split')
  const between = getComputedStyle(all('.ws-pane', lines)[1]!, '::before')
  is('line between panes', `${between.width} ${between.backgroundColor}`, ref.split.line)
  is('sash over the line', box(find('.ws-sash', lines), lines).slice(0, 3), ref.split.sashOnLine)
}
