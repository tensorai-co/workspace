import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  alignas alignof and and_eq asm auto bitand bitor break case catch class co_await co_return
  co_yield compl concept const const_cast consteval constexpr constinit continue decltype default
  delete do dynamic_cast else enum explicit export extern final for friend goto if import inline
  module mutable namespace new noexcept not not_eq operator or or_eq override private protected
  public reinterpret_cast requires return sizeof static static_assert static_cast struct switch
  template thread_local throw try typedef typeid typename union using virtual volatile while xor
  xor_eq
`)
const TYPES = words(`
  bool char char8_t char16_t char32_t double float int long short signed unsigned void wchar_t
  size_t ssize_t ptrdiff_t intptr_t uintptr_t nullptr_t
`)
const CONSTANTS = words('true false nullptr NULL this')
/** The standard library names answers use most, after std::. */
const STD = words(`
  string string_view vector array map unordered_map set unordered_set list deque queue stack pair
  tuple optional variant any function unique_ptr shared_ptr weak_ptr span thread mutex lock_guard
  unique_lock atomic chrono cout cin cerr endl move forward make_unique make_shared make_pair sort
  find begin end size swap min max ostream istream ifstream ofstream stringstream runtime_error
  exception size_t
`)

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (TYPES.has(text) || /^u?int(?:8|16|32|64)_t$/.test(text)) return 'builtin'
  if (CONSTANTS.has(text)) return text === 'this' ? 'variable' : 'constant'
  if (/^_*[A-Z][A-Z\d_]+$/.test(text)) return 'constant' // a macro by convention
  if (/^[A-Z][a-z]\w*$/.test(text) || /_t$/.test(text)) return 'type' // Widget, node_t
  return undefined
}

const IDENT = /[A-Za-z_]\w*/.source

/** The delimiter of a raw string, from its opening R"delim(. */
function rawDelimiter(text: string): string {
  return 'raw/' + text.slice(text.indexOf('"') + 1, -1)
}

export const grammar: Grammar = {
  states: {
    root: [
      { match: /(#\s*)(include|import|include_next)\b/, groups: ['meta', 'meta'], push: 'include', after: (p) => p === undefined },
      { match: /#\s*[A-Za-z_]+/, token: 'meta', push: 'directive', after: (p) => p === undefined },
      { include: 'code' },
    ],
    code: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      // R"delim(...)delim" spans lines with no escapes.
      { match: /(?:u8|[uUL])?R"[^()\\\s"]{0,16}\(/, token: 'string', push: rawDelimiter },
      { match: /(?:u8|[uUL])?"/, token: 'string', push: 'string' },
      { match: /(?:u8|[uUL])?'(?:[^'\\\n]|\\(?:x[\da-fA-F]+|[0-7]{1,3}|u[\da-fA-F]{4}|U[\da-fA-F]{8}|.))*'/, token: 'string' },
      { match: /\[\[[^\]\n]*\]\]/, token: 'meta' }, // [[nodiscard]]
      { match: new RegExp(`(class|struct|union|enum(?:\\s+class)?|namespace|concept)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'type'] },
      // A name before :: is a namespace or class: std::, Widget::.
      { match: new RegExp(`(${IDENT})(::)`), groups: ['type', 'operator'] },
      { match: new RegExp(`(?<=std::)${IDENT}`), token: (t) => (STD.has(t) ? 'builtin' : undefined) },
      // A member: s.area(), p->next. Not a trailing return type: ) -> int.
      { match: new RegExp(`(\\.|->)(${IDENT})(?=\\s*\\()`), groups: ['operator', 'function'] },
      { match: new RegExp(`(\\.|->)(${IDENT})`), groups: ['operator', 'property'] },
      { match: /(operator)(\s*)(\(\)|\[\]|<=>|->\*?|[-+*/%^&|~!=<>]=?|<<=?|>>=?|&&|\|\||\+\+|--|,|new|delete)/, groups: ['keyword', undefined, 'function'] },
      { match: new RegExp(`${IDENT}(?=\\s*\\()`), token: (t) => (KEYWORDS.has(t) || TYPES.has(t) ? 'keyword' : CONSTANTS.has(t) ? name(t) : 'function') },
      { match: new RegExp(IDENT), token: name },
      {
        match: /(?:0[xX][\da-fA-F']+(?:\.[\da-fA-F']*)?(?:[pP][+-]?\d+)?|0[bB][01']+|(?:\d[\d']*(?:\.[\d']*)?|\.\d[\d']*)(?:[eE][+-]?\d+)?)(?:[uUlLfFzZ]+|_\w+)?/,
        token: 'number',
      },
      { match: /<=>|->\*?|::|\+\+|--|<<=?|>>=?|&&|\|\||\.\.\.|\.\*|[-+*/%&|^<>!=]=?|[~?]/, token: 'operator' },
      { match: /[()[\]{},;.:]/, token: 'punctuation' },
    ],
    include: [
      { match: /\s+/ },
      { match: /<[^>\n]*>?/, token: 'string' },
      { match: /"[^"\n]*"?/, token: 'string' },
      { match: /\/\/.*/, token: 'comment' },
      { match: /$/, pop: true },
    ],
    directive: [
      { match: /\\$/, token: 'escape' },
      { match: (line, pos) => (pos === line.length && !line.endsWith('\\') ? 0 : -1), pop: true },
      { match: new RegExp(`(?<=^#\\s*(?:define|undef|ifdef|ifndef)\\s+)${IDENT}`), token: 'function' },
      { include: 'code' },
    ],
    string: [
      { match: /[^"\\]+/, token: 'string' },
      { match: /\\(?:x[\da-fA-F]+|[0-7]{1,3}|u[\da-fA-F]{4}|U[\da-fA-F]{8}|.?)/, token: 'escape' },
      { match: /"(?:sv|s)?/, token: 'string', pop: true },
      { match: /$/, pop: true },
    ],
    raw: [
      // Through the closing )delim", where it's on this line; else the whole line.
      {
        match: (line, pos, delim) => {
          const end = line.indexOf(`)${delim}"`, pos)
          return end === -1 ? -1 : end + delim.length + 2 - pos
        },
        token: 'string',
        pop: true,
      },
      { match: /.+/, token: 'string' },
    ],
    blockComment: [
      { match: /[^*]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /\*/, token: 'comment' },
    ],
  },
}
