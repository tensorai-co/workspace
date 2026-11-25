import { EditorSelection, SelectionRange } from '../core/selection.js'
import type { EditorState, TransactionSpec } from '../core/state.js'

/** What the mouse handling needs from the view. */
export interface MouseHost {
  readonly state: EditorState
  readonly dom: HTMLElement
  readonly scroller: HTMLElement
  dispatch(spec: TransactionSpec): void
  focus(): void
  posAtCoords(clientX: number, clientY: number): number
  gutterWidth(): number
  scrollbarWidth: number
  /**
   * A press on the text, before it moves the cursor: features may take it (⌘-click, a click on "⋯"). Returns whether
   * one did.
   */
  pressed(e: MouseEvent): boolean
  toggleFold(line: number): void
}

interface Drag {
  anchor: number
  mode: 'char' | 'word' | 'line'
  /** ⌥-drag adds a cursor instead of replacing them. */
  add: boolean
}

/** Selecting with the mouse: by character, word (double-click) or line (triple-click), and from the gutter. */
export class MouseSelection {
  private drag: Drag | undefined

  constructor(
    private readonly host: MouseHost,
    content: HTMLElement,
    gutter: HTMLElement,
  ) {
    content.addEventListener('mousedown', (e) => this.mouseDown(e))
    gutter.addEventListener('mousedown', (e) => {
      e.preventDefault()
      const chevron = (e.target as Element).closest<HTMLElement>('.ws-fold')
      if (chevron) return this.host.toggleFold(Number(chevron.dataset.line))
      const { state } = this.host
      const pos = this.host.posAtCoords(e.clientX + this.host.gutterWidth(), e.clientY)
      const line = state.doc.lineAt(pos)
      const end = line.number < state.doc.lines ? state.doc.line(line.number + 1).from : line.to
      this.host.dispatch({ selection: EditorSelection.single(line.from, end), userEvent: 'select' })
      this.host.focus()
    })
  }

  /** Whether a drag is selecting now. */
  get dragging(): boolean {
    return !!this.drag
  }

  private mouseDown(e: MouseEvent) {
    if (e.button !== 0) return
    e.preventDefault()
    if (this.host.pressed(e)) return
    this.host.focus()
    const pos = this.host.posAtCoords(e.clientX, e.clientY)
    const mode = e.detail === 2 ? 'word' : e.detail >= 3 ? 'line' : 'char'
    const anchor = e.shiftKey ? this.host.state.selection.main.anchor : pos
    this.drag = { anchor, mode, add: e.altKey }
    this.selectTo(pos, true)
    const move = (ev: MouseEvent) => this.selectTo(this.host.posAtCoords(ev.clientX, ev.clientY), false)
    const up = () => {
      this.drag = undefined
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  private selectTo(pos: number, start: boolean) {
    const d = this.drag
    if (!d) return
    const { state } = this.host
    let range: SelectionRange
    if (d.mode === 'word') {
      const a = state.wordAt(d.anchor) ?? { from: d.anchor, to: d.anchor }
      const b = state.wordAt(pos) ?? { from: pos, to: pos }
      range = pos >= d.anchor ? new SelectionRange(a.from, b.to) : new SelectionRange(a.to, b.from)
    } else if (d.mode === 'line') {
      const doc = state.doc
      const a = doc.lineAt(Math.min(d.anchor, pos))
      const b = doc.lineAt(Math.max(d.anchor, pos))
      const end = b.number < doc.lines ? doc.line(b.number + 1).from : b.to
      range = pos >= d.anchor ? new SelectionRange(a.from, end) : new SelectionRange(end, a.from)
    } else range = new SelectionRange(d.anchor, pos)
    const { selection: current } = state
    const selection = d.add ? (start ? current.add(range) : EditorSelection.create([...current.ranges.filter((_, i) => i !== current.mainIndex), range], current.ranges.length - 1)) : EditorSelection.create([range])
    this.host.dispatch({ selection, userEvent: 'select', scrollIntoView: !start })
  }
}

/** Dragging a scrollbar's slider scrolls by the same proportion. */
export function dragSlider(host: MouseHost, slider: HTMLDivElement, axis: 'x' | 'y'): void {
  slider.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    const s = host.scroller
    const startMouse = axis === 'y' ? e.clientY : e.clientX
    const startScroll = axis === 'y' ? s.scrollTop : s.scrollLeft
    const track = axis === 'y' ? host.dom.clientHeight - slider.offsetHeight : host.dom.clientWidth - host.gutterWidth() - host.scrollbarWidth - slider.offsetWidth
    const range = axis === 'y' ? s.scrollHeight - s.clientHeight : s.scrollWidth - s.clientWidth
    slider.classList.add('ws-active')
    const move = (ev: MouseEvent) => {
      const delta = ((axis === 'y' ? ev.clientY : ev.clientX) - startMouse) * (range / Math.max(1, track))
      if (axis === 'y') s.scrollTop = startScroll + delta
      else s.scrollLeft = startScroll + delta
    }
    const up = () => {
      slider.classList.remove('ws-active')
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  })
}
