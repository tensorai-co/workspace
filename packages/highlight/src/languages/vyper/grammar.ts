import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  and as assert break continue def elif else for from if import in implements interface is log not
  or pass raise return struct event enum flag immutable constant public indexed payable nonpayable
  view pure external internal deploy initializes uses exports extcall staticcall range
`)
const CONSTANTS = words('True False empty max_value min_value ZERO_ADDRESS EMPTY_BYTES32 MAX_UINT256')
const BUILTINS = words(`
  address bool bytes32 bytes decimal int8 int128 int256 uint8 uint128 uint256 String Bytes DynArray
  HashMap len concat convert slice keccak256 sha256 ecrecover send
  raw_call create_minimal_proxy_to create_copy_of selfdestruct min max abs sqrt isqrt uint2str
  extract32 as_wei_value shift unsafe_add unsafe_sub unsafe_mul unsafe_div print
`)
const VARIABLES = words('self msg block tx chain')
/** Words that are keywords only where a statement starts. */
const SOFT_KEYWORDS = words('match case type')

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (CONSTANTS.has(text)) return 'constant'
  if (BUILTINS.has(text)) return 'builtin'
  if (VARIABLES.has(text)) return 'variable'
  if (/^_*[A-Z]\w*[a-z]\w*$/.test(text)) return 'type' // PascalCase: a class
  return undefined
}

/**
 * A string's state carries its quote and prefix after the slash:
 * "string/'''/f" is a triple-quoted f-string.
 */
function openString(text: string): string {
  const m = /^([rRbBuUfF]*)('''|"""|'|")$/.exec(text)!
  return `string/${m[2]}/${m[1]!.toLowerCase()}`
}

const quote = (arg: string) => arg.slice(0, arg.indexOf('/'))
const prefix = (arg: string) => arg.slice(arg.indexOf('/') + 1)

// Vyper: Python-like contracts for the EVM: @decorators, typed storage,
// events, structs and interfaces.
export const grammar: Grammar = {
  states: {
    root: [
      // Soft keywords, at the start of a statement only.
      { match: /(?:match|case|type)\b(?=[ \t]+[^\s=:(),.])/, token: (t) => (SOFT_KEYWORDS.has(t) ? 'keyword' : undefined), after: (p) => p === undefined },
      { include: 'code' },
    ],
    code: [
      { match: /\s+/ },
      { match: /#.*/, token: 'comment' },
      { match: /@[A-Za-z_][\w.]*/, token: 'meta', after: (p) => p === undefined },
      { match: /[rRbBuUfF]{0,2}(?:'''|"""|'|")/, token: 'string', push: openString },
      { match: /(def)(\s+)([A-Za-z_]\w*)/, groups: ['keyword', undefined, 'function'] },
      { match: /(class)(\s+)([A-Za-z_]\w*)/, groups: ['keyword', undefined, 'type'] },
      { match: /[A-Za-z_]\w*(?=\s*\()/, token: (t) => name(t) ?? 'function' },
      { match: /[A-Za-z_]\w*/, token: name },
      {
        match: /(?:0[xX][\da-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+|(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?[jJ]?)/,
        token: 'number',
      },
      { match: /\*\*=?|\/\/=?|<<=?|>>=?|->|:=|[-+*/%@&|^~<>!=]=?/, token: 'operator' },
      { match: /[()[\]{},:;.]/, token: 'punctuation' },
    ],
    string: [
      { match: (line, pos, arg) => (line.startsWith(quote(arg), pos) ? quote(arg).length : -1), token: 'string', pop: true },
      // Escapes, unless the string is raw.
      {
        match: (line, pos, arg) => {
          if (prefix(arg).includes('r') || line[pos] !== '\\') return -1
          const m = /\\(?:N\{[^}]*\}|x[\da-fA-F]{2}|u[\da-fA-F]{4}|U[\da-fA-F]{8}|[0-7]{1,3}|.?)/y
          m.lastIndex = pos
          return m.exec(line)?.[0].length ?? -1
        },
        token: 'escape',
      },
      // An f-string's {{ }} are literal braces; { starts an expression.
      { match: (line, pos, arg) => (prefix(arg).includes('f') && (line.startsWith('{{', pos) || line.startsWith('}}', pos)) ? 2 : -1), token: 'string' },
      { match: (line, pos, arg) => (prefix(arg).includes('f') && line[pos] === '{' ? 1 : -1), token: 'escape', push: 'fexpr' },
      {
        match: (line, pos, arg) => {
          const q = quote(arg)[0]!
          const f = prefix(arg).includes('f')
          let i = pos
          while (i < line.length && line[i] !== q && line[i] !== '\\' && !(f && (line[i] === '{' || line[i] === '}'))) i++
          return i > pos ? i - pos : -1
        },
        token: 'string',
      },
      { match: /./, token: 'string' },
      // A one-quote string can't span lines (unless continued with \).
      { match: (line, pos, arg) => (pos === line.length && quote(arg).length === 1 && !line.endsWith('\\') ? 0 : -1), pop: true },
    ],
    // An f-string expression: Python, up to its closing brace.
    fexpr: [
      { match: /\}/, token: 'escape', pop: true },
      { match: /\{/, token: 'punctuation', push: 'braces' },
      { match: /![rsa](?=[:}])/, token: 'escape' },
      { include: 'code' },
    ],
    braces: [
      { match: /\}/, token: 'punctuation', pop: true },
      { match: /\{/, token: 'punctuation', push: 'braces' },
      { include: 'code' },
    ],
  },
}
