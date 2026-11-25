import { useLayoutEffect, useRef, useState } from 'react'
import type { TreeMessage } from '../core/message.js'

/** A row being named in place. */
export interface TreeEditing {
  id: string
  value: string
  /** What to select at first; everything by default. */
  selection?: [from: number, to: number]
  label: string
  validate?: (value: string) => TreeMessage | undefined
  onChange?: (value: string) => void
  onCommit: (value: string) => void
  onCancel: () => void
}

/** The box a row is named in. Enter accepts, Escape cancels, and leaving it accepts a valid name. */
export function EditBox({ editing, above }: { editing: TreeEditing; above: boolean }) {
  const [value, setValue] = useState(editing.value)
  const [message, setMessage] = useState<TreeMessage>()
  const input = useRef<HTMLInputElement>(null)
  const done = useRef(false)

  useLayoutEffect(() => {
    done.current = false
    input.current?.focus({ preventScroll: true })
    input.current?.setSelectionRange(...(editing.selection ?? [0, editing.value.length]))
    // Once, when the box appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const finish = (accept: boolean) => {
    if (done.current) return
    if (accept) {
      const problem = editing.validate?.(value)
      if (problem?.kind === 'error') return setMessage(problem)
      done.current = true
      editing.onCommit(value)
    } else {
      done.current = true
      editing.onCancel()
    }
  }

  return (
    <div className={`ws-tree-edit ${message ? `ws-${message.kind}` : ''}`} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.stopPropagation()}>
      <input
        ref={input}
        value={value}
        aria-label={editing.label}
        aria-invalid={message?.kind === 'error' || undefined}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        onChange={(e) => {
          setValue(e.target.value)
          setMessage(editing.validate?.(e.target.value))
          editing.onChange?.(e.target.value)
        }}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.nativeEvent.isComposing) return
          if (e.key === 'Enter' || e.key === 'Escape') {
            e.preventDefault()
            finish(e.key === 'Enter')
          }
        }}
        onBlur={() => {
          // Switching to another window isn't leaving the box.
          if (document.activeElement === input.current) return
          finish(editing.validate?.(value)?.kind !== 'error')
        }}
      />
      {message && (
        <div className={`ws-tree-message ${above ? 'ws-above' : ''}`} role="alert">
          {message.text}
        </div>
      )}
    </div>
  )
}
