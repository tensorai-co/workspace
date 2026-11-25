import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  ado as case class data derive do else forall foreign hiding if import in infix infixl infixr instance
  let module newtype of then type where role nominal representational phantom
`)
const BUILTINS = words(`
  log logShow show map filter foldl foldr sum length identity const flip not pure bind discard
  traverse traverse_ for_ when unless div mod otherwise unsafePartial liftEffect
`)

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (BUILTINS.has(text)) return 'builtin'
  return undefined
}

// PureScript: Haskell-like, strict, with row types, records, ado and """raw strings""".
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\{-#/, token: 'meta', push: 'pragma' },
      { match: /\{-/, token: 'comment', push: 'blockComment' },
      { match: /--+(?![!#$%&*+./<=>?@\\^|~:]).*/, token: 'comment' },
      { match: /"""/, token: 'string', push: 'longString' },
      { match: /"/, token: 'string', push: 'string' },
      { match: /'(?:[^'\\\n]|\\(?:x[\da-fA-F]+|o[0-7]+|\d+|\^.|[A-Z]{2,3}|.))'/, token: 'string' },
      // A type signature's name: map :: (a -> b) -> [a] -> [b]
      { match: /[a-z_][\w']*(?=\s*::)/, token: 'function', after: (p) => p === undefined },
      { match: /(import)(\s+)(?:(qualified)(\s+))?([A-Z][\w.]*)/, groups: ['keyword', undefined, 'keyword', undefined, 'type'] },
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
      { match: /[^"]+|"/, token: 'string' },
    ],
    pragma: [
      { match: /#-\}/, token: 'meta', pop: true },
      { match: /[^#]+|#/, token: 'meta' },
    ],
    blockComment: [
      { match: /\{-/, token: 'comment', push: 'blockComment' }, // they nest
      { match: /-\}/, token: 'comment', pop: true },
      { match: /[^{-]+|[{-]/, token: 'comment' },
    ],
  },
}
