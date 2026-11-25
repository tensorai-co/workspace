import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

// VHDL. Its words are any case.
const KEYWORDS = words(`
  abs access after alias all and architecture array assert attribute begin block body buffer bus
  case component configuration constant disconnect downto else elsif end entity exit file for
  function generate generic group guarded if impure in inertial inout is label library linkage
  literal loop map mod nand new next nor not null of on open or others out package port postponed
  procedure process pure range record register reject rem report return rol ror select severity
  signal shared sla sll sra srl subtype then to transport type unaffected units until use variable
  wait when while with xnor xor context force release
`)
const TYPES = words(`
  std_logic std_logic_vector std_ulogic std_ulogic_vector unsigned signed integer natural positive
  boolean bit bit_vector character string real time
`)
const BUILTINS = words('rising_edge falling_edge to_integer to_unsigned to_signed resize shift_left shift_right std_match')

function name(text: string): TokenType | undefined {
  const lower = text.toLowerCase()
  if (lower === 'true' || lower === 'false') return 'constant'
  if (KEYWORDS.has(lower)) return 'keyword'
  if (TYPES.has(lower)) return 'builtin'
  return undefined
}

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /--.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /'[01UXZWLH-]'/, token: 'number' }, // '1'
      { match: /[bBoOxX]?"[\da-fA-F_UXZWLH-]*"/, token: 'number' }, // "1010", x"FF"
      { match: /"(?:[^"\n]|"")*"?/, token: 'string' },
      { match: /'[A-Za-z_]\w*/, token: 'meta' }, // an attribute: 'event, 'range
      { match: /(entity|architecture|package|component|configuration)(\s+)([A-Za-z_]\w*)/i, groups: ['keyword', undefined, 'type'] },
      { match: /(function|procedure)(\s+)([A-Za-z_]\w*)/i, groups: ['keyword', undefined, 'function'] },
      // a label: counter : process
      { match: /([A-Za-z_]\w*)(\s*)(:)(?=\s*(?:postponed\s+)?(?:process|block|for|if|case|while|loop|generate|entity|component|assert)\b)/i, groups: ['property', undefined, 'punctuation'] },
      { match: /[A-Za-z_]\w*(?=\s*\()/, token: (t) => name(t) ?? (BUILTINS.has(t.toLowerCase()) ? 'builtin' : 'function') },
      { match: /[A-Za-z_][\w.]*/, token: name },
      { match: /\d+#[\da-fA-F_]+#|\d[\d_]*(?:\.\d+)?(?:[eE][-+]?\d+)?(?:\s*(?:ns|us|ms|ps|fs|sec))?/, token: 'number' },
      { match: /<=|>=|:=|=>|\/=|\*\*|[-+*/&=<>|]/, token: 'operator' },
      { match: /[()[\]{},;.:]/, token: 'punctuation' },
    ],
    blockComment: [
      { match: /[^*]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /\*/, token: 'comment' },
    ],
  },
}
