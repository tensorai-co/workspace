import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  and as await break by case catch class const continue css def delete do elif else export extend
  extends finally for from get global if import in isa is isnt let local new not of or own prop attr
  return set static super switch tag then throw try typeof unless until var when while yield
`)
const CONSTANTS = words('true false null undefined yes no NaN Infinity')
const VARIABLES = words('self this')
const BUILTINS = words('console window document imba Math JSON Object Array Promise setTimeout fetch')

function name(text: string): TokenType | undefined {
  if (VARIABLES.has(text)) return 'variable'
  if (KEYWORDS.has(text)) return 'keyword'
  if (CONSTANTS.has(text)) return 'constant'
  if (BUILTINS.has(text)) return 'builtin'
  if (/^[A-Z]/.test(text)) return 'type'
  return undefined
}

// Imba: indentation-based JavaScript with tags as values (<div.title>
// "text"), @events, def and tag declarations, and css lines.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /###/, token: 'comment', push: 'blockComment' },
      { match: /#\s.*|#$/, token: 'comment' },
      { match: /"/, token: 'string', push: 'double' },
      { match: /'/, token: 'string', push: 'single' },
      { match: /`/, token: 'string', push: 'template' },
      { match: /(tag)(\s+)([\w-]+)/, groups: ['keyword', undefined, 'type'] },
      { match: /(class)(\s+)([A-Za-z_$][\w$-]*)/, groups: ['keyword', undefined, 'type'] },
      { match: /(def|get|set)(\s+)([A-Za-z_$][\w$-]*[?!]?)/, groups: ['keyword', undefined, 'function'] },
      // css .btn bg:blue4 c:white
      { match: /(global\s+)?(css)\b/, token: 'keyword', push: 'css' },
      // A tag: <button.primary#ok @click=save>
      { match: /(<)([\w-]+|self|[A-Z]\w*)?/, groups: ['punctuation', 'tag'], push: 'tag', after: (p) => !p || p.type === 'operator' || p.type === 'keyword' || (p.type === 'punctuation' && /[([{,:]$/.test(p.text)) },
      { match: /(\.)([A-Za-z_$][\w$-]*[?!]?)(?=\s*\()/, groups: ['punctuation', 'function'] },
      { match: /(\.)([A-Za-z_$][\w$-]*[?!]?)/, groups: ['punctuation', 'property'] },
      { match: /@[\w$-]+/, token: 'variable' },
      { match: /[A-Za-z_$][\w$-]*[?!]?(?=\()/, token: (t) => name(t) ?? 'function' },
      { match: /[A-Za-z_$][\w$]*(?:-[A-Za-z_$][\w$]*)*[?!]?/, token: name },
      { match: /0[xX][\da-fA-F]+|(?:\d[\d_]*(?:\.(?!\.)\d*)?|\.\d+)(?:[eE][+-]?\d+)?(?:px|em|rem|%|s|ms)?/, token: 'number' },
      { match: /\.\.\.?|=>|->|\?\?=?|\?\.|\*\*=?|&&=?|\|\|=?|===?|!==?|<<=?|>>>?=?|\+\+|--|[-+*/%&|^~<>!?=]=?/, token: 'operator' },
      { match: /[()[\]{},;:.]/, token: 'punctuation' },
    ],
    tag: [
      { match: /\/?>/, token: 'punctuation', pop: true },
      { match: /\s+/ },
      { match: /[.#][\w-]+/, token: 'function' }, // .class, #id
      { match: /(@[\w-]+)((?:\.[\w-]+)*)(=)/, groups: ['keyword', 'meta', 'operator'], push: 'attribute' }, // @click.prevent=save
      { match: /(@[\w-]+)((?:\.[\w-]+)*)/, groups: ['keyword', 'meta'] },
      { match: /([\w:-]+)(\s*)(=)/, groups: ['property', undefined, 'operator'], push: 'attribute' },
      { match: /[\w-]+/, token: 'property' },
      { match: /=/, token: 'operator', push: 'attribute' }, // .active=(cond)
      { match: /\{/, token: 'punctuation', push: 'braces' },
      { match: /\[/, token: 'punctuation', push: 'brackets' },
    ],
    // An attribute's value: an expression, to a space or the tag's end.
    attribute: [
      { match: /(?=\s|\/?>)/, pop: true },
      { match: /\(/, token: 'punctuation', push: 'parens' },
      { include: 'root' },
    ],
    parens: [
      { match: /\)/, token: 'punctuation', pop: true },
      { match: /\(/, token: 'punctuation', push: 'parens' },
      { include: 'root' },
    ],
    css: [
      { match: /$/, pop: true },
      { match: /\s+/ },
      { match: /[.#&][\w-]+|@[\w-]+/, token: 'function' },
      { match: /([\w-]+)(:)/, groups: ['property', 'punctuation'] },
      { match: /[\d.]+(?:px|em|rem|%|s|ms|vh|vw)?/, token: 'number' },
      { match: /[^\s:]+/ },
    ],
    double: [
      { match: /"/, token: 'string', pop: true },
      { match: /\\./, token: 'escape' },
      { match: /\{/, token: 'escape', push: 'interpolation' },
      { match: /[^"\\{]+/, token: 'string' },
    ],
    single: [
      { match: /'/, token: 'string', pop: true },
      { match: /\\./, token: 'escape' },
      { match: /[^'\\]+/, token: 'string' },
    ],
    template: [
      { match: /`/, token: 'string', pop: true },
      { match: /\\./, token: 'escape' },
      { match: /\{/, token: 'escape', push: 'interpolation' },
      { match: /[^`\\{]+/, token: 'string' },
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
    brackets: [
      { match: /\]/, token: 'punctuation', pop: true },
      { include: 'root' },
    ],
    blockComment: [
      { match: /###/, token: 'comment', pop: true },
      { match: /[^#]+|#/, token: 'comment' },
    ],
  },
}
