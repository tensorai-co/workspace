// A grammar is data: named states, each an ordered list of rules. The
// tokenizer is in a state (the top of a stack); at each position it tries
// that state's rules in order, and the first that matches emits a token and
// may push, pop or switch states. The stack carries from line to line, which
// is how strings and comments span lines.

import type { Token, TokenType } from '../tokens.js'

/**
 * A matcher: a regular expression, or a function for what one can't say
 * (a heredoc's end, which depends on its opening). A function gets the line,
 * the position and the state's argument (see Rule.push), and returns how many
 * characters it matched, or -1.
 */
export type Matcher = RegExp | ((line: string, pos: number, arg: string) => number)

export interface Rule {
  match: Matcher
  /** The token's type, or a function of the match: e.g. keyword or plain name. */
  token?: TokenType | ((text: string) => TokenType | undefined)
  /**
   * Types for each capture group, in order, when the match has parts of
   * different types: /(def)(\s+)(\w+)/ → ['keyword', undefined, 'function'].
   * The groups must cover the whole match.
   */
  groups?: (TokenType | undefined)[]
  /**
   * Pushes a state. A function of the match (and the current state's
   * argument) can add an argument after a slash, "heredoc/EOF", which the
   * state's function matchers receive.
   */
  push?: string | ((text: string, arg: string) => string)
  /** Pops the state. */
  pop?: boolean
  /** Replaces the state, the same way. */
  next?: string | ((text: string, arg: string) => string)
  /**
   * Whether the rule may apply after the line's previous significant token
   * (not a space or comment): undefined at the start of a line. A slash is a
   * regular expression after "(" or "return", and division after a name.
   */
  after?: (prev: Token | undefined) => boolean
}

export interface Grammar {
  /** The state lines start in. "root" by default. */
  start?: string
  states: Record<string, (Rule | { include: string })[]>
  /**
   * Other languages inside this one: a <style> element's CSS, a fence's
   * code. A rule enters one by pushing "@name" (or "@name/arg"), and the
   * other language's grammar runs until the embed's end, where this one
   * takes over again.
   */
  embeds?: Record<string, Embed>
}

export interface Embed {
  /** The language's id or alias, or a function of the marker's argument: a fence's "py". */
  language: string | ((arg: string) => string)
  /**
   * Where the other language stops: the first match at or after the
   * position, which may be on a later line. Its text belongs to this
   * language again, e.g. </style>. A function returns the index, or -1.
   */
  end: RegExp | ((line: string, from: number, arg: string) => number)
}

/**
 * Resolve finds another language's grammar by id or alias, for embeds; or
 * undefined when it isn't loaded or doesn't exist, and the code stays plain.
 */
export type Resolve = (language: string) => Grammar | undefined

/** A rule ready to run: its pattern sticky, includes inlined. */
export interface CompiledRule extends Omit<Rule, 'match'> {
  match: (line: string, pos: number, arg: string) => RegExpExecArray | number | null
}

export interface CompiledGrammar {
  start: string
  states: Map<string, CompiledRule[]>
  embeds: Record<string, Embed>
}

const compiledCache = new WeakMap<Grammar, CompiledGrammar>()

/** compile makes each pattern sticky and inlines includes, once per grammar. */
export function compile(g: Grammar): CompiledGrammar {
  const cached = compiledCache.get(g)
  if (cached) return cached
  const states = new Map<string, CompiledRule[]>()
  const resolve = (name: string, seen: Set<string>): CompiledRule[] => {
    const done = states.get(name)
    if (done) return done
    const rules = g.states[name]
    if (!rules) throw new Error(`highlight: no state "${name}"`)
    if (seen.has(name)) throw new Error(`highlight: state "${name}" includes itself`)
    seen.add(name)
    const out: CompiledRule[] = []
    for (const r of rules) {
      if ('include' in r) out.push(...resolve(r.include, seen))
      else out.push(compileRule(r))
    }
    states.set(name, out)
    return out
  }
  for (const name of Object.keys(g.states)) resolve(name, new Set())
  const c = { start: g.start ?? 'root', states, embeds: g.embeds ?? {} }
  if (!states.has(c.start)) throw new Error(`highlight: no start state "${c.start}"`)
  compiledCache.set(g, c)
  return c
}

function compileRule(r: Rule): CompiledRule {
  const m = r.match
  if (typeof m === 'function') return { ...r, match: m }
  const flags = m.flags.replace(/[gy]/g, '') + 'y'
  const re = new RegExp(m.source, flags)
  return {
    ...r,
    match: (line, pos) => {
      re.lastIndex = pos
      return re.exec(line)
    },
  }
}
