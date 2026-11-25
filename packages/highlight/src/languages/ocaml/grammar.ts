import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  and as assert begin class constraint do done downto else end exception external for fun function
  functor if in include inherit initializer lazy let match method module mutable new nonrec object
  of open private rec sig struct then to try type val virtual when while with land lor lxor lsl lsr
  asr mod or not
`)
const BUILTINS = words('print_string print_endline print_int printf failwith ignore raise ref fst snd')
const TYPES = words('int float string bool char unit list array option exn bytes')

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (text === 'true' || text === 'false') return 'constant'
  if (BUILTINS.has(text) || TYPES.has(text)) return 'builtin'
  return undefined
}

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\(\*/, token: 'comment', push: 'comment' },
      { match: /"/, token: 'string', push: 'string' },
      { match: /\{([a-z_]*)\|/, token: 'string', push: (t) => `quoted/${t.slice(1, -1)}` }, // {id|…|id}
      { match: /'(?:[^'\\\n]|\\(?:x[\da-fA-F]{2}|\d{3}|o[0-7]{3}|.))'/, token: 'string' },
      { match: /'[a-z_]\w*/, token: 'type' }, // a type variable: 'a
      { match: /(let|and)(\s+)(?:(rec)(\s+))?([a-z_][\w']*)(?=\s+[\w(~?']|\s*[:=]\s*fun\b)/, groups: ['keyword', undefined, 'keyword', undefined, 'function'] },
      { match: /(type|module|exception)(\s+)(?:(rec|type)(\s+))?([A-Za-z_][\w']*)/, groups: ['keyword', undefined, 'keyword', undefined, 'type'] },
      { match: /[~?][a-z_][\w']*:?/, token: 'property' }, // ~label, ?opt
      { match: /[A-Z][\w']*/, token: 'type' }, // modules and constructors
      { match: /[a-z_][\w']*/, token: name },
      { match: /0[xX][\da-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+|\d[\d_]*(?:\.[\d_]*)?(?:[eE][-+]?\d+)?[lLn]?/, token: 'number' },
      { match: /->|<-|:=|::|\|>|@@|\|\||&&|;;|[-+*/%=<>@^|&!?~$.:]+/, token: 'operator' },
      { match: /[()[\]{},;]/, token: 'punctuation' },
    ],
    string: [
      { match: /[^"\\]+/, token: 'string' },
      { match: /\\(?:x[\da-fA-F]{2}|\d{3}|o[0-7]{3}|u\{[\da-fA-F]+\}|\n|.?)/, token: 'escape' },
      { match: /"/, token: 'string', pop: true },
    ],
    quoted: [
      { match: (line, pos, id) => (line.startsWith(`|${id}}`, pos) ? id.length + 2 : -1), token: 'string', pop: true },
      { match: /[^|]+|\|/, token: 'string' },
    ],
    comment: [
      { match: /\(\*/, token: 'comment', push: 'comment' }, // they nest
      { match: /\*\)/, token: 'comment', pop: true },
      { match: /[^(*]+|[(*]/, token: 'comment' },
    ],
  },
}
