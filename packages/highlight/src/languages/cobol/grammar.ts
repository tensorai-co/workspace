import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

// COBOL, in free or fixed form. Its words are any case.
const KEYWORDS = words(`
  identification environment data procedure division section program-id author configuration
  input-output file-control select assign to organization access mode working-storage
  local-storage linkage file fd sd copy replace move add subtract multiply divide compute giving
  into by from remainder rounded display accept perform until varying thru through times if else
  end-if evaluate when other end-evaluate stop run goback exit call using returning open close
  read write rewrite delete start initialize inspect string unstring tallying replacing set
  search continue not and or is equal greater less than end-perform end-read end-call end-compute
  at end on size error invalid key value values occurs depending indexed redefines usage binary
  comp comp-3 packed-decimal pic picture
`)
const CONSTANTS = words('zero zeros zeroes space spaces high-value high-values low-value low-values quote quotes null nulls true false')

function name(text: string): TokenType | undefined {
  const lower = text.toLowerCase()
  if (CONSTANTS.has(lower)) return 'constant'
  if (KEYWORDS.has(lower)) return 'keyword'
  return undefined
}

export const grammar: Grammar = {
  states: {
    root: [
      // Fixed form: a sequence number in columns 1-6, and * or / in column 7 for a comment.
      { match: /\d{6}(?=[ *\/-])/, token: 'comment', after: (p) => p === undefined },
      { match: /[*\/].*/, token: 'comment', after: (p) => p === undefined || /^\d{6}$/.test(p.text) },
      { match: /\s+/ },
      { match: /\*>.*/, token: 'comment' },
      { match: /(pic(?:ture)?)(\s+)((?:is\s+)?[^\s.]+(?:\.[^\s.]+)*)/i, groups: ['keyword', undefined, 'type'] }, // PIC 9(5)V99
      { match: /"(?:[^"\n]|"")*"?|'(?:[^'\n]|'')*'?/, token: 'string' },
      { match: /\b(?:0[1-9]|[1-4]\d|66|77|88)(?=\s+[A-Za-z])/, token: 'number', after: (p) => p === undefined }, // a level number
      { match: /[A-Za-z][\w-]*(?=\s*\.\s*$)/, token: (t) => name(t) ?? 'function', after: (p) => p === undefined }, // a paragraph's name
      { match: /[A-Za-z][\w-]*/, token: name },
      { match: /[-+]?\d+(?:\.\d+)?/, token: 'number' },
      { match: /\*\*|>=|<=|[-+*/=<>]/, token: 'operator' },
      { match: /[().,:]/, token: 'punctuation' },
    ],
  },
}
