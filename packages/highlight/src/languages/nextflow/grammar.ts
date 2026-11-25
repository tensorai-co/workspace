import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

// Nextflow: Groovy pipelines of processes and workflows. Directives,
// input:, output: and script: sections, channels and params.
const KEYWORDS = words(`
  abstract as assert break case catch class const continue def default do else enum extends final
  finally for goto if implements import in instanceof interface native new package private protected
  public return static strictfp super switch synchronized threadsafe throw throws trait transient try
  var while process workflow include from take main emit input output script shell exec stub when
  publish
`)
/** A process's directives and its inputs' and outputs' qualifiers. */
const DIRECTIVES = words(`
  path val file env stdin stdout tuple each container conda cpus memory time label tag publishDir
  errorStrategy maxRetries cache queue executor module storeDir debug accelerator disk
`)
const BUILTINS = words('println print printf sprintf each eachWithIndex collect findAll find inject sum with tap Channel channel params workflow log file files nextflow projectDir launchDir task')
const TYPES = words('boolean byte char double float int long short void')
const CONSTANTS = words('true false null')
const VARIABLES = words('this super it delegate owner')

function name(text: string): TokenType | undefined {
  if (VARIABLES.has(text)) return 'variable'
  if (KEYWORDS.has(text)) return 'keyword'
  if (DIRECTIVES.has(text)) return 'builtin'
  if (TYPES.has(text)) return 'builtin'
  if (CONSTANTS.has(text)) return 'constant'
  if (/^[A-Z][A-Z\d_]+$/.test(text)) return 'constant' // MAX_SIZE
  if (/^[A-Z]\w*$/.test(text)) return 'type' // String, T
  return undefined
}

const IDENT = /[A-Za-z_$][\w$]*/.source

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /#!.*/, token: 'meta', after: (p) => p === undefined },
      { match: new RegExp(`(process|workflow)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'function'] },
      { match: /(input|output|script|shell|exec|stub|when|take|main|emit|publish)(:)/, groups: ['keyword', 'punctuation'] },
      // GStrings interpolate: "…${x}…", """…""". Single quotes don't.
      { match: /"""/, token: 'string', push: 'gstring/"""' },
      { match: /"/, token: 'string', push: 'gstring/"' },
      { match: /'''/, token: 'string', push: "literal/'''" },
      { match: /'/, token: 'string', push: "literal/'" },
      // A slashy string, where a value can go: /a+b/
      { match: /\/(?=[^\s/*])(?:\\.|[^/\\\n])*\//, token: 'regexp', after: (p) => !p || p.type === 'operator' || p.type === 'keyword' || /[(,]$/.test(p.text) },
      { match: /@(?!interface\b)[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/, token: 'meta' },
      { match: new RegExp(`(class|interface|enum|record|@interface)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'type'] },
      { match: new RegExp(`(package|import(?:\\s+static)?)(\\s+)([\\w.]+(?:\\.\\*)?)`), groups: ['keyword', undefined, 'type'] },
      { match: new RegExp(`(\\.)(${IDENT})(?=\\s*[({])`), groups: ['punctuation', 'function'] }, // .each { }, .join(…)
      { match: /(\.)([A-Z][a-z][\w$]*)/, groups: ['punctuation', 'type'] }, // Map.Entry
      { match: new RegExp(`(\\.)(${IDENT})`), groups: ['punctuation', 'property'] },
      { match: new RegExp(`(::)(${IDENT})`), groups: ['operator', 'function'] }, // Order::total
      { match: new RegExp(`${IDENT}(?=\\s*\\()`), token: (t) => (KEYWORDS.has(t) || VARIABLES.has(t) ? name(t) : /^[A-Z]/.test(t) && !/^[A-Z][A-Z\d_]+$/.test(t) ? 'type' : BUILTINS.has(t) ? 'builtin' : 'function') },
      // A call without parentheses at a statement's start: println "x"
      { match: new RegExp(`${IDENT}(?=\\s+[\\w"'$])`), token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : undefined), after: (p) => !p || p.text === '{' || p.text === ';' || p.text === '->' },
      { match: new RegExp(IDENT), token: name },
      {
        match: /(?:0[xX][\da-fA-F_]+(?:\.[\da-fA-F_]*)?(?:[pP][+-]?\d+)?|0[bB][01_]+|(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?)[lLfFdD]?/,
        token: 'number',
      },
      { match: /->|::|\?\.|\?:|\*\.|\.&|\.@|<=>|==~|=~|\.\.<?|\+\+|--|\*\*|<<=?|>>>?=?|&&|\|\||[-+*/%&|^<>!=]=?|[~?]/, token: 'operator' },
      { match: /[()[\]{},;.:@]/, token: 'punctuation' },
    ],
    // "gstring/"" or "gstring/""""": its closing quotes. $x and ${x} interpolate.
    gstring: [
      { match: (line, pos, q) => (line.startsWith(q, pos) ? q.length : -1), token: 'string', pop: true },
      { match: /\\(?:u[\da-fA-F]{4}|.?)/, token: 'escape' },
      { match: /\$\{/, token: 'escape', push: 'interpolation' },
      { match: /\$[A-Za-z_][\w.]*/, token: 'variable' },
      { match: /[^"\\$]+|["$]/, token: 'string' },
      { match: (line, pos, q) => (pos === line.length && q.length === 1 ? 0 : -1), pop: true },
    ],
    literal: [
      { match: (line, pos, q) => (line.startsWith(q, pos) ? q.length : -1), token: 'string', pop: true },
      { match: /\\./, token: 'escape' },
      { match: /[^'\\]+|'/, token: 'string' },
      { match: (line, pos, q) => (pos === line.length && q.length === 1 ? 0 : -1), pop: true },
    ],
    interpolation: [
      { match: /\}/, token: 'escape', pop: true },
      { match: /\{/, token: 'punctuation', push: 'braces' },
      { include: 'root' },
    ],
    braces: [
      { match: /\}/, token: 'punctuation', pop: true },
      { match: /\{/, token: 'punctuation', push: 'braces' },
      { include: 'root' },
    ],
    blockComment: [
      { match: /[^*]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /\*/, token: 'comment' },
    ],
  },
}
