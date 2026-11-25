import type { Clipboard } from '@tensorai-co/workspace/host'
import { useEffect, useRef, useState } from 'react'

// The preview's own icons (extensions/markdown-language-features), smaller than the codicons of the same names.
const COPY = (
  <>
    <path d="M4 4H2V14H11V12H4V4Z" />
    <path fillRule="evenodd" clipRule="evenodd" d="M5 2H14V11H5V2ZM6 3H13V10H6V3Z" />
  </>
)
const CHECK = <path d="M6.27 10.87L3.63 8.23L2.56 9.3L6.27 13.01L14.07 5.21L13 4.14L6.27 10.87Z" />

/** Copies a block's code. Shows a check mark for two seconds. */
export function CopyButton({ text, clipboard }: { text: string; clipboard?: Clipboard }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <button
      type="button"
      className={copied ? 'ws-md-copy ws-md-copied' : 'ws-md-copy'}
      aria-label="Copy code block"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        const done = () => {
          setCopied(true)
          clearTimeout(timer.current)
          timer.current = setTimeout(() => setCopied(false), 2000)
        }
        void (clipboard ?? navigator.clipboard).writeText(`${text}\n`).then(done, () => {})
      }}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        {copied ? CHECK : COPY}
      </svg>
    </button>
  )
}
