import type { Grammar } from '../../engine/grammar.js'
import type { Token } from '../../tokens.js'

/** A node's name is the first thing on a line, or after { or ;. */
const nodeStarts = (p: Token | undefined) => !p || p.text === '{' || p.text === ';' || p.type === 'meta'

// KDL: nodes with arguments, name=value properties and { children },
// (type) annotations, /- to comment out a node, and nested /* comments */.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'comment' },
      { match: /\/-/, token: 'comment' }, // slashdash: the next node or value is ignored
      { match: /\([^)\n]*\)/, token: 'meta' }, // (u8)123, (date)"2026-01-01"
      { match: /#?r(#*)"/, token: 'string', push: (t) => `raw/${t.slice(t.indexOf('r') + 1, -1)}` },
      { match: /#+"/, token: 'string', push: (t) => `raw/${t.slice(0, -1)}` },
      { match: /"/, token: 'string', push: 'string' },
      { match: /#(?:true|false|null|inf|-inf|nan)\b|(?:true|false|null)(?![\w-])/, token: 'constant' },
      { match: /[-+]?(?:0x[\da-fA-F_]+|0o[0-7_]+|0b[01_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][-+]?\d+)?)(?![\w.])/, token: 'number' },
      { match: /([^\s()[\]{}/\\"#;=]+)(=)/, groups: ['property', 'operator'] },
      { match: /[^\s()[\]{}/\\"#;=]+/, token: 'tag', after: nodeStarts },
      { match: /[^\s()[\]{}/\\"#;=]+/, token: 'string' }, // a bare string argument
      { match: /[{};]/, token: 'punctuation' },
      { match: /\\/, token: 'operator' }, // a line continuation
    ],
    string: [
      { match: /"/, token: 'string', pop: true },
      { match: /\\(?:u\{[\da-fA-F]+\}|.)/, token: 'escape' },
      { match: /[^"\\]+/, token: 'string' },
    ],
    raw: [
      { match: (line, pos, hashes) => (line.startsWith(`"${hashes}`, pos) ? hashes.length + 1 : -1), token: 'string', pop: true },
      { match: /[^"]+|"/, token: 'string' },
    ],
    comment: [
      { match: /\/\*/, token: 'comment', push: 'comment' }, // they nest
      { match: /\*\//, token: 'comment', pop: true },
      { match: /[^/*]+|[/*]/, token: 'comment' },
    ],
  },
}
