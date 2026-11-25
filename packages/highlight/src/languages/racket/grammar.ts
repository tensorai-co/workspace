import type { Grammar } from '../../engine/grammar.js'
import type { Token, TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const SPECIAL = words(`
  define define-values define-syntax define-syntax-rule define-struct struct lambda λ case-lambda
  let let* letrec let-values let*-values if when unless cond case else do begin begin0 set! quote
  quasiquote unquote and or not match match-define match-lambda for for/list for/vector for/hash
  for/fold for/sum for*/list parameterize with-handlers module module+ require provide
  all-defined-out only-in prefix-in contract-out syntax-parse syntax-case with-syntax class new send
  define/contract
`)
const BUILTINS = words(`
  car cdr cons list append reverse length map filter foldl foldr apply first rest second empty?
  null? list? pair? equal? eq? eqv? display displayln printf format string-append number->string
  string->number vector vector-ref hash hash-ref hash-set! add1 sub1 range build-list error raise
`)
const CONSTANTS = words('#t #f #true #false null empty')

/** The head of a list: a call's name. */
const head = (p: Token | undefined) => !!p && p.type === 'punctuation' && p.text.endsWith('(')

function call(text: string): TokenType {
  if (SPECIAL.has(text)) return 'keyword'
  if (BUILTINS.has(text)) return 'builtin'
  if (CONSTANTS.has(text)) return 'constant'
  return 'function'
}

const SYMBOL = /#[tf](?:rue|alse)?(?![^\s()[\]{}\"';`,])|[^\s()[\]{}\"';`,#|][^\s()[\]{}\"';`,]*/.source

// Racket: a Scheme with #lang lines, [brackets], #:keywords and define, struct and match.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /;.*/, token: 'comment' },
      { match: /#\|/, token: 'comment', push: 'blockComment' },
      { match: /#;/, token: 'comment' }, // #; comments out the next form
      { match: /#lang\s+\S+/, token: 'meta' },
      { match: /#:[^\s()[\]{}\"';`,]+/, token: 'constant' }, // #:keyword
      { match: /"/, token: 'string', push: 'string' },
      { match: /#\\(?:[A-Za-z]{2,}(?![\w-])|.)/, token: 'string' }, // a character
      { match: new RegExp(`(\\()(\\s*)(def[\\w*-]*|define-values|define-syntax|struct)(\\s+)(\\()(${SYMBOL})`), groups: ['punctuation', undefined, 'keyword', undefined, 'punctuation', 'function'], push: 'params' },
      { match: new RegExp(`(\\()(\\s*)(defun|defmacro|defmethod|defgeneric|defsubst|cl-defun|defn|defn/a|fn|macro)(\\s+)(${SYMBOL})(\\s*)([[(])`), groups: ['punctuation', undefined, 'keyword', undefined, 'function', undefined, 'punctuation'], push: 'params' },
      { match: new RegExp(`(\\()(\\s*)(def[\\w*-]*|define-values|define-syntax|struct)(\\s+)(\\(?)(${SYMBOL})`), groups: ['punctuation', undefined, 'keyword', undefined, 'punctuation', 'function'] },
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
