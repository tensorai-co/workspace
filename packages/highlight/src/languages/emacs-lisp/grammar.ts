import type { Grammar } from '../../engine/grammar.js'
import type { Token, TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const SPECIAL = words(`
  defun defmacro defvar defcustom defconst defgroup defface defsubst define-minor-mode
  define-derived-mode lambda let let* if when unless cond pcase progn prog1 while dolist dotimes
  catch throw unwind-protect condition-case save-excursion save-restriction with-current-buffer
  with-temp-buffer interactive setq setq-local and or not quote function require provide autoload
  declare-function cl-defun cl-loop
`)
const BUILTINS = words(`
  car cdr cons list append reverse length mapcar mapc nth member assoc funcall apply message format
  concat substring string= equal eq insert buffer-string point goto-char forward-line current-buffer
  add-hook remove-hook global-set-key define-key kbd null listp stringp error user-error
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

// Emacs Lisp: s-expressions with ?characters, :keywords and the editor's own functions.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /;.*/, token: 'comment' },
      { match: /"/, token: 'string', push: 'string' },
      { match: /\?(?:\\[\w^]-?.|\\.|.)/, token: 'string' }, // a character
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
  },
}
