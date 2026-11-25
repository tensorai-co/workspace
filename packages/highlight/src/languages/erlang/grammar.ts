import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  after and andalso band begin bnot bor bsl bsr bxor case catch cond div end fun if let maybe not
  of or orelse receive rem try when xor else
`)
const BUILTINS = words(`
  abs apply atom_to_list binary_to_list element error exit float hd integer_to_list is_atom
  is_binary is_function is_integer is_list is_map is_number is_pid is_tuple length list_to_atom
  list_to_binary make_ref map_size node now self setelement size spawn spawn_link throw tl
  tuple_size tuple_to_list round trunc
`)

function atom(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (text === 'true' || text === 'false' || text === 'undefined') return 'constant'
  return undefined
}

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /%.*/, token: 'comment' },
      { match: /-[a-z_]\w*/, token: 'meta', after: (p) => p === undefined }, // -module(x).
      { match: /"""/, token: 'string', push: 'triple' },
      { match: /"/, token: 'string', push: 'string' },
      { match: /\$(?:\\.|.)/, token: 'string' }, // $a, a character
      { match: /'(?:[^'\\\n]|\\.)*'/, token: 'constant' }, // 'quoted atom'
      { match: /\?[A-Za-z_]\w*/, token: 'meta' }, // ?MODULE
      { match: /#[a-z_]\w*/, token: 'type' }, // #record{}
      { match: /([a-z]\w*)(:)([a-z]\w*)(?=\s*\()/, groups: ['type', 'operator', 'function'] }, // lists:map(
      { match: /[a-z]\w*(?=\s*\()/, token: (t) => atom(t) ?? (BUILTINS.has(t) ? 'builtin' : 'function') },
      { match: /[a-z]\w*/, token: atom },
      { match: /[A-Z_]\w*/, token: 'variable' },
      { match: /\d+#[\da-zA-Z]+|\d[\d_]*(?:\.\d[\d_]*(?:[eE][-+]?\d+)?)?/, token: 'number' },
      { match: /->|<-|<=|=>|:=|=:=|=\/=|==|\/=|=<|>=|\+\+|--|\|\||::|!|[-+*/=<>|]/, token: 'operator' },
      { match: /<<|>>/, token: 'punctuation' },
      { match: /[()[\]{},;.:#]/, token: 'punctuation' },
    ],
    string: [
      { match: /[^"\\~]+/, token: 'string' },
      { match: /\\(?:x\{[\da-fA-F]+\}|x[\da-fA-F]{2}|[0-7]{1,3}|\^.|.?)/, token: 'escape' },
      { match: /~[-\d.*]*[a-zA-Z~]/, token: 'escape' }, // ~p, ~s, ~n
      { match: /~/, token: 'string' },
      { match: /"/, token: 'string', pop: true },
    ],
    triple: [
      { match: /"""/, token: 'string', pop: true },
      { match: /[^"]+|"/, token: 'string' },
    ],
  },
}
