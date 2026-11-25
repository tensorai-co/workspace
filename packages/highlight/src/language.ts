import type { Grammar } from './engine/grammar.js'

/** A language: what a code block's header calls it, and its grammar. */
export interface Language {
  /** Its id, as in LANGUAGES: "python". */
  id: string
  /** What a code block's header shows: "Python". */
  label: string
  grammar: Grammar
}

/** words is a Set of words, for token functions: KEYWORDS.has(text). */
export function words(list: string): Set<string> {
  return new Set(list.split(/\s+/).filter(Boolean))
}

/**
 * lengthAt is how many characters re matches at pos in line, or -1: for
 * function matchers that test a pattern only under some condition, without
 * copying the line.
 */
export function lengthAt(re: RegExp, line: string, pos: number): number {
  const sticky = re.sticky ? re : new RegExp(re.source, re.flags + 'y')
  sticky.lastIndex = pos
  return sticky.exec(line)?.[0].length ?? -1
}
