import { round, settle, type Check } from './measure'
import * as ref from './reference'

/** The playground's workspace in a frame the size of the window it was measured in, so `vw` sizes match too. */
async function load(): Promise<Document> {
  const frame = document.createElement('iframe')
  const [width, height] = ref.workspace.window
  frame.src = '/?check'
  frame.className = 'check-workspace'
  frame.style.cssText = `width:${width}px;height:${height}px;border:0`
  document.body.append(frame)
  await new Promise((r) => frame.addEventListener('load', r, { once: true }))
  const doc = frame.contentDocument!
  for (let i = 0; i < 100 && !doc.querySelector('.ws-statusbar .ws-status-item + .ws-status-item, .ws-terminal-header'); i++) await new Promise((r) => setTimeout(r, 50))
  await settle()
  return doc
}

/** The titlebar, activity bar, sidebar, cards and status bar, against the reference. */
export async function checkWorkspace(is: Check): Promise<void> {
  const doc = await load()
  const w = ref.workspace
  const view = doc.defaultView!
  const css = (el: Element, pseudo?: string) => view.getComputedStyle(el, pseudo)
  const find = (selector: string) => {
    const el = doc.querySelector<HTMLElement>(selector)
    if (!el) throw new Error(`nothing matches ${selector}`)
    return el
  }
  const rect = (el: Element) => el.getBoundingClientRect()
  const box = (el: Element) => [rect(el).left, rect(el).top, rect(el).width, rect(el).height].map(round).join(',')
  const border = (el: Element) => `${css(el).borderTopWidth} ${css(el).borderTopColor}`

  const titlebar = find('.ws-titlebar')
  is('titlebar', `${box(titlebar)} ${css(titlebar).backgroundColor} ${css(titlebar).color}`, `${w.titlebar.box} ${w.titlebar.background} ${w.titlebar.color}`)
  const [back, forward, center] = [...doc.querySelectorAll('.ws-command-center > *')]
  is('titlebar: back', box(back!), w.back)
  is('titlebar: forward', box(forward!), w.forward)
  is('command center', `${box(center!)} ${border(center!)} ${css(center!).borderRadius}`, `${w.commandCenter.box} ${w.commandCenter.border} ${w.commandCenter.radius}`)
  const label = find('.ws-command-center-label')
  const range = doc.createRange()
  range.selectNodeContents(find('.ws-command-center-label > span'))
  is('command center: label', `${round(range.getBoundingClientRect().left)} ${css(label).fontSize} ${css(label).lineHeight} ${css(label).color}`, w.commandCenter.label)
  const toggles = [...doc.querySelectorAll('.ws-title-actions .ws-title-action')]
  is('layout toggles', toggles.map(box).join(' '), w.toggles.join(' '))
  for (const t of toggles) is('layout toggle: look', `${css(t).color} ${css(t).borderRadius} ${t.querySelector('svg')!.getBoundingClientRect().width}`, `${w.toggle.color} ${w.toggle.radius} ${w.toggle.icon}`)

  const activity = find('.ws-activitybar')
  is('activity bar', `${box(activity)} ${border(activity)} ${css(activity).borderRadius} ${css(activity).backgroundColor}`, `${w.activityBar.box} ${w.activityBar.border} ${w.activityBar.radius} ${w.activityBar.background}`)
  const menu = find('.ws-activity-menu-button')
  is('activity bar: menu', `${box(menu)} ${rect(menu.querySelector('svg')!).width} ${css(menu).color}`, `${w.menu.box} ${w.menu.icon}`)
  const item = find('.ws-activity-item.ws-checked')
  const indicator = find('.ws-checked > .ws-activity-indicator')
  is('activity bar: item', box(item), w.item.box)
  is('activity bar: checked', `${box(indicator)} ${css(indicator).backgroundColor} ${css(indicator).borderRadius}`, `${w.item.indicator} ${w.item.checked}`)
  is('activity bar: icon', `${rect(item.querySelector('svg')!).width} ${css(item).color}`, w.item.icon)

  const sidebar = find('.ws-sidebar')
  const s = rect(sidebar)
  is('sidebar', `${round(s.left)},${round(s.top)},${round(s.height)} ${css(sidebar).borderLeftWidth} ${css(sidebar).borderLeftColor} ${css(sidebar).borderRadius}`, `${w.sidebar.left},${w.sidebar.top},${w.sidebar.height} ${w.sidebar.borderLeft} ${w.sidebar.radius}`)
  const title = find('.ws-sidebar-title > h2')
  is('sidebar: title', `${round(rect(title).left)},${round(rect(title).top)},${round(rect(title).height)} ${css(title).fontSize} ${css(title).fontWeight} ${css(title).color}`, `${w.sidebar.title} ${w.sidebar.titleFont}`)

  const editors = find('.ws-editors')
  const e = rect(editors)
  is('editor card', `${round(e.top)} ${round(e.left - s.right)} ${border(editors)} ${css(editors).borderRadius} ${css(editors).backgroundColor}`, `${w.editor.top} ${w.editor.gap} ${w.card.border} ${w.card.radius} ${w.editor.background}`)
  const panel = find('.ws-panel')
  const p = rect(panel)
  is('panel card', `${round(p.top - e.bottom)} ${round(p.bottom)} ${border(panel)} ${css(panel).borderRadius}`, `${w.panel.gap} ${w.panel.bottom} ${w.card.border} ${w.card.radius}`)
  const aux = find('.ws-auxiliarybar')
  const a = rect(aux)
  is('secondary side bar', `${round(a.right)},${round(a.top)},${round(a.height)} ${round(a.left - e.right)} ${border(aux)} ${css(aux).borderRadius}`, `${w.auxiliaryBar.right},${w.auxiliaryBar.top},${w.auxiliaryBar.height} ${w.auxiliaryBar.gap} ${w.card.border} ${w.card.radius}`)
  const tab = rect(find('.ws-part-tab > span'))
  const tabRange = doc.createRange()
  tabRange.selectNodeContents(find('.ws-part-tab > span'))
  is('secondary side bar: tab', [round(tabRange.getBoundingClientRect().left - a.left), round(tab.top - a.top), round(tab.height)].join(','), w.auxiliaryBar.tab)
  const close = rect(find('.ws-part-actions > :last-child'))
  is('secondary side bar: close', [round(a.right - close.right), round(close.top - a.top), round(close.width), round(close.height)].join(','), w.auxiliaryBar.close)

  const status = find('.ws-statusbar')
  is('status bar', `${box(status)} ${css(status).padding} ${css(status).fontSize} ${css(status).color}`, `${w.statusbar.box} ${w.statusbar.padding} ${w.statusbar.font}`)
  const items = [...doc.querySelectorAll<HTMLElement>('.ws-statusbar .ws-status-item')]
  const remote = items[0]!
  is('status bar: first item', `${round(rect(remote).left)},${round(rect(remote).top)}`, w.statusbar.first)
  is('status bar: remote', `${css(remote).backgroundColor} ${css(remote).color} ${css(remote).padding} ${css(remote).borderRadius}`, `${w.remote.background} ${w.remote.color} ${w.remote.padding} ${w.remote.radius}`)
  const middle = items[1]!
  is('status bar: item', `${css(middle).padding} ${css(middle).margin} ${css(middle).borderRadius} ${round(rect(middle).height)}`, `${w.statusItem.padding} ${w.statusItem.margin} ${w.statusItem.radius} ${w.statusItem.height}`)
  is('status bar: right end', round(view.innerWidth - rect(items[items.length - 1]!).right), w.statusbar.rightEnd)
  // The problems in the open files: none in App.tsx.
  for (let i = 0; i < 40 && !doc.querySelector('.ws-status-problems'); i++) await new Promise((r) => setTimeout(r, 50))
  const problems = find('.ws-status-problems')
  // The item is its margin box: a link in a 3px frame.
  const m = { left: parseFloat(css(problems).marginLeft), right: parseFloat(css(problems).marginRight) }
  const pb = { left: rect(problems).left - m.left, top: rect(problems).top, width: rect(problems).width + m.left + m.right }
  const [icon1, icon2] = [...problems.querySelectorAll('svg')]
  const fromItem = (r: DOMRect) => [r.left - pb.left, r.top - pb.top, r.width, r.height].map(round).join(',')
  const between = (from: Node, to?: Node) => {
    const r = doc.createRange()
    r.setStartAfter(from)
    if (to) r.setEndBefore(to)
    else r.setEnd(problems, problems.childNodes.length)
    const b = r.getBoundingClientRect()
    return `${round(b.left - pb.left)},${round(b.width)}`
  }
  const lp = ref.languages.problems
  is('status bar: problems', `${round(pb.width)} ${fromItem(rect(icon1!))} ${fromItem(rect(icon2!))} ${between(icon1!, icon2!)} ${between(icon2!)} ${css(problems).color}`, `${lp.width} ${lp.icons} ${lp.text} ${lp.color}`)

  // The command palette, over the same window.
  const q = ref.quick
  const api = (view as unknown as { workspace: { quickOpen(value: string): void } }).workspace
  api.quickOpen('>')
  await settle()
  const widget = find('.ws-quick')
  // It grows in as it opens: measure it once it's still.
  await Promise.all(widget.getAnimations().map((a) => a.finished))
  const wq = () => rect(widget)
  const inWidget = (el: Element) => [rect(el).left - wq().left, rect(el).top - wq().top, rect(el).width, rect(el).height].map(round)
  is('palette', `${[wq().left, wq().top, wq().width].map(round).join(',')} ${round(wq().height)}`, `${q.widget} ${q.fullHeight}`)
  const qc = css(widget)
  is('palette: look', [qc.backgroundColor, qc.color, `${qc.borderTopWidth} ${qc.borderTopColor}`, qc.borderRadius, qc.boxShadow].join(' / '), q.look)
  const filter = find('.ws-quick-filter')
  is('palette: box', `${inWidget(filter).join(',')} ${[css(filter).backgroundColor, css(filter).borderTopColor, css(filter).borderRadius].join(' / ')}`, q.box)
  const field = find('.ws-quick-input')
  is('palette: input', `${inWidget(field).join(',')} ${[css(field).padding, css(field).fontSize, css(field).color].join(' / ')}`, q.input)
  const first = find('.ws-quick-row')
  is('palette: row', inWidget(first).join(','), q.firstRow)
  // The text itself: the label is an inline box as tall as its font.
  const nameText = doc.createRange()
  nameText.selectNodeContents(find('.ws-quick-name'))
  const [nl, nt, , nh] = inWidget(nameText as unknown as Element)
  is('palette: label', `${nl},${nt},${nh}`, q.name)
  is('palette: selected', [css(first).backgroundColor, css(first).color, css(first).borderRadius].join(' / '), q.focused)
  const input = field as HTMLInputElement
  const setter = Object.getOwnPropertyDescriptor(view.HTMLInputElement.prototype, 'value')!.set!
  setter.call(input, '>toggle side')
  input.dispatchEvent(new view.Event('input', { bubbles: true }))
  await settle()
  const rows = [...doc.querySelectorAll<HTMLElement>('.ws-quick-row')]
  const keysOf = (label: string) => {
    const row = rows.find((r) => r.querySelector('.ws-quick-name')?.textContent === label)
    return row ? [...row.querySelectorAll('.ws-keybinding-key')].map((k) => { const [l, , kw, kh] = inWidget(k); return `${l},${kw},${kh}` }).join(' ') : 'missing'
  }
  is('palette: keys', keysOf('View: Toggle Primary Side Bar Visibility'), q.keys.sidebar)
  is('palette: keys of a three-key binding', keysOf('View: Toggle Secondary Side Bar Visibility'), q.keys.secondary)
  const cap = rows[1]?.querySelector('.ws-keybinding-key') ?? find('.ws-keybinding-key')
  is('palette: key look', [css(cap).backgroundColor, css(cap).borderTopColor, css(cap).borderBottomColor, css(cap).color, css(cap).padding, css(cap).fontSize].join(' / '), q.keyLook)
  const mark = rows[1]!.querySelector('.ws-quick-highlight')!
  is('palette: highlight', `${css(mark).color} ${css(mark).fontWeight}`, q.highlight)
  input.dispatchEvent(new view.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
}
