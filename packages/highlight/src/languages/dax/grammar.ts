import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  var return in not and or define evaluate measure column table order by asc desc start at
`)
const CONSTANTS = words('true false blank')
const BUILTINS = words(`
  calculate calculatetable filter all allexcept allselected values distinct sum sumx average
  averagex min minx max maxx count countx countrows countblank distinctcount divide if switch
  iferror isblank related relatedtable earlier selectedvalue hasonevalue format date year month day
  today now datediff dateadd totalytd sameperiodlastyear userelationship keepfilters removefilters
  topn rankx concatenatex lookupvalue summarize summarizecolumns addcolumns selectcolumns generate
  union intersect except crossjoin
`)

function name(text: string): TokenType | undefined {
  const w = text.toLowerCase()
  if (KEYWORDS.has(w)) return 'keyword'
  if (CONSTANTS.has(w)) return 'constant'
  return undefined
}

const IDENT = /[A-Za-z_][\w.]*/.source

// DAX (Power BI): measures and calculated columns: 'Table'[Column], [Measure], VAR … RETURN and functions.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /'(?:[^']|'')*'/, token: 'type' }, // 'Sales Table'
      { match: /\[[^\]\n]*\]/, token: 'property' }, // [Amount], [Total Sales]
      { match: /(var)(\s+)([A-Za-z_]\w*)/i, groups: ['keyword', undefined, 'variable'] }, // VAR name
      { match: /([A-Za-z_][\w ]*?)(\s*)(=)(?!=)/, groups: ['function', undefined, 'operator'], after: (p) => p === undefined }, // Total Sales =
      { match: /\/\/.*/, token: 'comment' },
      { match: /\-\-.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /"/, token: 'string', push: 'string0' },
      { match: new RegExp(`(\\??\\.)(${IDENT})(?=\\s*\\()`), groups: ['punctuation', 'function'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})`), groups: ['punctuation', 'property'] },
      { match: new RegExp(`${IDENT}(?=\\s*\\()`), token: (t) => name(t) ?? (BUILTINS.has(t.toLowerCase()) ? 'builtin' : 'function') },
      { match: new RegExp(IDENT), token: (t) => name(t) ?? (BUILTINS.has(t.toLowerCase()) ? 'builtin' : undefined) },
      { match: /0[xX][\da-fA-F_]+\w*|0[bB][01_]+\w*|0[oO][0-7_]+\w*|(?:\d[\d_]*(?:\.(?![.A-Za-z_])[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?\w*/, token: 'number' },
      { match: /&&|\|\||==|<>|<=|>=|[-+*/^&<>=]/, token: 'operator' },
      { match: /[()[\]{},;.]/, token: 'punctuation' },
    ],
    string0: [
      { match: /"/, token: 'string', pop: true },
      { match: /[^"]+/, token: 'string' },
      { match: /./, token: 'string' },
      { match: /$/, pop: true },
    ],
    blockComment: [
      { match: /[^*\/]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /[*\/]/, token: 'comment' },
    ],
  },
}
