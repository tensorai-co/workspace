import type { InlineCompletion, InlineCompletionRequest } from '@tensorai-co/workspace/host'
import { ScriptedCompletionProvider } from '@tensorai-co/workspace/testing'

const WORD = /[\w$]/
const NAME = /^[A-Za-z_$][\w$]*$/

/** The word around a position, by the characters names are made of. */
function wordAt(text: string, from: number, to = from) {
  while (from > 0 && WORD.test(text[from - 1]!)) from--
  while (to < text.length && WORD.test(text[to]!)) to++
  return { from, to, word: text.slice(from, to) }
}

/** Where a name is used, as a whole word. */
function uses(text: string, name: string): number[] {
  const out: number[] = []
  for (let at = text.indexOf(name); at >= 0; at = text.indexOf(name, at + 1)) {
    if (!WORD.test(text[at - 1] ?? '') && !WORD.test(text[at + name.length] ?? '')) out.push(at)
  }
  return out
}

/**
 * A pretend model for the playground. Renaming something suggests the same rename where the old name is used next,
 * as a next edit (Tab, Tab). Otherwise it finds what's typed before the cursor in the sample files and suggests what
 * follows it there, with the more indented lines under it. It streams a few characters at a time, as a model would.
 */
export function pretendModel(files: Record<string, string>) {
  const lines = Object.values(files).flatMap((text) => text.split('\n'))
  /** Each file as the model last understood it, and the rename it's following there. */
  const bases = new Map<string, string>()
  const renames = new Map<string, { from: string; to: string }>()

  const nextEdit = (request: InlineCompletionRequest): InlineCompletion['nextEdit'] => {
    const path = request.path ?? ''
    const text = request.doc.toString()
    const base = bases.get(path) ?? Object.entries(files).find(([name]) => path.endsWith(`/${name}`))?.[1] ?? text
    // The one stretch that differs from the base, widened to whole words on both sides.
    let start = 0
    while (start < base.length && start < text.length && base[start] === text[start]) start++
    let end = 0
    while (end < base.length - start && end < text.length - start && base[base.length - 1 - end] === text[text.length - 1 - end]) end++
    const before = wordAt(base, start, base.length - end)
    const after = wordAt(text, start, text.length - end)
    const renamed = before.word !== after.word && NAME.test(before.word) && NAME.test(after.word) && before.from === after.from
    if (renamed && uses(text, before.word).length) renames.set(path, { from: before.word, to: after.word })
    const rename = renames.get(path)
    const left = rename ? uses(text, rename.from) : []
    if (!rename || !left.length) {
      renames.delete(path)
      bases.set(path, text)
      return undefined
    }
    // The next use after the cursor, or the first one.
    const at = left.find((n) => n >= request.position) ?? left[0]!
    return { from: at, to: at + rename.from.length, insert: rename.to }
  }

  const ghost = (request: InlineCompletionRequest): InlineCompletion | undefined => {
    const line = request.doc.lineAt(request.position)
    const before = line.text.slice(0, request.position - line.from)
    // At the end of a line, or before closing brackets and quotes, after something worth matching.
    const after = line.text.slice(before.length)
    if (!/^[\])}'"`>;,]*$/.test(after)) return undefined
    const typed = before.trimStart()
    if (typed.length < 3) return undefined
    for (const [i, candidate] of lines.entries()) {
      const at = candidate.indexOf(typed)
      if (at < 0) continue
      const rest = candidate.slice(at + typed.length)
      if (!rest.trim()) continue
      // The lines under it that are indented further, moved to this line's indentation.
      const indent = (s: string) => s.length - s.trimStart().length
      const base = indent(candidate)
      const ours = before.slice(0, before.length - typed.length)
      const more: string[] = []
      for (const next of lines.slice(i + 1, i + 7)) {
        if (next.trim() && indent(next) <= base) {
          // The line that closes the block comes too.
          if (/^\s*[)\]}]/.test(next)) more.push(ours + next.trimStart())
          break
        }
        more.push(next.trim() ? ours + next.slice(base) : '')
      }
      // It replaces the closers after the cursor, which it has to keep, in order, for the editor to show it.
      return { text: [rest, ...more].join('\n'), range: { from: request.position, to: line.to } }
    }
    return undefined
  }

  const suggest = (request: InlineCompletionRequest): InlineCompletion | undefined => {
    const edit = nextEdit(request)
    return edit ? { text: '', nextEdit: edit } : ghost(request)
  }
  return new ScriptedCompletionProvider({ suggest, chunk: 6, delay: 30 })
}
