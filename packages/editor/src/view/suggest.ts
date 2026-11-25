import type { CompletionItem, CompletionKind } from '@tensorai-workspace/host'
import { codicon, iconSvg, type CodiconName } from '@tensorai-workspace/icons'
import type { MatchRange } from '../core/fuzzy.js'
import type { SuggestView } from '../core/suggest.js'
import { renderMarkdown } from './markdown.js'

/** The suggest widget's sizes. */
const ROW = 18
const MAX_ROWS = 12
const WIDTH = 432
/** The widget keeps this far from the window's right edge. */
const RIGHT_MARGIN = 29

/** Each kind's icon and its color token. */
const KINDS: Record<CompletionKind, [CodiconName, string]> = {
  method: ['symbol-method', 'method'],
  function: ['symbol-method', 'function'],
  constructor: ['symbol-method', 'constructor'],
  field: ['symbol-field', 'field'],
  variable: ['symbol-variable', 'variable'],
  class: ['symbol-class', 'class'],
  struct: ['symbol-structure', 'struct'],
  interface: ['symbol-interface', 'interface'],
  module: ['symbol-namespace', 'module'],
  property: ['symbol-property', 'property'],
  event: ['symbol-event', 'event'],
  operator: ['symbol-operator', 'operator'],
  unit: ['symbol-ruler', 'unit'],
  value: ['symbol-enum', 'value'],
  constant: ['symbol-constant', 'constant'],
  enum: ['symbol-enum', 'enumerator'],
  enumMember: ['symbol-enum-member', 'enumeratorMember'],
  keyword: ['symbol-keyword', 'keyword'],
  text: ['symbol-key', 'text'],
  color: ['symbol-color', 'color'],
  file: ['symbol-file', 'file'],
  reference: ['go-to-file', 'reference'],
  folder: ['folder', 'folder'],
  typeParameter: ['symbol-parameter', 'typeParameter'],
  snippet: ['symbol-snippet', 'snippet'],
  user: ['account', 'user'],
  issue: ['issues', 'issue'],
}

/** A kind's icon, colored by its theme token: for the suggest list, and symbol lists elsewhere. */
export function kindIcon(kind: CompletionKind | undefined): HTMLSpanElement {
  const [icon, token] = KINDS[kind ?? 'text'] ?? KINDS.text
  const el = document.createElement('span')
  el.className = 'ws-suggest-icon'
  el.style.color = `var(--ws-color-symbolIcon-${token}Foreground, var(--ws-color-foreground))`
  el.innerHTML = iconSvg(codicon(icon), 16)
  return el
}

export interface SuggestWidgetHost {
  /** Puts the item at a row in. */
  accept(index: number): void
  select(index: number): void
  toggleDetails(): void
  /** The language, for code in docs. */
  language(): string
}

/** The suggest widget: a list of items under the cursor, and the selected item's docs beside it. */
export class SuggestWidget {
  readonly dom: HTMLDivElement
  private readonly list: HTMLDivElement
  private readonly details: HTMLDivElement
  private shown: SuggestView | undefined
  private detailsItem: CompletionItem | undefined

  constructor(
    private readonly host: SuggestWidgetHost,
    parent: HTMLElement,
  ) {
    this.dom = document.createElement('div')
    this.dom.className = 'ws-suggest'
    this.dom.hidden = true
    this.dom.setAttribute('role', 'listbox')
    this.dom.setAttribute('aria-label', 'Suggest')
    this.list = document.createElement('div')
    this.list.className = 'ws-suggest-list'
    this.dom.append(this.list)
    this.details = document.createElement('div')
    this.details.className = 'ws-suggest-details'
    this.details.hidden = true
    // The editor keeps the focus.
    for (const el of [this.dom, this.details]) el.addEventListener('mousedown', (e) => e.preventDefault())
    this.list.addEventListener('click', (e) => {
      const row = (e.target as Element).closest<HTMLElement>('.ws-suggest-row')
      if (row) this.host.accept(Number(row.dataset.index))
    })
    this.list.addEventListener('scroll', () => this.paintRows())
    parent.append(this.dom, this.details)
  }

  get isOpen(): boolean {
    return !this.dom.hidden
  }

  /** How many rows a page is. */
  get pageRows(): number {
    return MAX_ROWS - 1
  }

  /**
   * Draws the list, hanging from the cursor's box (client coordinates): below it when there's room, else above.
   * Undefined `view` hides it.
   */
  update(view: SuggestView | undefined, cursor: { left: number; top: number; bottom: number } | undefined, bounds: DOMRect): void {
    if (!view || !cursor) {
      this.shown = undefined
      this.dom.hidden = this.details.hidden = true
      return
    }
    const changed = !this.shown || this.shown.rows !== view.rows || this.shown.message !== view.message
    this.shown = view
    this.dom.hidden = false
    const rows = view.message ? 1 : Math.min(MAX_ROWS, view.rows.length)
    // 2px under the rows, until the list is at its tallest; and the border.
    const height = Math.min(MAX_ROWS * ROW, rows * ROW + 2) + 2
    this.dom.style.height = `${height}px`
    this.list.classList.toggle('ws-message', !!view.message)
    if (changed) {
      this.list.scrollTop = 0
      this.list.style.setProperty('--ws-rows', String(view.rows.length))
    }
    // Keep the selected row in view.
    const top = view.selected * ROW
    if (top < this.list.scrollTop) this.list.scrollTop = top
    else if (top + ROW > this.list.scrollTop + rows * ROW) this.list.scrollTop = top + ROW - rows * ROW
    this.paintRows()

    const right = window.innerWidth - RIGHT_MARGIN
    const left = Math.max(0, Math.min(Math.round(cursor.left), right - WIDTH))
    const below = cursor.bottom + height <= Math.max(bounds.bottom, window.innerHeight) || cursor.top - height < 0
    const y = below ? cursor.bottom : cursor.top - height
    this.dom.style.left = `${left}px`
    this.dom.style.top = `${y}px`
    this.dom.classList.toggle('ws-above', !below)
    this.updateDetails(view, { left, top: y, height, below })
  }

  /** Only the rows in view are drawn: lists can be thousands long. */
  private paintRows() {
    const view = this.shown
    if (!view) return
    if (view.message) {
      this.list.textContent = view.message
      return
    }
    const first = Math.floor(this.list.scrollTop / ROW)
    const last = Math.min(view.rows.length, first + MAX_ROWS + 1)
    const frag = document.createDocumentFragment()
    const spacer = document.createElement('div')
    spacer.className = 'ws-suggest-spacer'
    spacer.style.height = `${view.rows.length * ROW}px`
    frag.append(spacer)
    for (let i = first; i < last; i++) {
      const { item, matches } = view.rows[i]!
      const row = document.createElement('div')
      row.className = 'ws-suggest-row'
      if (i === view.selected) row.classList.add('ws-focused')
      if (i === 0) row.classList.add('ws-first')
      if (i === view.rows.length - 1) row.classList.add('ws-last')
      row.dataset.index = String(i)
      row.style.top = `${i * ROW}px`
      row.setAttribute('role', 'option')
      row.setAttribute('aria-selected', String(i === view.selected))
      row.append(kindIcon(item.kind))
      const label = document.createElement('span')
      label.className = 'ws-suggest-label'
      highlight(label, item.label, matches)
      row.append(label)
      if (i === view.selected && item.detail && !view.details) {
        const detail = document.createElement('span')
        detail.className = 'ws-suggest-detail'
        detail.textContent = item.detail
        row.append(detail)
      }
      row.addEventListener('mouseenter', () => row.classList.add('ws-hover'))
      row.addEventListener('mouseleave', () => row.classList.remove('ws-hover'))
      frag.append(row)
    }
    this.list.replaceChildren(frag)
  }

  /** The selected item's docs: beside the list when there's room, else under (or over) it. */
  private updateDetails(view: SuggestView, box: { left: number; top: number; height: number; below: boolean }) {
    const item = view.rows[view.selected]?.item
    if (!view.details || !item || (!item.detail && !item.documentation)) {
      this.details.hidden = true
      this.detailsItem = undefined
      return
    }
    if (item !== this.detailsItem) {
      this.detailsItem = item
      const header = document.createElement('div')
      header.className = 'ws-suggest-details-header'
      const close = document.createElement('span')
      close.className = 'ws-suggest-details-close'
      close.title = 'Close'
      close.setAttribute('role', 'button')
      close.innerHTML = iconSvg(codicon('close'), 14)
      close.addEventListener('click', () => this.host.toggleDetails())
      header.append(close)
      if (item.detail) {
        const type = document.createElement('p')
        type.className = 'ws-suggest-details-type'
        type.textContent = item.detail
        type.title = item.detail
        header.append(type)
      }
      this.details.replaceChildren(header)
      this.details.classList.toggle('ws-no-docs', !item.documentation)
      if (item.documentation) {
        const docs = renderMarkdown(item.documentation, this.host.language())
        docs.classList.add('ws-suggest-docs')
        this.details.append(docs)
      }
    }
    this.details.hidden = false
    const right = window.innerWidth - RIGHT_MARGIN
    const width = this.details.offsetWidth || WIDTH
    let left = box.left + WIDTH - 1
    let top = box.top
    if (left + width > right) {
      if (box.left - width + 1 >= 0) left = box.left - width + 1
      else {
        // No room on either side: under the list, or over it when the list is over the cursor.
        left = box.left
        top = box.below ? box.top + box.height - 1 : box.top - this.details.offsetHeight + 1
      }
    }
    this.details.style.left = `${left}px`
    this.details.style.top = `${top}px`
  }

  destroy(): void {
    this.dom.remove()
    this.details.remove()
  }
}

function highlight(el: HTMLElement, text: string, matches: readonly MatchRange[]) {
  let at = 0
  for (const [from, to] of matches) {
    if (from > at) el.append(text.slice(at, from))
    const mark = document.createElement('span')
    mark.className = 'ws-suggest-highlight'
    mark.textContent = text.slice(from, to)
    el.append(mark)
    at = to
  }
  if (at < text.length) el.append(text.slice(at))
}
