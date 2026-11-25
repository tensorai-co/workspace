import type { Diagnostic } from '@tensorai-co/workspace/host'
import { codicon, iconSvg } from '@tensorai-co/workspace/icons'
import { renderMarkdown } from './markdown.js'

/** Hovers keep this far from the window's right edge. */
const RIGHT_MARGIN = 15

export interface HoverContent {
  /** Problems first. */
  diagnostics: readonly Diagnostic[]
  /** Markdown sections. */
  contents: readonly string[]
  language: string
}

const SEVERITY_ICON = { error: 'error', warning: 'warning', info: 'info', hint: 'info' } as const

/** The editor hover: the problems at a place, then what the language service says about it. */
export class HoverWidget {
  readonly dom: HTMLDivElement
  private readonly body: HTMLDivElement
  private onLeave: (() => void) | undefined

  constructor(parent: HTMLElement) {
    this.dom = document.createElement('div')
    this.dom.className = 'ws-editor-hover'
    this.dom.hidden = true
    this.dom.setAttribute('role', 'tooltip')
    this.body = document.createElement('div')
    this.body.className = 'ws-editor-hover-body'
    this.dom.append(this.body)
    this.dom.addEventListener('mouseleave', () => this.onLeave?.())
    parent.append(this.dom)
  }

  get isOpen(): boolean {
    return !this.dom.hidden
  }

  /** Whether the mouse is over it. */
  get hovered(): boolean {
    return this.dom.matches(':hover')
  }

  /**
   * Shows content at a stretch of text, given as its first line's box (client coordinates): over the line when
   * there's room, else under it.
   */
  show(content: HoverContent, anchor: { left: number; top: number; bottom: number }, onLeave?: () => void): void {
    this.onLeave = onLeave
    const rows: HTMLElement[] = []
    for (const d of content.diagnostics) {
      const row = document.createElement('div')
      row.className = 'ws-editor-hover-row ws-editor-hover-marker'
      const icon = document.createElement('span')
      icon.className = `ws-editor-hover-severity ws-${d.severity}`
      icon.innerHTML = iconSvg(codicon(SEVERITY_ICON[d.severity]), 16)
      const message = document.createElement('div')
      message.className = 'ws-editor-hover-message'
      const text = document.createElement('span')
      text.textContent = d.message
      message.append(text)
      if (d.source || d.code !== undefined) {
        const details = document.createElement('span')
        details.className = 'ws-editor-hover-source'
        details.textContent = d.source && d.code !== undefined ? `${d.source}(${d.code})` : String(d.source ?? d.code)
        message.append(details)
      }
      row.append(icon, message)
      rows.push(row)
    }
    for (const markdown of content.contents) {
      if (!markdown.trim()) continue
      const row = document.createElement('div')
      row.className = 'ws-editor-hover-row ws-editor-hover-contents'
      row.append(renderMarkdown(markdown, content.language))
      rows.push(row)
    }
    if (!rows.length) return this.hide()
    this.body.replaceChildren(...rows)
    this.dom.hidden = false
    this.dom.style.left = '0px'
    this.dom.style.top = '0px'
    this.dom.style.width = ''
    // Its content's width and 2px, rounded, in its border.
    const natural = this.dom.getBoundingClientRect().width - 2
    this.dom.style.width = `${Math.round(natural + 2) + 2}px`
    const width = this.dom.getBoundingClientRect().width
    const height = this.dom.offsetHeight
    const left = Math.max(0, Math.min(anchor.left, window.innerWidth - RIGHT_MARGIN - width))
    const above = anchor.top - height >= 0
    this.dom.style.left = `${left}px`
    this.dom.style.top = `${above ? anchor.top - height : anchor.bottom}px`
  }

  hide(): void {
    this.dom.hidden = true
    this.body.replaceChildren()
    this.onLeave = undefined
  }

  destroy(): void {
    this.dom.remove()
  }
}
