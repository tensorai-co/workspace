import { Codicon } from '@tensorai-workspace/icons/react'
import { useEffect, useId, useRef } from 'react'

export interface DialogButton {
  label: string
  /** What onAnswer gets. */
  value: string
}

export interface DialogProps {
  message: string
  detail?: string
  kind?: 'warning' | 'error' | 'info'
  /** The first one is the primary button, at the right. The others go to its left. */
  buttons: DialogButton[]
  /** The value of the button chosen, or undefined when the dialog was dismissed. */
  onAnswer: (value: string | undefined) => void
}

/** The dialog. The page behind it is dimmed until it's answered. */
export function Dialog({ message, detail, kind = 'warning', buttons, onAnswer }: DialogProps) {
  const id = useId()
  const primary = useRef<HTMLButtonElement>(null)
  useEffect(() => primary.current?.focus(), [])
  const [first, ...rest] = buttons
  return (
    <div className="ws-dialog-shade" onMouseDown={(e) => e.target === e.currentTarget && e.preventDefault()}>
      <div
        className="ws-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-message`}
        aria-describedby={detail ? `${id}-detail` : undefined}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Escape') onAnswer(undefined)
          if (e.key !== 'Tab' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
          // Between the buttons, and never out of the dialog.
          e.preventDefault()
          const all = [...e.currentTarget.querySelectorAll('button')]
          const back = e.key === 'Tab' ? e.shiftKey : e.key === 'ArrowLeft'
          const at = all.indexOf(document.activeElement as HTMLButtonElement)
          all[(at + (back ? -1 : 1) + all.length) % all.length]?.focus()
        }}
      >
        <button type="button" className="ws-dialog-close" aria-label="Close Dialog" onClick={() => onAnswer(undefined)}>
          <Codicon name="close" />
        </button>
        <div className="ws-dialog-message">
          <Codicon name={kind} size={24} className={`ws-dialog-icon ws-${kind}`} />
          <div className="ws-dialog-text">
            <div id={`${id}-message`} className="ws-dialog-title">
              {message}
            </div>
            {detail && (
              <div id={`${id}-detail`} className="ws-dialog-detail">
                {detail}
              </div>
            )}
          </div>
        </div>
        <div className="ws-dialog-buttons">
          {rest.reverse().map((b) => (
            <button key={b.value} type="button" className="ws-button ws-secondary" onClick={() => onAnswer(b.value)}>
              {b.label}
            </button>
          ))}
          {first && (
            <button ref={primary} type="button" className="ws-button" onClick={() => onAnswer(first.value)}>
              {first.label}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
