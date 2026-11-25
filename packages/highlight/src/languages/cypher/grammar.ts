import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

// Cypher (Neo4j, openCypher). Keywords are any case.
const KEYWORDS = words(`
  match optional where return with unwind create merge delete detach set remove order by skip limit
  asc ascending desc descending union all distinct as and or xor not in starts ends contains is
  case when then else end on call yield exists foreach load csv from headers fieldterminator use
  constraint index unique for require node key show drop if
`)
const BUILTINS = words(`
  count sum avg min max collect size length type id labels keys properties nodes relationships
  head last tail range coalesce toString toInteger toFloat toLower toUpper trim split replace
  substring date datetime timestamp duration point distance exists startNode endNode
`)

function name(text: string): TokenType | undefined {
  const lower = text.toLowerCase()
  if (lower === 'true' || lower === 'false' || lower === 'null') return 'constant'
  if (KEYWORDS.has(lower)) return 'keyword'
  return undefined
}

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?/, token: 'string' },
      { match: /`[^`\n]*`?/ },
      { match: /\$[A-Za-z_]\w*/, token: 'variable' }, // $param
      { match: /(:)([A-Za-z_][\w]*|`[^`\n]*`)/, groups: ['punctuation', 'type'] }, // :Label, :REL_TYPE
      { match: /[A-Za-z_]\w*(?=\s*:(?!:))/, token: 'property', after: (p) => !!p && (p.text === '{' || p.text === ',') }, // {name: …}
      { match: /(\.)([A-Za-z_]\w*)/, groups: ['punctuation', 'property'] },
      { match: /[A-Za-z_][\w.]*(?=\s*\()/, token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : 'function') },
      { match: /[A-Za-z_]\w*/, token: name },
      { match: /-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/, token: 'number' },
      { match: /<-|->|-|=~|<>|<=|>=|\+=|[=<>+*/%^|]/, token: 'operator' },
      { match: /[()[\]{},;.:]/, token: 'punctuation' },
    ],
    blockComment: [
      { match: /[^*]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /\*/, token: 'comment' },
    ],
  },
}
