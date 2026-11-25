import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words('module exposing import as type alias port if then else case of let in effect where')
const BUILTINS = words('identity always never not xor modBy remainderBy toFloat round floor ceiling truncate abs max min compare negate sqrt')

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (BUILTINS.has(text)) return 'builtin'
  return undefined
}

// Elm: type signatures with a single colon, records, custom types and """multi-line strings""".
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\{-/, token: 'comment', push: 'blockComment' },
      { match: /--+(?![!#$%&*+./<=>?@\\^|~:]).*/, token: 'comment' },
      { match: /"""/, token: 'string', push: 'longString' },
      { match: /"/, token: 'string', push: 'string' },
      { match: /'(?:[^'\\\n]|\\(?:x[\da-fA-F]+|o[0-7]+|\d+|\^.|[A-Z]{2,3}|.))'/, token: 'string' },
      // A type signature's name: map :: (a -> b) -> [a] -> [b]
      { match: /[a-z_][\w']*(?=\s*:(?!:))/, token: 'function', after: (p) => p === undefined }, // a signature: view : Model -> Html Msg
      { match: /[a-z_][\w']*(?=(?:\s+[a-z_][\w']*)*\s*=(?!=))/, token: (t) => name(t) ?? 'function', after: (p) => p === undefined }, // a definition: view model =

      { match: /[A-Z][\w']*(?:\.[A-Z][\w']*)*/, token: 'type' }, // Maybe, Data.Map
      { match: /`[A-Za-z_][\w'.]*`/, token: 'operator' }, // `div`
      { match: /[a-z_][\w']*/, token: name },
      { match: /0[xX][\da-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][-+]?\d+)?/, token: 'number' },
      { match: /[!#$%&*+./<=>?@\\^|~:-]+/, token: 'operator' },
      { match: /[()[\],;{}]/, token: 'punctuation' },
    ],
    string: [
      { match: /[^"\\]+/, token: 'string' },
      { match: /\\(?:x[\da-fA-F]+|o[0-7]+|\d+|\^.|[A-Z]{2,3}|&|.?)/, token: 'escape' },
      { match: /"/, token: 'string', pop: true },
      { match: /$/, pop: true },
    ],
    longString: [
      { match: /"""/, token: 'string', pop: true },
      { match: /\\(?:u\{[\da-fA-F]+\}|.)/, token: 'escape' },
      { match: /[^"\\]+|"/, token: 'string' },
    ],
    blockComment: [
      { match: /\{-/, token: 'comment', push: 'blockComment' }, // they nest
      { match: /-\}/, token: 'comment', pop: true },
      { match: /[^{-]+|[{-]/, token: 'comment' },
    ],
  },
}
