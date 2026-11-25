import type { InlineCompletionProvider, LanguageService, Location } from '@tensorai-workspace/host'
import { detectLanguage, languageById } from '@tensorai-workspace/languages'
import { useEffect, useRef, type CSSProperties } from 'react'
import { EditorState } from '../core/state.js'
import { EditorView } from '../view/view.js'

export interface CodeEditorProps {
  /** The text. When it changes from outside, the editor takes it. */
  value: string
  onChange?: (value: string) => void
  /** A language id ("tsx", "typescriptreact", "python"); `path` picks one too. Defaults to TSX. */
  language?: string
  /** The file's path, to pick the language. */
  path?: string
  readOnly?: boolean
  autoFocus?: boolean
  className?: string
  style?: CSSProperties
  /** The view, once it exists: for running commands or reading the state. */
  onView?: (view: EditorView | null) => void
  /** After every transaction, edits or not (cursor moves too): for status bars. */
  onUpdate?: (view: EditorView) => void
  /** AI ghost text: suggestions from any model, shown after the cursor and accepted with Tab. */
  inlineCompletions?: InlineCompletionProvider
  /** Anything else the provider should see with each request, such as recent edits. */
  completionContext?: (state: EditorState) => unknown
  /** Wraps lines at the editor's width. */
  wordWrap?: boolean
  /** Completions, hovers, problems and definitions, from a language service. */
  languages?: LanguageService
  /** A definition in another file was asked for (F12, ⌘-click): open it. */
  onOpenLocation?: (location: Location) => void
}

/** One document in a code editor, with no tabs: for any app that needs a code field. */
export function CodeEditor({ value, onChange, language, path, readOnly, autoFocus, className, style, onView, onUpdate, inlineCompletions, completionContext, wordWrap, languages, onOpenLocation }: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const latest = useRef({ onChange, onView, onUpdate, completionContext, onOpenLocation })
  latest.current = { onChange, onView, onUpdate, completionContext, onOpenLocation }
  const inline = (provider: InlineCompletionProvider | undefined) =>
    provider && { provider, path, completionContext: (state: EditorState) => latest.current.completionContext?.(state) }
  const features = (service: LanguageService | undefined) => service && { service, path, openLocation: (location: Location) => latest.current.onOpenLocation?.(location) }

  useEffect(() => {
    const parent = host.current
    if (!parent) return
    const lang = language ? languageById(language) : path ? detectLanguage(path, value.split('\n', 1)[0]) : languageById('tsx')
    const v = new EditorView({
      parent,
      readOnly,
      state: EditorState.create({ doc: value, language: lang }),
      inlineCompletions: inline(inlineCompletions),
      languages: features(languages),
      wordWrap,
      onUpdate: (tr, ed) => {
        if (tr.docChanged) latest.current.onChange?.(ed.state.doc.toString())
        latest.current.onUpdate?.(ed)
      },
    })
    view.current = v
    latest.current.onView?.(v)
    if (autoFocus) v.focus()
    return () => {
      latest.current.onView?.(null)
      v.destroy()
      view.current = null
    }
    // The view is made once per language and mode; value changes go through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, path, readOnly])

  useEffect(() => {
    view.current?.setWordWrap(!!wordWrap)
  }, [wordWrap])

  useEffect(() => {
    view.current?.setInlineCompletions(inline(inlineCompletions))
    // The path is part of the view's own effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inlineCompletions])

  useEffect(() => {
    view.current?.setLanguages(features(languages))
    // The path is part of the view's own effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [languages])

  useEffect(() => {
    const v = view.current
    if (!v || v.state.doc.toString() === value) return
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value }, userEvent: 'set' })
  }, [value])

  return <div ref={host} className={className} style={{ height: '100%', ...style }} />
}
