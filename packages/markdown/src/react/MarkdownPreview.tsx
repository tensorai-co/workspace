import type { Clipboard, FileSystem } from '@tensorai-workspace/host'
import { useDeferredValue, useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react'
import { readMarkdown, type MarkdownDocument } from '../core/document.js'
import type { LinkTarget } from '../core/links.js'
import { blockOfLine, ScrollMap, type LineScroller } from '../core/scroll.js'
import { Preview, type PreviewContext } from './context.js'
import { lineElements, placeBlocks } from './layout.js'
import { Block } from './Nodes.js'

/** A preview, to scroll it and to keep it in step with an editor (see `syncScroll`). */
export interface MarkdownView extends LineScroller {
  readonly element: HTMLElement
  /** Scrolls to a heading. Returns false when there's no such heading. */
  scrollToAnchor(anchor: string): boolean
}

export interface MarkdownPreviewProps {
  /** The Markdown. The preview follows it as it changes. */
  text: string
  /** The file it's from, for its relative images and links. */
  path?: string
  /** The folder that links starting with "/" start from. No link or image leads out of it. */
  root?: string
  /** Where images are read from. */
  fs?: FileSystem
  /** A link to another file. Without this, such links do nothing. */
  onOpen?: (target: Extract<LinkTarget, { kind: 'file' }>) => void
  /** A link to the web. Without this, it opens in a new tab. */
  onOpenWeb?: (url: string) => void
  /** Whether images load from the web. Images from the file system always do. */
  remoteImages?: boolean
  /** The editor's line, from 1: the block it's in gets a mark. Without one, no block is marked. */
  activeLine?: number
  /** A double click, with the source line under it. */
  onDoubleClick?: (line: number) => void
  /** Whether long lines of code wrap. */
  wrap?: boolean
  /** Whether the last line can scroll to the top, as in the editor. */
  scrollBeyondLastLine?: boolean
  clipboard?: Clipboard
  /** The view, once it's there. */
  onView?: (view: MarkdownView | null) => void
  className?: string
  style?: CSSProperties
}

/** The Markdown preview. Nothing in the Markdown is ever run, or handed to the browser as HTML. */
export function MarkdownPreview(props: MarkdownPreviewProps) {
  const { path, root, fs, clipboard, remoteImages = true, activeLine, wrap = true, scrollBeyondLastLine = true, className, style } = props
  const text = useDeferredValue(props.text)
  const last = useRef<MarkdownDocument>(undefined)
  const doc = useMemo(() => readMarkdown(text, last.current), [text])
  last.current = doc

  const scroller = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const latest = useRef(props)
  latest.current = props

  const view = useMemo(() => new PreviewView(() => scroller.current!, () => body.current!), [])
  useLayoutEffect(() => view.changed(doc.lines), [view, doc])
  useLayoutEffect(() => {
    const stop = view.start()
    latest.current.onView?.(view)
    return () => {
      latest.current.onView?.(null)
      stop()
    }
  }, [view])

  const context = useMemo<PreviewContext>(
    () => ({
      path,
      root,
      fs,
      clipboard,
      remoteImages,
      open(target) {
        const { onOpen, onOpenWeb } = latest.current
        if (target.kind === 'anchor') return view.scrollToAnchor(target.anchor)
        if (target.kind === 'file') onOpen?.(target)
        else if (onOpenWeb) onOpenWeb(target.url)
        else return false
        return true
      },
    }),
    [path, root, fs, clipboard, remoteImages, view],
  )

  // The mark is set on the element itself: which block has it changes far more often than the blocks do.
  useLayoutEffect(() => {
    if (activeLine === undefined) return
    const el = blockOfLine(lineElements(body.current!), activeLine)?.el
    el?.setAttribute('data-active', '')
    return () => el?.removeAttribute('data-active')
  }, [activeLine, doc])

  return (
    <div
      ref={scroller}
      className={className ? `ws-markdown ${className}` : 'ws-markdown'}
      style={style}
      tabIndex={0}
      onDoubleClick={(e) => {
        const { onDoubleClick } = latest.current
        if (!onDoubleClick || (e.target as Element).closest('a')) return
        onDoubleClick(Math.floor(view.lineAtY(e.clientY)))
      }}
    >
      <div
        ref={body}
        dir="auto"
        className={['ws-markdown-body ws-syntax', wrap && 'ws-md-wrap', scrollBeyondLastLine && 'ws-md-beyond', activeLine !== undefined && 'ws-md-marks'].filter(Boolean).join(' ')}
      >
        <Preview value={context}>{doc.nodes.map((node, i) => (typeof node === 'string' ? node : <Block key={doc.keys[i]} node={node} />))}</Preview>
        <div className="ws-md-line" data-line={doc.lines} />
      </div>
    </div>
  )
}

class PreviewView implements MarkdownView {
  private map: ScrollMap | undefined
  private lines = 1
  /** Where it was last told to scroll, until the user scrolls: images that load later don't move it away. */
  private wanted: number | undefined
  private readonly listeners = new Set<() => void>()

  constructor(
    private readonly scroller: () => HTMLElement,
    private readonly body: () => HTMLElement,
  ) {}

  get element(): HTMLElement {
    return this.scroller()
  }

  start(): () => void {
    const el = this.scroller()
    const body = this.body()
    const onScroll = () => this.listeners.forEach((listener) => listener())
    const user = () => {
      this.wanted = undefined
    }
    const moved = () => {
      this.map = undefined
      if (this.wanted !== undefined) this.put(this.wanted)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    const inputs = ['wheel', 'pointerdown', 'keydown', 'touchmove']
    for (const type of inputs) el.addEventListener(type, user, { passive: true })
    body.addEventListener('load', moved, true)
    body.addEventListener('toggle', moved, true)
    const resize = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(moved)
    resize?.observe(body)
    return () => {
      el.removeEventListener('scroll', onScroll)
      for (const type of inputs) el.removeEventListener(type, user)
      body.removeEventListener('load', moved, true)
      body.removeEventListener('toggle', moved, true)
      resize?.disconnect()
    }
  }

  /** The document changed. */
  changed(lines: number): void {
    this.lines = lines
    this.map = undefined
  }

  private get scrollMap(): ScrollMap {
    if (!this.map) {
      const body = this.body()
      const box = body.getBoundingClientRect()
      this.map = new ScrollMap(placeBlocks(body, box.top), this.lines, box.height)
    }
    return this.map
  }

  private put(line: number): void {
    const el = this.scroller()
    const top = Math.round(this.scrollMap.offsetOf(line))
    if (Math.round(el.scrollTop) !== top) el.scrollTop = top
  }

  get topLine(): number {
    return this.scrollMap.lineAt(this.scroller().scrollTop)
  }

  lineAtY(clientY: number): number {
    return this.scrollMap.lineAt(clientY - this.body().getBoundingClientRect().top)
  }

  scrollToLine(line: number): void {
    this.wanted = line
    this.put(line)
  }

  scrollToAnchor(anchor: string): boolean {
    const wanted = anchor.toLowerCase()
    const el = this.scroller()
    const body = this.body()
    const found = [...body.querySelectorAll<HTMLElement>('[data-anchor]')].find((e) => e.dataset.anchor!.toLowerCase() === wanted)
    if (!found && wanted) return false
    this.wanted = undefined
    el.scrollTop = found ? found.getBoundingClientRect().top - body.getBoundingClientRect().top : 0
    return true
  }

  onScroll(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => void this.listeners.delete(listener)
  }
}
