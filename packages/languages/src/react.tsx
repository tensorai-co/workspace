import { Text } from '@tensorai-co/workspace/text'
import { memo, useEffect, useMemo, useState, type ReactNode } from 'react'
import { bracketDepth, paintLine } from './paint.js'
import { detectLanguage, grammarOf, languageById, loadGrammar } from './registry.js'
import { Tokenizer } from './tokenizer.js'

/** Longer code stays plain. */
const MAX_COLORED = 200_000

export interface HighlightedProps {
  text: string
  /** The language, by id or alias: "tsx", "python", "sh". */
  language?: string
  /** Or a file name or path, to find the language from, as the editor does: "main.rs", "Dockerfile". */
  path?: string
}

/**
 * Code in the editor's colors, read-only: the text's lines as spans with `paintLine`'s classes, plain until its
 * grammar has loaded. Put it in an element with the `ws-syntax` class, with `theme/styles.css` loaded, such as
 * `<pre className="ws-syntax"><code><Highlighted text={code} language="ts" /></code></pre>`.
 */
export const Highlighted = memo(function Highlighted({ text, language: id, path }: HighlightedProps): ReactNode {
  const language = useMemo(() => (id ? languageById(id.toLowerCase()) : path ? detectLanguage(path, text.slice(0, text.indexOf('\n') >>> 0)) : undefined), [id, path]) // eslint-disable-line react-hooks/exhaustive-deps
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
