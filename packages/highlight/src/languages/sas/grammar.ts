import type { Grammar } from '../../engine/grammar.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  data set merge by if then else do end output run quit proc retain keep drop rename length format
  informat input infile cards datalines array label where when otherwise select class var model tables
  title footnote libname filename options ods select from as group order having create table into
  and or not in eq ne lt le gt ge to until while delete stop return leave continue call put
`)
const FUNCTIONS = words(`
  sum mean min max n nmiss std var round int abs sqrt log exp substr scan trim strip upcase lowcase
  compress cats catx index find length put input today mdy year month day intck intnx lag dif missing
  coalesce
`)

// SAS: data steps and procs, ended by run; or quit;, %macros with &variables,
// * comments; and /* comments */.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\*/, token: 'comment', push: 'comment' },
      { match: /\*[^;]*;/, token: 'comment', after: (p) => p === undefined || p.text === ';' }, // * a comment;
      { match: /(%macro)(\s+)(\w+)/i, groups: ['keyword', undefined, 'function'] },
      { match: /%(?:mend|let|put|if|then|else|do|end|to|global|local|include|sysfunc|eval|str|nrstr|upcase|scan|substr)\b/i, token: 'keyword' },
      { match: /%\w+/, token: 'function' }, // %mymacro
      { match: /&+\w+\.?/, token: 'variable' }, // &var.
      { match: /(proc)(\s+)(\w+)/i, groups: ['keyword', undefined, 'function'] },
      { match: /(data)(\s+)([\w.]+)/i, groups: ['keyword', undefined, 'type'], after: (p) => p === undefined || p.text === ';' },
      { match: /"/, token: 'string', push: 'double' },
      { match: /'(?:[^']|'')*'(?:d|dt|t|n)?/i, token: 'string' },
      { match: /(?:datalines|cards)4?\s*;/i, token: 'keyword', push: 'datalines' },
      { match: /[A-Za-z_]\w*(?=\s*\()/, token: (t) => (FUNCTIONS.has(t.toLowerCase()) ? 'builtin' : 'function') },
      { match: /[A-Za-z_][\w.]*/, token: (t) => (KEYWORDS.has(t.toLowerCase()) ? 'keyword' : undefined) },
      { match: /\d+(?:\.\d+)?(?:[eE][-+]?\d+)?|\.(?=[\s;,)])/, token: 'number' }, // . is a missing value
      { match: /\*\*|\|\||<>|<=|>=|\^=|~=|[-+*/<>=^~|&]/, token: 'operator' },
      { match: /[();,$@]/, token: 'punctuation' },
    ],
    double: [
      { match: /"/, token: 'string', pop: true },
      { match: /&+\w+\.?/, token: 'variable' },
      { match: /[^"&]+|&/, token: 'string' },
    ],
    datalines: [
      { match: /^;+\s*$/, token: 'keyword', pop: true },
      { match: /.+/, token: 'string' },
    ],
    comment: [
      { match: /\*\//, token: 'comment', pop: true },
      { match: /[^*]+|\*/, token: 'comment' },
    ],
  },
}
