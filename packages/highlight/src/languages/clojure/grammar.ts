import type { Grammar } from '../../engine/grammar.js'
import type { Token, TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const SPECIAL = words(`
  def defn defn- defmacro defmulti defmethod defprotocol defrecord deftype defonce fn fn* let let*
  letfn if if-not if-let if-some when when-not when-let when-some when-first cond condp case do
  loop recur quote var throw try catch finally ns require import use new set! binding doseq dotimes
  for while and or not -> ->> as-> some-> some->> cond-> cond->> doto declare
`)
const BUILTINS = words(`
  map filter reduce remove first rest next cons conj assoc assoc-in dissoc get get-in update
  update-in merge keys vals count seq vec vector list hash-map hash-set set str println print prn
  apply partial comp identity into range take drop sort sort-by group-by frequencies inc dec
  nil? some? empty? not-empty contains? every? some atom swap! reset! deref slurp spit format
`)

/** The head of a list: a call's name. */
const head = (p: Token | undefined) => p?.text.endsWith('(') ?? false

function call(text: string): TokenType {
  if (SPECIAL.has(text)) return 'keyword'
  if (BUILTINS.has(text)) return 'builtin'
  return 'function'
}

const SYMBOL = /(?:[A-Za-z*+!?<>=_$%&|.]|-(?!\d))[\w*+!?<>=_$%&|.:'/#-]*/.source

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+|,/ },
      { match: /;.*/, token: 'comment' },
      { match: /#_/, token: 'comment' },
      { match: /#"/, token: 'regexp', push: 'regex' },
      { match: /"/, token: 'string', push: 'string' },
      { match: /\\(?:newline|space|tab|return|backspace|formfeed|u[\da-fA-F]{4}|o[0-7]{1,3}|.)/, token: 'string' }, // \a
      { match: /::?[\w*+!?<>=_$%&|.:/#-]+/, token: 'constant' }, // :keyword
      { match: /\^:?[\w.-]+/, token: 'meta' }, // ^:private
      { match: /#\{|#\(|#\?@?\(|[([{]/, token: 'punctuation' },
      { match: /[)\]}]/, token: 'punctuation' },
      { match: /(?:nil|true|false)(?![\w*+!?<>=_$%&|.:'/#-])/, token: 'constant' },
      { match: /[-+]?(?:0[xX][\da-fA-F]+|\d+\/\d+|\d+r[\da-zA-Z]+|\d+(?:\.\d+)?(?:[eE][-+]?\d+)?[NM]?)/, token: 'number' },
      { match: new RegExp(`(def[\\w-]*)(\\s+)(?:(\\^:?[\\w.-]+)(\\s+))?(${SYMBOL})`), groups: ['keyword', undefined, 'meta', undefined, 'function'], after: head },
      { match: new RegExp(SYMBOL), token: call, after: head },
      { match: /[A-Z][\w.]*(?=\.|\/|\s|\))/, token: 'type' }, // Java classes: String, java.util.Date
      { match: new RegExp(SYMBOL) },
      { match: /~@|[`'~@#]/, token: 'operator' },
    ],
    string: [
      { match: /[^"\\]+/, token: 'string' },
      { match: /\\./, token: 'escape' },
      { match: /"/, token: 'string', pop: true },
    ],
    regex: [
      { match: /[^"\\]+/, token: 'regexp' },
      { match: /\\./, token: 'regexp' },
      { match: /"/, token: 'regexp', pop: true },
    ],
  },
}
