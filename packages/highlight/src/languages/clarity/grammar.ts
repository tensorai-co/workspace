import type { Grammar } from '../../engine/grammar.js'
import type { Token, TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const SPECIAL = words(`
  define-public define-private define-read-only define-constant define-data-var define-map
  define-fungible-token define-non-fungible-token define-trait impl-trait use-trait let begin if match
  and or not asserts! unwrap! unwrap-err! unwrap-panic unwrap-err-panic try! is-eq ok err some
`)
const BUILTINS = words(`
  var-get var-set map-get? map-set map-insert map-delete stx-transfer? stx-get-balance ft-mint?
  ft-transfer? ft-get-balance nft-mint? nft-transfer? nft-get-owner? contract-call? as-contract
  get-block-info? default-to is-some is-none is-ok is-err print len append concat map filter fold
  to-int to-uint + - * / mod pow < > <= >= sha256 keccak256 hash160 principal-of?
`)
const TYPES = words('int uint bool principal buff string-ascii string-utf8 list tuple optional response')
const VARIABLES = words('tx-sender contract-caller block-height stacks-block-height burn-block-height none true false')

/** The head of a list: a call's name. */
const head = (p: Token | undefined) => !!p && p.type === 'punctuation' && p.text.endsWith('(')

function call(text: string): TokenType {
  if (SPECIAL.has(text)) return 'keyword'
  if (BUILTINS.has(text)) return 'builtin'
  if (TYPES.has(text)) return 'type'
  return 'function'
}

const SYMBOL = /[A-Za-z!?<>=*+/_-][\w!?<>=*+/.-]*/.source

// Clarity (Stacks): a Lisp for smart contracts. define-public and friends,
// u100 integers, 'SP… principals and (ok …) and (err …) responses.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /;.*/, token: 'comment' },
      { match: /u?"/, token: 'string', push: 'string' },
      { match: /'[A-Z\d]{20,}(?:\.[\w-]+)?|\.[\w-]+(?=[\s)])/, token: 'constant' }, // 'SP2J6…, .contract
      { match: /0x[\da-fA-F]*|u?\d+/, token: 'number' },
      { match: new RegExp(`(\\()(define-[\\w-]+)(\\s+)(\\()(${SYMBOL})`), groups: ['punctuation', 'keyword', undefined, 'punctuation', 'function'], push: 'params' },
      { match: new RegExp(`(\\()(define-[\\w-]+)(\\s+)(${SYMBOL})`), groups: ['punctuation', 'keyword', undefined, 'function'] },
      { match: /[({]/, token: 'punctuation' },
      { match: /[)}]/, token: 'punctuation' },
      { match: new RegExp(SYMBOL), token: (t) => (VARIABLES.has(t) ? (t === 'true' || t === 'false' || t === 'none' ? 'constant' : 'variable') : TYPES.has(t) ? 'type' : undefined), after: (p) => !head(p) },
      { match: new RegExp(SYMBOL), token: call, after: head },
      { match: /[:,]/, token: 'punctuation' },
    ],
    // (name type) pairs, to the ) that ends the signature.
    params: [
      { match: /\s+/ },
      { match: /\)/, token: 'punctuation', pop: true },
      { match: /\(/, token: 'punctuation', push: 'params' },
      { match: /u?\d+/, token: 'number' },
      { match: new RegExp(SYMBOL), token: (t) => (TYPES.has(t) ? 'type' : 'variable') },
    ],
    string: [
      { match: /"/, token: 'string', pop: true },
      { match: /\\./, token: 'escape' },
      { match: /[^"\\]+/, token: 'string' },
    ],
  },
}
