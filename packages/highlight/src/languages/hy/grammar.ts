import type { Grammar } from '../../engine/grammar.js'
import type { Token, TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const SPECIAL = words(`
  defn defmacro defclass defn/a fn fn/a let setv setx if when unless cond do while for lfor dfor
  sfor gfor with with/a try except finally raise import require return yield await and or not in is
  quote quasiquote unquote global nonlocal assert del match case annotate
`)
const BUILTINS = words(`
  print len str int float list dict set tuple range map filter sorted sum min max abs open
  isinstance hasattr getattr setattr type zip enumerate any all
`)
const CONSTANTS = words('True False None')

/** The head of a list: a call's name. */
const head = (p: Token | undefined) => !!p && p.type === 'punctuation' && p.text.endsWith('(')

function call(text: string): TokenType {
  if (SPECIAL.has(text)) return 'keyword'
  if (BUILTINS.has(text)) return 'builtin'
  if (CONSTANTS.has(text)) return 'constant'
  return 'function'
}

const SYMBOL = /[^\s()[\]{}\"';`,#|][^\s()[\]{}\"';`,]*/.source

// Hy: a Lisp on Python: defn, defclass, import, :keywords and f-strings.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /;.*/, token: 'comment' },
      { match: /[fbr]+(?=\")/, token: 'string' }, // f\"…\", b\"…\"
      { match: /"/, token: 'string', push: 'string' },
      { match: /#?::?[^\s()[\]{}\"';`,]+/, token: 'constant' }, // :keyword
      { match: new RegExp(`(\\()(\\s*)(def[\\w*-]*|defn|defclass|defmacro|setv)(\\s+)(\\()(${SYMBOL})`), groups: ['punctuation', undefined, 'keyword', undefined, 'punctuation', 'function'], push: 'params' },
      { match: new RegExp(`(\\()(\\s*)(defun|defmacro|defmethod|defgeneric|defsubst|cl-defun|defn|defn/a|fn|macro)(\\s+)(${SYMBOL})(\\s*)([[(])`), groups: ['punctuation', undefined, 'keyword', undefined, 'function', undefined, 'punctuation'], push: 'params' },
      { match: new RegExp(`(\\()(\\s*)(def[\\w*-]*|defn|defclass|defmacro|setv)(\\s+)(\\(?)(${SYMBOL})`), groups: ['punctuation', undefined, 'keyword', undefined, 'punctuation', 'function'] },
      { match: /(\()(\s*)(lambda|λ|fn)(\s*)([[(])/, groups: ['punctuation', undefined, 'keyword', undefined, 'punctuation'], push: 'params' },
      { match: /#[a-zA-Z]?\(|#\[|#hash\(|#\{|[(\[{]/, token: 'punctuation' },
      { match: /[)\]}]/, token: 'punctuation' },
      { match: /[-+]?(?:#x[\da-fA-F]+|#b[01]+|0x[\da-fA-F]+|\d+\/\d+|\d+(?:\.\d+)?(?:[eE][-+]?\d+)?|\.\d+)(?![^\s()[\]{}\"';`,])/, token: 'number' },
      { match: new RegExp(SYMBOL), token: (t) => (CONSTANTS.has(t) ? 'constant' : undefined), after: (p) => !head(p) },
      { match: new RegExp(SYMBOL), token: call, after: head },
      { match: /,@|[`'~@#,]/, token: 'operator' },
    ],
    string: [
      { match: /[^"\\]+/, token: 'string' },
      { match: /\\./, token: 'escape' },
      { match: /"/, token: 'string', pop: true },
    ],
    // A parameter list: names, &optional and :keywords, and (name default) pairs.
    params: [
      { match: /\s+/ },
      { match: /[)\]]/, token: 'punctuation', pop: true },
      { match: /[([]/, token: 'punctuation', push: 'params' },
      { match: /&[\w-]+/, token: 'keyword' },
      { match: /#?:[^\s()[\]{}"';`,]+/, token: 'constant' },
      { match: /"/, token: 'string', push: 'string' },
      { match: /[-+]?\d+(?:[./]\d+)?/, token: 'number' },
      { match: /[^\s()[\]{}"';`,]+/ },
      { match: /./ },
    ],
  },
}
