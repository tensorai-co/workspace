import type { Grammar } from '../../engine/grammar.js'

// .env files: KEY=value, with export, quotes and ${VAR} references.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /#.*/, token: 'comment' },
      { match: /export(?=\s)/, token: 'keyword', after: (p) => p === undefined },
      { match: /[A-Za-z_][\w.-]*(?=\s*=)/, token: 'property' },
      { match: /=/, token: 'operator', push: 'value' },
    ],
    value: [
      { match: /"/, token: 'string', push: 'double' },
      { match: /'[^']*'?/, token: 'string' },
      { match: /(?<=\s)#.*/, token: 'comment' },
      { match: /\$\{[^}\n]*\}|\$[A-Za-z_]\w*/, token: 'variable' },
      { match: /[^\s"'#$]+|[$#]/, token: 'string' },
      { match: /[ \t]+/ },
      { match: /$/, pop: true },
    ],
    // Double quotes can span lines, and expand variables and escapes.
    double: [
      { match: /[^"\\$]+/, token: 'string' },
      { match: /\\./, token: 'escape' },
      { match: /\$\{[^}\n]*\}|\$[A-Za-z_]\w*/, token: 'variable' },
      { match: /\$/, token: 'string' },
      { match: /"/, token: 'string', pop: true },
    ],
  },
}
