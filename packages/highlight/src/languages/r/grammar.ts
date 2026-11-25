import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words('if else repeat while function for in next break return switch')
const CONSTANTS = words('TRUE FALSE NULL NA NA_integer_ NA_real_ NA_character_ NA_complex_ Inf NaN T F')
const BUILTINS = words(`
  c list vector matrix array data.frame factor library require source print cat paste paste0 sprintf
  length nrow ncol names colnames rownames seq seq_len seq_along rep sum mean median sd var min max
  range round abs sqrt exp log apply sapply lapply vapply mapply tapply do.call is.na is.null
  ifelse which stop warning message tryCatch invisible return nchar substr toupper tolower grepl
  gsub sub strsplit unique sort order head tail summary str class typeof as.numeric as.character
  as.integer read.csv write.csv setdiff union intersect Sys.time Sys.Date
`)

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (CONSTANTS.has(text)) return 'constant'
  return undefined
}

const IDENT = /(?:[A-Za-z.][\w.]*|`[^`\n]+`)/.source

/** A raw string's end: r"(…)", r"[…]", r"{…}", with any dashes: r"--(…)--". */
function rawClose(text: string): string {
  const open = text.at(-1)!
  const close = open === '(' ? ')' : open === '[' ? ']' : '}'
  return `raw/${close}${text.slice(2, -1)}${text[1]}`
}

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /#.*/, token: 'comment' },
      { match: /[rR]["'](-*)[([{]/, token: 'string', push: rawClose },
      { match: /"/, token: 'string', push: 'double' },
      { match: /'/, token: 'string', push: 'single' },
      { match: new RegExp(`(${IDENT})(\\s*)(<<?-|=)(\\s*)(function|\\\\)(?=\\s*\\()`), groups: ['function', undefined, 'operator', undefined, 'keyword'] },
      { match: /\\(?=\s*\()/, token: 'keyword' }, // \(x) x + 1
      { match: new RegExp(`(\\$|@)(${IDENT})`), groups: ['operator', 'property'] },
      { match: new RegExp(`(${IDENT})(::?:?)`), groups: ['type', 'operator'] }, // dplyr::filter
      { match: new RegExp(`${IDENT}(?=\\s*\\()`), token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : 'function') },
      { match: new RegExp(`${IDENT}(?=\\s*=[^=])`), token: (t) => name(t) ?? 'property', after: (p) => !!p && (p.text === '(' || p.text === ',') },
      { match: new RegExp(IDENT), token: name },
      { match: /(?:0[xX][\da-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)[Li]?/, token: 'number' },
      { match: /<<-|->>|<-|->|\|>|%[^%\n]*%|==|!=|<=|>=|&&|\|\||[-+*/^<>!&|~?=:$@]/, token: 'operator' },
      { match: /[()[\]{},;]/, token: 'punctuation' },
    ],
    double: [
      { match: /[^"\\]+/, token: 'string' },
      { match: /\\(?:x[\da-fA-F]{1,2}|u\{?[\da-fA-F]{1,4}\}?|U\{?[\da-fA-F]{1,8}\}?|[0-7]{1,3}|.?)/, token: 'escape' },
      { match: /"/, token: 'string', pop: true },
    ],
    single: [
      { match: /[^'\\]+/, token: 'string' },
      { match: /\\(?:x[\da-fA-F]{1,2}|u\{?[\da-fA-F]{1,4}\}?|U\{?[\da-fA-F]{1,8}\}?|[0-7]{1,3}|.?)/, token: 'escape' },
      { match: /'/, token: 'string', pop: true },
    ],
    raw: [
      { match: (line, pos, close) => (line.startsWith(close, pos) ? close.length : -1), token: 'string', pop: true },
      { match: /[^)\]}]+|[)\]}]/, token: 'string' },
    ],
  },
}
