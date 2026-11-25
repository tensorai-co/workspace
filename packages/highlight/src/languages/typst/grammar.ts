import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words('let set show if else for in while break continue return import include context as and or not none auto')

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (text === 'true' || text === 'false' || text === 'none' || text === 'auto') return 'constant'
  return undefined
}

// Typst: markup with headings, *strong* and _emphasis_, $math$, and #code.
export const grammar: Grammar = {
  states: {
    // Markup.
    root: [
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /\s*=+\s.*/, token: 'property', after: (p) => p === undefined }, // = Heading
      { match: /\s*(?:[-+]|\d+\.)(?=\s)/, token: 'variable', after: (p) => p === undefined }, // lists
      { match: /(\s*\/\s)([^:\n]*)(:)/, groups: ['variable', 'property', 'punctuation'], after: (p) => p === undefined }, // / Term: description
      { match: /```\w*/, token: 'meta', push: 'raw' },
      { match: /`[^`\n]*`/, token: 'string' },
      { match: /\$/, token: 'string', push: 'math' },
      { match: /\*[^*\n]+\*/, token: 'keyword' }, // *strong*
      { match: /_[^_\n]+_/, token: 'variable' }, // _emphasis_
      { match: /<[\w:.-]+>/, token: 'meta' }, // <label>
      { match: /@[\w:.-]*[\w-]/, token: 'meta' }, // @reference
      { match: /\\./, token: 'escape' },
      { match: /https?:\/\/[^\s)\]]*[^\s)\].,;:]/, token: 'regexp' },
      // #code: a keyword, a call, or a name.
      { match: /(#)(let|set|show|if|for|while|import|include|return)\b/, groups: ['operator', 'keyword'], push: 'code' },
      { match: /#(?=[A-Za-z_(])/, token: 'operator', push: 'expression' },
      { match: /\]/, token: 'punctuation' },
      { match: /[^/\\$*_<@`#\]h]+|[/\\$*_<@`#h]/ },
    ],
    // #let x = … and kin: code to the end of the line.
    code: [
      { match: /$/, pop: true },
      { match: /\(/, token: 'punctuation', push: 'parens' },
      { match: /\[/, token: 'punctuation', push: 'content' },
      { include: 'code-tokens' },
    ],
    // #name(…)[…]: one expression.
    expression: [
      { match: /[A-Za-z_][\w-]*(?=[([])/, token: (t) => name(t) ?? 'function' },
      { match: /[A-Za-z_][\w-]*/, token: (t) => name(t) ?? 'variable', pop: true },
      { match: /\(/, token: 'punctuation', push: 'parens' },
      { match: /\[/, token: 'punctuation', push: 'content' },
      { match: /\.(?=[A-Za-z_])/, token: 'punctuation' },
      { match: /(?=.)|$/, pop: true },
    ],
    parens: [
      { match: /\)/, token: 'punctuation', pop: true },
      { match: /\(/, token: 'punctuation', push: 'parens' },
      { match: /\[/, token: 'punctuation', push: 'content' },
      { include: 'code-tokens' },
    ],
    // […]: markup inside code.
    content: [
      { match: /\]/, token: 'punctuation', pop: true },
      { match: /\[/, token: 'punctuation', push: 'content' },
      { include: 'root' },
    ],
    'code-tokens': [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /"(?:[^"\\\n]|\\.)*"?/, token: 'string' },
      { match: /[A-Za-z_][\w-]*(?=\s*[:]\s)/, token: 'property' }, // named argument: size: 12pt
      { match: /[A-Za-z_][\w-]*(?=\()/, token: (t) => name(t) ?? 'function' },
      { match: /(\.)([A-Za-z_][\w-]*)/, groups: ['punctuation', 'property'] },
      { match: /[A-Za-z_][\w-]*/, token: name },
      { match: /\d+(?:\.\d+)?(?:pt|mm|cm|in|em|fr|%|deg|rad)?/, token: 'number' },
      { match: /=>|==|!=|<=|>=|\+=|-=|[-+*/=<>]/, token: 'operator' },
      { match: /[{},:;]/, token: 'punctuation' },
    ],
    math: [
      { match: /\$/, token: 'string', pop: true },
      { match: /\\./, token: 'escape' },
      { match: /[A-Za-z]{2,}(?=\()/, token: 'function' },
      { match: /[_^&/]/, token: 'operator' },
      { match: /\d+(?:\.\d+)?/, token: 'number' },
      { match: /[^$\\_^&/\d]+/, token: 'string' },
    ],
    raw: [
      { match: /```/, token: 'meta', pop: true },
      { match: /[^`]+|`/, token: 'string' },
    ],
    blockComment: [
      { match: /[^*]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /\*/, token: 'comment' },
    ],
  },
}
