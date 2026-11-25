import { resolveGrammar, tokenizeLine, type Grammar, type State, type Token } from '@tensorai-workspace/highlight'
import type { ChangeSet, Text } from '@tensorai-workspace/text'

export type { Token }

const START: State = []

function sameState(a: State, b: State | undefined): boolean {
  if (a === b) return true
  if (!b || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

/**
 * Incremental tokenizing for one document, driving highlight's tokenizeLine directly.
 *
 * Each line keeps its tokens and the state it ends in. After an edit, work restarts at the first changed line and stops
 * as soon as a line past the edit ends in the same state it did before: from there on the old tokens are still right.
 * Typing inside a function re-tokenizes one line, not the file. Work runs in slices (`work`), so the caller decides
 * when: the editor gives it a few milliseconds a frame, visible lines first.
 *
 * Unlike highlight's Session, there's no line-count limit: files of any length tokenize.
 */
export class Tokenizer {
  private tokens: (Token[] | undefined)[] = []
  private ends: (State | undefined)[] = []
  /** Lines [0, valid) are tokenized and correct. */
  private valid = 0
  /**
   * Lines [dirtyEnd, reusableEnd) hold tokens from before the last edits. They're right if the line before them still
   * ends in the same state; the first line that proves it lets work skip to reusableEnd.
   */
  private dirtyEnd = 0
  private reusableEnd = 0

  constructor(
    private doc: Text,
    private grammar: Grammar | undefined,
  ) {
    this.reset()
  }

  private reset() {
    this.tokens = new Array(this.doc.lines)
    this.ends = new Array(this.doc.lines)
    this.valid = 0
    this.dirtyEnd = 0
    this.reusableEnd = 0
  }

  /** Switches grammar (a language loaded, or the language changed). Everything re-tokenizes. */
  setGrammar(grammar: Grammar | undefined) {
    if (grammar === this.grammar) return
    this.grammar = grammar
    this.reset()
  }

  /** Follows an edit: keeps the lines before and after it, and marks the edited lines for work. */
  update(changes: ChangeSet, doc: Text) {
    const old = this.doc
    this.doc = doc
    if (changes.empty) return
    let first = Infinity
    let lastOld = -1
    let lastNew = -1
    for (const c of changes.inserted()) {
      first = Math.min(first, old.lineAt(c.oldFrom).number - 1)
      lastOld = Math.max(lastOld, old.lineAt(c.oldTo).number - 1)
      lastNew = Math.max(lastNew, doc.lineAt(c.to).number - 1)
    }
    const removed = lastOld - first + 1
    const added = lastNew - first + 1
    const fill = new Array<undefined>(added)
    this.tokens.splice(first, removed, ...fill)
    this.ends.splice(first, removed, ...fill)
    const shift = added - removed

    // Cached lines form at most two runs: the correct prefix, and the reusable window. Each is one consistent chain of
    // states, but they aren't consistent with each other (the window predates an earlier edit), so they're never joined.
    // Keep the first run (or the part of it) that lies after the edit, shifted, as the new reusable window.
    const runs: [number, number][] = []
    if (this.valid > 0) runs.push([0, this.valid])
    if (this.reusableEnd > this.dirtyEnd) runs.push([this.dirtyEnd, this.reusableEnd])
    const after = runs.find(([, end]) => end > lastOld + 1)
    if (after) {
      this.dirtyEnd = Math.max(after[0], lastOld + 1) + shift
      this.reusableEnd = after[1] + shift
    } else this.dirtyEnd = this.reusableEnd = 0
    this.valid = Math.min(this.valid, first)
  }

  /** The tokens of a 1-based line, if it's tokenized and still right. */
  lineTokens(n: number): Token[] | undefined {
    return n - 1 < this.valid ? this.tokens[n - 1] : undefined
  }

  /** Lines tokenized from the top, all correct. */
  get validLines(): number {
    return this.valid
  }

  /** Whether everything is tokenized. */
  get done(): boolean {
    return this.valid >= this.doc.lines
  }

  /**
   * Tokenizes until `until` (1-based, inclusive) is done or the time budget (ms) runs out. Returns the 1-based range
   * of lines whose tokens changed, so the view repaints only those.
   */
  work(until: number, budgetMs: number, now: () => number = () => performance.now()): { from: number; to: number } | undefined {
    const target = Math.min(until, this.doc.lines)
    if (this.valid >= target) return undefined
    const start = now()
    const firstChanged = this.valid + 1
    let i = this.valid
    let count = 0
    while (i < target) {
      if (!this.grammar) {
        this.tokens[i] = [{ text: this.doc.line(i + 1).text }]
        this.ends[i] = START
        i++
        continue
      }
      const state = i === 0 ? START : (this.ends[i - 1] ?? START)
      const old = i >= this.dirtyEnd && i < this.reusableEnd ? this.ends[i] : undefined
      const r = tokenizeLine(this.doc.line(i + 1).text, state, this.grammar, resolveGrammar)
      this.tokens[i] = r.tokens
      this.ends[i] = r.state
      i++
      if (old && sameState(r.state, old)) {
        // Every line after this one is unchanged and starts from the same state: its old tokens are right.
        i = Math.max(i, this.reusableEnd)
        this.dirtyEnd = this.reusableEnd = 0
        break
      }
      if (i >= this.reusableEnd) this.dirtyEnd = this.reusableEnd = 0
      if ((++count & 31) === 0 && now() - start > budgetMs) break
    }
    this.valid = Math.max(this.valid, i)
    return { from: firstChanged, to: this.valid }
  }

  /**
   * Tokens for lines that aren't in the document, as if they began at line `n`: for previews such as ghost text.
   * Undefined without a grammar, or until the line before `n` is tokenized.
   */
  preview(n: number, lines: readonly string[]): Token[][] | undefined {
    const grammar = this.grammar
    if (!grammar || n < 1 || n - 1 > this.valid) return undefined
    let state = n === 1 ? START : this.ends[n - 2]
    if (!state) return undefined
    return lines.map((line) => {
      const r = tokenizeLine(line, state!, grammar, resolveGrammar)
      state = r.state
      return r.tokens
    })
  }

  /** Tokenizes everything, for tests and small documents. */
  all(): Token[][] {
    while (!this.done) this.work(this.doc.lines, Infinity)
    return Array.from({ length: this.doc.lines }, (_, k) => this.tokens[k] ?? [])
  }
}
