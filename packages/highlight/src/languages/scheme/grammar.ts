import type { Grammar } from '../../engine/grammar.js'
import type { Token, TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const SPECIAL = words(`
  define define-syntax define-record-type define-values lambda let let* letrec letrec* let-values
  let-syntax letrec-syntax if when unless cond case else do begin set! quote quasiquote unquote
  unquote-splicing and or not syntax-rules delay delay-force make-promise guard parameterize import
  export library include call/cc call-with-current-continuation dynamic-wind
`)
const BUILTINS = words(`
  car cdr cons list append reverse length map for-each filter reduce fold-left fold-right apply
  assoc assq member memq vector vector-ref vector-set! string-append number->string string->number
  display newline write error null? pair? list? equal? eq? eqv? zero? + - * / = < > <= >= abs min
  max
`)
const CONSTANTS = words('#t #f #true #false')

/** The head of a list: a call's name. */
const head = (p: Token | undefined) => !!p && p.type === 'punctuation' && p.text.endsWith('(')

function call(text: string): TokenType {
  if (SPECIAL.has(text)) return 'keyword'
  if (BUILTINS.has(text)) return 'builtin'
  if (CONSTANTS.has(text)) return 'constant'
  return 'function'
}

const SYMBOL = /#[tf](?:rue|alse)?(?![^\s()[\]{}\"';`,])|[^\s()[\]{}\"';`,#|][^\s()[\]{}\"';`,]*/.source

// Scheme: s-expressions with #t and #f, #\characters, define, let and named let.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /;.*/, token: 'comment' },
      { match: /#\|/, token: 'comment', push: 'blockComment' },
      { match: /#;/, token: 'comment' }, // #; comments out the next form
      { match: /"/, token: 'string', push: 'string' },
      { match: /#\\(?:[A-Za-z]{2,}(?![\w-])|.)/, token: 'string' }, // a character
      { match: new RegExp(`(\\()(\\s*)(def[\\w*-]*|define-syntax|define-record-type)(\\s+)(\\()(${SYMBOL})`), groups: ['punctuation', undefined, 'keyword', undefined, 'punctuation', 'function'], push: 'params' },
      { match: new RegExp(`(\\()(\\s*)(defun|defmacro|defmethod|defgeneric|defsubst|cl-defun|defn|defn/a|fn|macro)(\\s+)(${SYMBOL})(\\s*)([[(])`), groups: ['punctuation', undefined, 'keyword', undefined, 'function', undefined, 'punctuation'], push: 'params' },
      { match: new RegExp(`(\\()(\\s*)(def[\\w*-]*|define-syntax|define-record-type)(\\s+)(\\(?)(${SYMBOL})`), groups: ['punctuation', undefined, 'keyword', undefined, 'punctuation', 'function'] },
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
    blockComment: [
      { match: /#\|/, token: 'comment', push: 'blockComment' }, // they nest
      { match: /\|#/, token: 'comment', pop: true },
      { match: /[^#|]+|[#|]/, token: 'comment' },
    ],
  },
}
