import type { Grammar, Rule } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'

/** The colors columns take in turn, so a row reads across. */
const COLUMNS: TokenType[] = ['string', 'keyword', 'function', 'type', 'property', 'number']

/** A column's state: its cell, a tab to the next column, a line's end back to the first. */
function column(i: number): Rule[] {
  const next = `col${(i + 1) % COLUMNS.length}`
  return [
    { match: /[^\t\n]+/, token: COLUMNS[i] },
    { match: /\t/, next },
    { match: /$/, next: 'col0' },
  ]
}

// TSV: each column its own color, cycling after six.
export const grammar: Grammar = {
  start: 'col0',
  states: Object.fromEntries(COLUMNS.map((_, i) => [`col${i}`, column(i)])),
}
