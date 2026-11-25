import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  abstract anonymous as assembly break calldata catch constant constructor continue contract delete
  do else emit enum error event external fallback for function if immutable import indexed
  interface internal is library mapping memory modifier new override payable pragma private public
  pure receive return returns revert storage struct try type unchecked using view virtual while
  solidity global transient from
`)
const UNITS = words('wei gwei ether seconds minutes hours days weeks')
const VARIABLES = words('this super msg block tx abi')
const BUILTINS = words('require assert keccak256 sha256 ecrecover addmod mulmod selfdestruct blockhash gasleft')

function name(text: string): TokenType | undefined {
  if (VARIABLES.has(text)) return 'variable'
  if (KEYWORDS.has(text) || UNITS.has(text)) return 'keyword'
  if (text === 'true' || text === 'false') return 'constant'
  if (/^(?:u?int\d*|bytes\d*|address|bool|string|fixed|ufixed)$/.test(text)) return 'builtin'
  if (/^[A-Z][A-Z\d_]+$/.test(text)) return 'constant'
  if (/^[A-Z]/.test(text)) return 'type'
  return undefined
}

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /(?:hex|unicode)?"/, token: 'string', push: 'double' },
      { match: /(?:hex|unicode)?'/, token: 'string', push: 'single' },
      { match: /(function|modifier|event|error)(\s+)([A-Za-z_$][\w$]*)/, groups: ['keyword', undefined, 'function'] },
      { match: /(contract|interface|library|struct|enum|is)(\s+)([A-Za-z_$][\w$]*)/, groups: ['keyword', undefined, 'type'] },
      { match: /(\.)([A-Za-z_$][\w$]*)(?=\s*[({])/, groups: ['punctuation', 'function'] },
      { match: /(\.)([A-Za-z_$][\w$]*)/, groups: ['punctuation', 'property'] },
      { match: /[A-Za-z_$][\w$]*(?=\s*\()/, token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : 'function') },
      { match: /[A-Za-z_$][\w$]*/, token: name },
      { match: /0x[\da-fA-F_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE]-?\d+)?/, token: 'number' },
      { match: /\*\*|=>|\+\+|--|&&|\|\||<<=?|>>=?|[-+*/%&|^<>!=]=?|[~?]/, token: 'operator' },
      { match: /[()[\]{},;.:]/, token: 'punctuation' },
    ],
    double: [
      { match: /[^"\\]+/, token: 'string' },
      { match: /\\(?:x[\da-fA-F]{2}|u[\da-fA-F]{4}|.?)/, token: 'escape' },
      { match: /"/, token: 'string', pop: true },
      { match: /$/, pop: true },
    ],
    single: [
      { match: /[^'\\]+/, token: 'string' },
      { match: /\\(?:x[\da-fA-F]{2}|u[\da-fA-F]{4}|.?)/, token: 'escape' },
      { match: /'/, token: 'string', pop: true },
      { match: /$/, pop: true },
    ],
    blockComment: [
      { match: /[^*]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /\*/, token: 'comment' },
    ],
  },
}
