import { Codicon, FileIcon } from '@tensorai-co/workspace/icons/react'
import { detectLanguage } from '@tensorai-co/workspace/languages'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { keyCaps, type Match, type QuickItem } from '../core/index.js'

export interface QuickInputProps {
  value: string
  onValue: (value: string) => void
  items: readonly QuickItem[]
  placeholder?: string
  /** Whether keys are drawn as on a Mac. */
  mac: boolean
  /** An item was picked: with Enter, or a click. */
  onAccept: (item: QuickItem) => void
  /** Esc, or the focus went elsewhere. */
  onClose: () => void
}

/** No more than 20 rows show; the list scrolls past that. */
const MAX_ROWS = 20
const ROW = 22

/** A label with the matched stretches in bold. */
function Highlighted({ text, matches = [] }: { text: string; matches?: readonly Match[] }) {
  if (!matches.length) return <>{text}</>
  const out: ReactNode[] = []
  let at = 0
  matches.forEach((m, i) => {
    if (m.start > at) out.push(text.slice(at, m.start))
    out.push(
      <span key={i} className="ws-quick-highlight">
        {text.slice(m.start, m.end)}
      </span>,
    )
    at = m.end
  })
  if (at < text.length) out.push(text.slice(at))
  return <>{out}</>
}

/** A key in lists: each key in its own cap. */
export function KeyCaps({ label, mac }: { label: string; mac: boolean }) {
  return (
    <span className="ws-keybinding" aria-label={label}>
      {keyCaps(label, mac).map((chord, i) => (
        <span key={i} className="ws-keybinding-chord">
          {chord.map((key, k) => (
            <kbd key={k} className="ws-keybinding-key">
              {key}
            </kbd>
          ))}
        </span>
      ))}
    </span>
  )
}

/**
 * The quick input: a filter box over a list, at the top of the window. The focus stays in the box; ↑ and ↓ move
 * through the list, Enter picks, Esc closes, and so does the focus going elsewhere.
 */
export function QuickInput({ value, onValue, items, placeholder, mac, onAccept, onClose }: QuickInputProps) {
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  /** The list takes up to 40% of the window's height, less 4px. */
  const [listMax, setListMax] = useState(MAX_ROWS * ROW)
  useLayoutEffect(() => {
    const measure = () => {
      const height = list.current?.closest('.ws-workspace')?.clientHeight
      if (height) setListMax(Math.min(MAX_ROWS * ROW, Math.floor(height * 0.4) - 4))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])
  const pickable = (i: number) => !!items[i] && !items[i]!.disabled

  // A new list starts at its first row.
  useEffect(() => setActive(pickable(0) ? 0 : -1), [items]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => input.current?.focus(), [])

  // Keep the active row in view.
  useLayoutEffect(() => {
    const el = list.current
    if (!el || active < 0) return
    const top = active * ROW
    if (top < el.scrollTop) el.scrollTop = top
    else if (top + ROW > el.scrollTop + el.clientHeight) el.scrollTop = top + ROW - el.clientHeight
  }, [active])

  const move = (by: number) => {
    if (!items.some((_, i) => pickable(i))) return
    let i = active
    for (let n = 0; n < items.length; n++) {
      i = (i + by + items.length) % items.length
      if (pickable(i)) break
    }
    setActive(i)
  }
  const page = Math.max(1, Math.min(MAX_ROWS, Math.floor((list.current?.clientHeight ?? ROW * MAX_ROWS) / ROW)) - 1)

  return (
    <div className="ws-quick" role="dialog" aria-label="Quick Input">
      <div className="ws-quick-header">
        <div className="ws-quick-filter">
          <input
            ref={input}
            className="ws-quick-input"
            value={value}
            placeholder={placeholder}
            aria-label={placeholder ?? 'Type to narrow down results.'}
            role="combobox"
            aria-expanded="true"
            aria-controls="ws-quick-list"
            aria-activedescendant={active >= 0 ? `ws-quick-row-${active}` : undefined}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => onValue(e.target.value)}
            onBlur={onClose}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') move(1)
              else if (e.key === 'ArrowUp') move(-1)
              else if (e.key === 'PageDown') setActive(Math.min(items.length - 1, Math.max(0, active) + page))
              else if (e.key === 'PageUp') setActive(Math.max(0, active - page))
              else if (e.key === 'Enter') {
                const item = items[active]
                if (item && !item.disabled) onAccept(item)
              } else if (e.key === 'Escape') onClose()
              else return
              e.preventDefault()
              e.stopPropagation()
            }}
          />
        </div>
      </div>
      <div className="ws-quick-progress" />
      <div
        ref={list}
        id="ws-quick-list"
        className="ws-quick-list"
        role="listbox"
        style={{ maxHeight: `${listMax}px` }}
        // The focus stays in the box.
        onMouseDown={(e) => e.preventDefault()}
      >
        {items.map((item, i) => (
          <div
            key={item.id + i}
            id={`ws-quick-row-${i}`}
            role="option"
            aria-selected={i === active}
            aria-disabled={item.disabled || undefined}
            className={`ws-quick-row ${i === active ? 'ws-focused' : ''} ${item.disabled ? 'ws-disabled' : ''}`}
            onClick={() => !item.disabled && onAccept(item)}
          >
            <div className={`ws-quick-entry ${item.border ? 'ws-border' : ''}`}>
              {item.file && (
                <span className="ws-quick-icon">
                  <FileIcon name={item.label} languageId={detectLanguage(item.file).id} />
                </span>
              )}
              {item.icon && (
                <span className="ws-quick-icon ws-quick-codicon" style={{ color: item.icon.color }}>
                  <Codicon name={item.icon.name} />
                </span>
              )}
              <span className="ws-quick-label">
                <span className="ws-quick-name">
                  <Highlighted text={item.label} matches={item.highlights?.label} />
                </span>
                {item.description && (
                  <span className="ws-quick-description">
                    <Highlighted text={item.description} matches={item.highlights?.description} />
                  </span>
                )}
              </span>
              {item.separator && <span className="ws-quick-separator">{item.separator}</span>}
              {item.keybinding && <KeyCaps label={item.keybinding} mac={mac} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
