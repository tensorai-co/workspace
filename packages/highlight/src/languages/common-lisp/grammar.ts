import type { Grammar } from '../../engine/grammar.js'
import type { Token, TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const SPECIAL = words(`
  defun defmacro defvar defparameter defconstant defclass defmethod defgeneric defstruct defpackage
  in-package lambda let let* flet labels macrolet if when unless cond case ecase typecase etypecase
  progn prog1 block return return-from loop do dolist dotimes tagbody go catch throw unwind-protect
  handler-case handler-bind restart-case ignore-errors multiple-value-bind destructuring-bind setf
  setq incf decf push pop and or not declare the function quote eval-when locally symbol-macrolet
  with-open-file with-slots
`)
const BUILTINS = words(`
  car cdr cons list append reverse length mapcar mapc reduce remove remove-if find find-if position
  member assoc gethash make-hash-table format print princ prin1 terpri write-line read read-line
  funcall apply values vector aref elt nth first second rest last subseq concatenate sort string=
  equal eq eql null listp numberp stringp make-instance slot-value error signal warn 1+ 1- min max
  abs mod
`)
const CONSTANTS = words('t nil')

/** The head of a list: a call's name. */
const head = (p: Token | undefined) => !!p && p.type === 'punctuation' && p.text.endsWith('(')

function call(text: string): TokenType {
  if (SPECIAL.has(text)) return 'keyword'
  if (BUILTINS.has(text)) return 'builtin'
  if (CONSTANTS.has(text)) return 'constant'
  return 'function'
}

const SYMBOL = /[^\s()[\]{}\"';`,#|][^\s()[\]{}\"';`,]*/.source

// Common Lisp: s-expressions, :keywords, #\characters, #| block comments |# and defun, defmacro, defclass.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /;.*/, token: 'comment' },
      { match: /#\|/, token: 'comment', push: 'blockComment' },
      { match: /#;/, token: 'comment' }, // #; comments out the next form
      { match: /"/, token: 'string', push: 'string' },
      { match: /#\\(?:[A-Za-z]{2,}(?![\w-])|.)/, token: 'string' }, // a character
      { match: /#?::?[^\s()[\]{}\"';`,]+/, token: 'constant' }, // :keyword
      { match: new RegExp(`(\\()(\\s*)(def[\\w*-]*|def)(\\s+)(\\()(${SYMBOL})`), groups: ['punctuation', undefined, 'keyword', undefined, 'punctuation', 'function'], push: 'params' },
      { match: new RegExp(`(\\()(\\s*)(defun|defmacro|defmethod|defgeneric|defsubst|cl-defun|defn|defn/a|fn|macro)(\\s+)(${SYMBOL})(\\s*)([[(])`), groups: ['punctuation', undefined, 'keyword', undefined, 'function', undefined, 'punctuation'], push: 'params' },
      { match: new RegExp(`(\\()(\\s*)(def[\\w*-]*|def)(\\s+)(\\(?)(${SYMBOL})`), groups: ['punctuation', undefined, 'keyword', undefined, 'punctuation', 'function'] },
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
