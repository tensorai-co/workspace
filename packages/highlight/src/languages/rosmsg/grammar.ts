import type { Grammar } from '../../engine/grammar.js'
// ROS interface files (.msg, .srv, .action): a type and a name per line,
// constants with =, defaults, arrays and --- between request and response.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /#.*/, token: 'comment' },
      { match: /^---\s*$/, token: 'punctuation' },
      { match: /(?:bool|byte|char|u?int(?:8|16|32|64)|float(?:32|64)|w?string|time|duration)(?=[\s[<])/, token: 'builtin', after: (p) => p === undefined },
      { match: /(\[\d*\]|\[<=\d+\])?(<=\d+)?(?=\s)/, groups: ['punctuation', 'operator'], after: (p) => p?.type === 'builtin' },
      { match: /([\w/]+)(\[\d*\]|\[<=\d+\])?(<=\d+)?(?=\s)/, groups: ['type', 'punctuation', 'operator'], after: (p) => p === undefined },
      { match: /[A-Z][A-Z\d_]*(?=\s*=)/, token: 'constant' }, // a constant: MAX_SPEED=10
      { match: /[a-z_]\w*/, token: 'property' }, // a field name
      { match: /=/, token: 'operator', push: 'value' },
      { match: /-?\d+(?:\.\d+)?|\[[^\]\n]*\]|"[^"\n]*"|'[^'\n]*'|true|false/, token: 'number' }, // a default
    ],
    value: [
      { match: /$/, pop: true },
      { match: /\s+/ },
      { match: /#.*/, token: 'comment' },
      { match: /-?\d+(?:\.\d+)?(?:e-?\d+)?/, token: 'number' },
      { match: /"[^"\n]*"|'[^'\n]*'|[^\s#]+/, token: 'string' },
    ],
  },
}
