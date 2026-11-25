import type { Clipboard } from '@tensorai-workspace/host'
import { bracketDepth, grammarOf, languageById, loadGrammar, paintLine, Tokenizer } from '@tensorai-workspace/languages'
import { Text } from '@tensorai-workspace/text'
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

/** Longer code stays plain. */
const MAX_COLORED = 200_000

/** Code in the editor's colors, once its grammar has loaded. */
export const Colored = memo(function Colored({ text, lang }: { text: string; lang?: string }): ReactNode {
  const language = useMemo(() => (lang ? languageById(lang.toLowerCase()) : undefined), [lang])
  const [grammar, setGrammar] = useState(() => language && grammarOf(language))
  useEffect(() => {
    let current = true
    const loaded = language && grammarOf(language)
    setGrammar(loaded)
    if (language?.grammar && !loaded) {
      void loadGrammar(language).then(
        (g) => current && setGrammar(g),
        () => {}, // It stays plain.
      )
    }
    return () => {
      current = false
    }
  }, [language])

  return useMemo(() => {
    if (!grammar || text.length > MAX_COLORED) return text
    let depth = 0
    return new Tokenizer(Text.of(text), grammar).all().flatMap((tokens, i) => {
      const runs = paintLine(tokens, depth)
      depth = bracketDepth(tokens, depth)
      const spans: ReactNode[] = runs.map((run, j) => (run.className ? <span key={`${i}.${j}`} className={run.className} children={run.text} /> : run.text))
      return i ? ['\n', ...spans] : spans
    })
  }, [text, grammar])
})

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
