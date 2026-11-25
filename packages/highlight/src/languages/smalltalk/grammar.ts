import type { Grammar } from '../../engine/grammar.js'
import { words } from '../../language.js'

const VARIABLES = words('self super thisContext')
const CONSTANTS = words('true false nil')

// Smalltalk: "comments", 'strings', #symbols, $characters, unary, binary and
// keyword: messages, [:blocks | ], ^returns and := assignment.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /"/, token: 'comment', push: 'comment' },
      { match: /'/, token: 'string', push: 'string' },
      { match: /\$./, token: 'string' }, // $a: a character
      { match: /#(?:[A-Za-z_]\w*:)+|#[A-Za-z_]\w*|#[-+*/\\~<>=@%|&?!,]+/, token: 'constant' }, // #symbol, #at:put:
      { match: /#\(|#\[|\{|\}/, token: 'punctuation' },
      { match: /:[A-Za-z_]\w*/, token: 'variable' }, // a block's parameter: [:each | …]
      { match: /[A-Za-z_]\w*:(?!=)/, token: 'function' }, // a keyword message part: at:put:
      { match: /[A-Z]\w*/, token: 'type' }, // a class: OrderedCollection
      { match: /[a-z_]\w*/, token: (t) => (VARIABLES.has(t) ? 'variable' : CONSTANTS.has(t) ? 'constant' : undefined) },
      { match: /-?\d+r[\dA-Z]+|-?\d+(?:\.\d+)?(?:[edq]-?\d+)?s?\d*/, token: 'number' },
      { match: /:=|\^|[-+*/\\~<>=@%|&?!,]+/, token: 'operator' },
      { match: /[()[\].;]/, token: 'punctuation' },
    ],
    comment: [
      { match: /"/, token: 'comment', pop: true },
      { match: /[^"]+/, token: 'comment' },
    ],
    string: [
      { match: /''/, token: 'escape' },
      { match: /'/, token: 'string', pop: true },
      { match: /[^']+/, token: 'string' },
    ],
  },
}
