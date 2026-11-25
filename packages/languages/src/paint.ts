import type { Token } from './tokenizer.js'

/** A run of text and the class that colors it, if any: "t-string", "b-2" (a bracket, by its nesting level). */
export interface Paint {
  text: string
  className?: string
}

/**
 * highlight has one "keyword" type; the themes color three kinds differently. These words get the storage.type
 * and storage.modifier colors; every other keyword is keyword.control.
 */
const STORAGE_WORDS = new Set(['const', 'let', 'var', 'function', 'class', 'interface', 'type', 'enum', 'namespace', 'module', 'mod', 'fn', 'struct', 'impl', 'trait', 'def', 'func', 'package', 'extends', 'implements', 'void', 'new', 'typeof', 'keyof', 'instanceof', 'in', 'of', 'as', 'satisfies'])
const MODIFIER_WORDS = new Set(['pub', 'public', 'private', 'protected', 'static', 'readonly', 'async', 'await', 'abstract', 'declare', 'override', 'mut', 'final', 'virtual', 'unsafe', 'extern', 'crate'])
const OPEN = '([{'
const CLOSE = ')]}'

function keywordKind(word: string): string {
  return STORAGE_WORDS.has(word) ? 'storage' : MODIFIER_WORDS.has(word) ? 'modifier' : 'keyword'
}

/**
 * One line's tokens as colored runs, for an element with the class `ws-syntax` (theme/styles.css). `depth` is how many
 * brackets are open where the line starts, from `bracketDepth`; without it brackets get no color of their own.
 */
export function paintLine(tokens: readonly Token[], depth?: number): Paint[] {
  const out: Paint[] = []
  let level = depth ?? 0
  for (const t of tokens) {
    if (!t.type) {
      out.push({ text: t.text })
      continue
    }
    if (t.type === 'punctuation' && depth !== undefined && /[()[\]{}]/.test(t.text)) {
      // Bracket pair colors: each bracket by its nesting level.
      let plain = ''
      const flush = () => {
        if (plain) out.push({ text: plain, className: 't-punctuation' })
        plain = ''
      }
      for (const ch of t.text) {
        const open = OPEN.includes(ch)
        if (!open && !CLOSE.includes(ch)) {
          plain += ch
          continue
        }
        flush()
        if (!open) level = Math.max(0, level - 1)
        out.push({ text: ch, className: `b-${(level % 3) + 1}` })
        if (open) level++
      }
      flush()
      continue
    }
    out.push({ text: t.text, className: `t-${t.type === 'keyword' ? keywordKind(t.text) : t.type}` })
  }
  return out
}

/** How many brackets are open at the line's end, given how many were at its start. */
export function bracketDepth(tokens: readonly Token[], depth: number): number {
  let level = depth
  for (const t of tokens) {
    if (t.type !== 'punctuation') continue
    for (const ch of t.text) {
      if (OPEN.includes(ch)) level++
      else if (CLOSE.includes(ch)) level = Math.max(0, level - 1)
    }
  }
  return level
}
