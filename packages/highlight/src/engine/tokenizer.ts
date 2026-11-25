import { compile, type CompiledGrammar, type CompiledRule, type Embed, type Grammar, type Resolve } from './grammar.js'
import type { Token, TokenType } from '../tokens.js'

/**
 * The state stack between lines: state names, the current one last. An
 * embed's marker ("@style") splits it: the states after it are the
 * embedded language's.
 */
export type State = readonly string[]

// Limits that keep a hostile or huge block from stalling the page. Past
// them, text is plain.
/** Characters of a line that are tokenized. */
export const MAX_LINE_LENGTH = 5_000
/** Lines of a block that are tokenized. */
export const MAX_LINES = 5_000
/** States deep the stack may go (template literals in template literals…). */
const MAX_STACK = 32
/** State changes at one position before the tokenizer gives up on it. */
const MAX_EMPTY_STEPS = 8

/** Where on the stack the innermost language starts, and which it is. */
interface Context {
  /** Its grammar, or undefined when it isn't loaded: its code is plain. */
  grammar: CompiledGrammar | undefined
  /** The index of its first state; 0 for the block's own language. */
  base: number
  /** The embed it's in, and the marker's argument. */
  embed?: Embed
  arg: string
}

/** context walks the stack's markers, from the block's language inwards. */
function context(stack: State, root: CompiledGrammar, resolve: Resolve | undefined): Context {
  let ctx: Context = { grammar: root, base: 0, arg: '' }
  for (let i = 0; i < stack.length; i++) {
    const s = stack[i]!
    if (s[0] !== '@' || !ctx.grammar) continue
    const slash = s.indexOf('/')
    const key = slash === -1 ? s.slice(1) : s.slice(1, slash)
    const embed = ctx.grammar.embeds[key]
    if (!embed) continue
    const arg = slash === -1 ? '' : s.slice(slash + 1)
    const id = typeof embed.language === 'function' ? embed.language(arg) : embed.language
    const inner = id ? resolve?.(id) : undefined
    ctx = { grammar: inner && compile(inner), base: i + 1, embed, arg }
  }
  return ctx
}

/** findEnd is where an embed ends on this line, at or after from, or -1. */
function findEnd(embed: Embed, line: string, from: number, arg: string): number {
  if (typeof embed.end === 'function') return embed.end(line, from, arg)
  const re = embed.end.global ? embed.end : new RegExp(embed.end.source, embed.end.flags + 'g')
  re.lastIndex = from
  return re.exec(line)?.index ?? -1
}

/**
 * tokenizeLine tokenizes one line (without its line ending), starting in
 * state, and returns its tokens and the state the next line starts in.
 * resolve finds the languages the grammar embeds.
 */
export function tokenizeLine(line: string, state: State, grammar: Grammar, resolve?: Resolve): { tokens: Token[]; state: State } {
  const root = compile(grammar)
  let stack: State = state.length > 0 ? state : [root.start]
  let ctx = context(stack, root, resolve)
  /** Where the current embed ends on this line: unknown (-2), nowhere (-1), or an index. */
  let endAt = -2
  const setStack = (next: State) => {
    if (next === stack) return
    stack = next
    const base = ctx.base
    ctx = context(stack, root, resolve)
    if (ctx.base !== base) endAt = -2
  }
  /** The innermost language's own states, and what's below them. */
  const inner = (): State => (stack.length > ctx.base ? stack.slice(ctx.base) : [ctx.grammar?.start ?? 'root'])

  const tokens: Token[] = []
  let prev: Token | undefined
  const emit = (text: string, type: TokenType | undefined) => {
    if (text === '') return
    const last = tokens[tokens.length - 1]
    if (last && last.type === type) last.text += text
    else tokens.push(type ? { text, type } : { text })
    if (type !== 'comment' && /\S/.test(text)) prev = { text, ...(type ? { type } : {}) }
  }

  const limit = Math.min(line.length, MAX_LINE_LENGTH)
  let pos = 0
  let emptySteps = 0
  // The line as the innermost language sees it: cut where its embed ends.
  let view = line
  while (pos < limit) {
    let cut = line.length
    if (ctx.embed) {
      if (endAt === -2 || (endAt >= 0 && endAt < pos)) endAt = findEnd(ctx.embed, line, pos, ctx.arg)
      if (endAt === pos) {
        // The embed ends here: back to the language around it.
        setStack(stack.slice(0, ctx.base - 1))
        prev = undefined
        continue
      }
      if (endAt > pos) cut = endAt
    }
    if (!ctx.grammar) {
      const stop = Math.min(cut, limit)
      emit(line.slice(pos, stop), undefined)
      pos = stop
      continue
    }
    if (view.length !== cut) view = cut === line.length ? line : line.slice(0, cut)

    const states = inner()
    const step = matchAt(ctx.grammar, states, view, pos, prev)
    if (!step) {
      // Nothing matched: one plain character (a whole code point).
      const ch = String.fromCodePoint(line.codePointAt(pos)!)
      emit(ch, undefined)
      pos += ch.length
      emptySteps = 0
      continue
    }
    const { rule, length, groups } = step
    if (length === 0) {
      if (++emptySteps > MAX_EMPTY_STEPS) {
        emit(line[pos]!, undefined)
        pos++
        emptySteps = 0
        continue
      }
    } else {
      emptySteps = 0
    }
    const text = line.slice(pos, pos + length)
    if (rule.groups && groups && covers(groups, length)) {
      for (let i = 1; i < groups.length; i++) emit(groups[i] ?? '', rule.groups[i - 1])
    } else {
      emit(text, typeof rule.token === 'function' ? rule.token(text) : rule.token)
    }
    const next = changeState(states, rule, text, ctx.grammar, stack.length)
    if (next !== states) {
      const entering = next.length > states.length && next[next.length - 1]![0] === '@'
      setStack([...stack.slice(0, ctx.base), ...next])
      if (entering) prev = undefined // embedded code starts afresh
    }
    pos += length
  }
  if (pos < line.length) emit(line.slice(pos), undefined)

  // At the end of the line, an embed may end (a shell session's command
  // ends with its line), and rules that match nothing may still change
  // state: a single-line string ends with its line.
  for (let i = 0; i < MAX_EMPTY_STEPS; i++) {
    if (ctx.embed && findEnd(ctx.embed, line, line.length, ctx.arg) === line.length) {
      setStack(stack.slice(0, ctx.base - 1))
      continue
    }
    if (!ctx.grammar) break
    const states = inner()
    const step = matchAt(ctx.grammar, states, line, line.length, prev, true)
    if (!step) break
    setStack([...stack.slice(0, ctx.base), ...changeState(states, step.rule, '', ctx.grammar, stack.length)])
  }
  return { tokens, state: stack }
}

function matchAt(
  g: CompiledGrammar,
  stack: State,
  line: string,
  pos: number,
  prev: Token | undefined,
  atEnd = false,
): { rule: CompiledRule; length: number; groups?: RegExpExecArray } | undefined {
  const top = stack[stack.length - 1]!
  const slash = top.indexOf('/')
  const name = slash === -1 ? top : top.slice(0, slash)
  const arg = slash === -1 ? '' : top.slice(slash + 1)
  const rules = g.states.get(name) ?? g.states.get(g.start)!
  for (const rule of rules) {
    if (rule.after && !rule.after(prev)) continue
    const m = rule.match(line, pos, arg)
    if (m === null || (typeof m === 'number' && m < 0)) continue
    const length = typeof m === 'number' ? m : m[0].length
    const changes = rule.push !== undefined || rule.pop || rule.next !== undefined
    if (length === 0 && !changes) continue
    if (atEnd && length !== 0) continue
    return typeof m === 'number' ? { rule, length } : { rule, length, groups: m }
  }
  return undefined
}

/** covers reports whether the capture groups are the whole match, in order. */
function covers(groups: RegExpExecArray, length: number): boolean {
  let n = 0
  for (let i = 1; i < groups.length; i++) n += groups[i]?.length ?? 0
  return n === length
}

/** changeState applies a rule's push, pop or next to a language's own states. depth is the whole stack's. */
function changeState(stack: State, rule: CompiledRule, text: string, g: CompiledGrammar, depth: number): State {
  const top = stack[stack.length - 1]!
  const slash = top.indexOf('/')
  const arg = slash === -1 ? '' : top.slice(slash + 1)
  if (rule.pop) return stack.length > 1 ? stack.slice(0, -1) : [g.start]
  if (rule.next !== undefined) return [...stack.slice(0, -1), typeof rule.next === 'function' ? rule.next(text, arg) : rule.next]
  if (rule.push !== undefined) {
    if (depth >= MAX_STACK) return stack
    return [...stack, typeof rule.push === 'function' ? rule.push(text, arg) : rule.push]
  }
  return stack
}

/**
 * Session tokenizes code that changes, as code streaming in does. Each
 * update re-tokenizes from the first line that changed, and reuses the
 * lines before it, along with the state each ended in.
 */
export class Session {
  private lines: string[] = []
  private tokens: Token[][] = []
  private ends: State[] = []

  constructor(
    private grammar: Grammar,
    private resolve?: Resolve,
  ) {}

  update(code: string): Token[][] {
    const lines = code.split(/\r?\n/)
    let same = 0
    while (same < lines.length && same < this.lines.length && lines[same] === this.lines[same]) same++
    this.tokens.length = same
    this.ends.length = same
    let state: State = same === 0 ? [] : this.ends[same - 1]!
    for (let i = same; i < lines.length; i++) {
      const line = lines[i]!
      if (i >= MAX_LINES) {
        this.tokens.push(line ? [{ text: line }] : [])
        this.ends.push(state)
        continue
      }
      const r = tokenizeLine(line, state, this.grammar, this.resolve)
      this.tokens.push(r.tokens)
      this.ends.push(r.state)
      state = r.state
    }
    this.lines = lines
    return this.tokens.slice()
  }
}

/** tokenize tokenizes code: one array of tokens per line. resolve finds embedded languages. */
export function tokenize(code: string, grammar: Grammar, resolve?: Resolve): Token[][] {
  return new Session(grammar, resolve).update(code)
}
