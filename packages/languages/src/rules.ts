import type { OnEnterRule, Pair, RegexSource, LanguageConfiguration } from './definitions.js'

/** A language's editing rules, ready to use: regexes compiled, defaults filled in. */
export interface Rules {
  lineComment?: string
  blockComment?: { open: string; close: string }
  brackets: { open: string; close: string }[]
  autoClosingPairs: Pair[]
  surroundingPairs: Pair[]
  /** Characters a pair may auto-close before. Elsewhere (before a word, say) it doesn't. */
  autoCloseBefore: string
  wordPattern: RegExp
  increaseIndent?: RegExp
  decreaseIndent?: RegExp
  indentNextLine?: RegExp
  unIndentedLine?: RegExp
  onEnter: CompiledOnEnterRule[]
  /** Lines that open and close folding regions, such as `#region`; and whether a region ends where indentation does, blank lines aside (Python). */
  folding: { start?: RegExp; end?: RegExp; offSide: boolean }
}

export interface CompiledOnEnterRule {
  beforeText?: RegExp
  afterText?: RegExp
  previousLineText?: RegExp
  action: OnEnterRule['action']
}

/** The default word pattern: numbers, or runs of characters that aren't separators. */
export const DEFAULT_WORD = /(-?\d*\.\d\w*)|([^`~!@#$%^&*()\-=+[{\]}\\|;:'",.<>/?\s]+)/g

const DEFAULT_PAIRS: Pair[] = [
  { open: '(', close: ')' },
  { open: '[', close: ']' },
  { open: '{', close: '}' },
  { open: '"', close: '"', notIn: ['string'] },
  { open: "'", close: "'", notIn: ['string', 'comment'] },
  { open: '`', close: '`', notIn: ['string', 'comment'] },
]

/**
 * Compiles a definition's regex. They're written for Oniguruma, which is almost always JavaScript-compatible; a pattern that isn't
 * is dropped, and the rule it belonged to falls back to the default.
 */
function compile(r: RegexSource | undefined, extraFlags = ''): RegExp | undefined {
  if (!r) return undefined
  try {
    const flags = [...new Set((r.flags ?? '') + extraFlags)].filter((f) => 'gimsuyd'.includes(f)).join('')
    return new RegExp(r.source, flags)
  } catch {
    return undefined
  }
}

/** Rules from a language configuration, or defaults where it has none. */
export function compileRules(rules: LanguageConfiguration | undefined, fallbackComment?: string): Rules {
  const r = rules ?? {}
  const onEnter: CompiledOnEnterRule[] = []
  for (const rule of r.onEnterRules ?? []) {
    const compiled = { beforeText: compile(rule.beforeText), afterText: compile(rule.afterText), previousLineText: compile(rule.previousLineText), action: rule.action }
    if ((rule.beforeText && !compiled.beforeText) || (rule.afterText && !compiled.afterText)) continue
    onEnter.push(compiled)
  }
  const lineComment = r.lineComment ?? fallbackComment
  return {
    ...(lineComment ? { lineComment } : {}),
    ...(r.blockComment ? { blockComment: r.blockComment } : {}),
    brackets: r.brackets ?? [
      { open: '(', close: ')' },
      { open: '[', close: ']' },
      { open: '{', close: '}' },
    ],
    autoClosingPairs: r.autoClosingPairs ?? DEFAULT_PAIRS,
    surroundingPairs: r.surroundingPairs ?? r.autoClosingPairs ?? DEFAULT_PAIRS,
    autoCloseBefore: r.autoCloseBefore ?? ';:.,=}])> \n\t',
    wordPattern: compile(r.wordPattern, 'g') ?? DEFAULT_WORD,
    increaseIndent: compile(r.indentationRules?.increaseIndentPattern),
    decreaseIndent: compile(r.indentationRules?.decreaseIndentPattern),
    indentNextLine: compile(r.indentationRules?.indentNextLinePattern),
    unIndentedLine: compile(r.indentationRules?.unIndentedLinePattern),
    onEnter,
    folding: { start: compile(r.folding?.start), end: compile(r.folding?.end), offSide: !!r.folding?.offSide },
  }
}
