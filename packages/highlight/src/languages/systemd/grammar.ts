import type { Grammar } from '../../engine/grammar.js'

// systemd units: [Sections], Key=value, comments, and %specifiers and $VARIABLES in values.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /[;#].*/, token: 'comment', after: (p) => p === undefined },
      { match: /\[[^\]\n]*\]/, token: 'type', after: (p) => p === undefined },
      { match: /[^\s=:;#[][^=:\n]*?(?=\s*[=:])/, token: 'property', after: (p) => p === undefined },
      { match: /[=:]/, token: 'operator', push: 'value' },
    ],
    // The value, to the end of the line.
    value: [
      { match: /[ \t]+/ },
      { match: /(?<=\s)[;#].*/, token: 'comment' },
      { match: /"(?:[^"\\\n]|\\.)*"?|'[^'\n]*'?/, token: 'string' },
      { match: /(?:true|false|yes|no|on|off)(?=\s*$)/i, token: 'constant' },
      { match: /\\$/, token: 'escape' }, // continues on the next line
      { match: /[-+]?\d+(?:\.\d+)?(?=\s*(?:[;#]|$))/, token: 'number' },
      { match: /\$\{[^}\n]*\}|\$[A-Za-z_]\w*|%[a-zA-Z%]/, token: 'variable' }, // ${X}, $X, %i, %h
      { match: /[^\s"';#$%]+|[$%]/, token: 'string' },
      { match: (line, pos) => (pos === line.length && !line.endsWith('\\') ? 0 : -1), pop: true },
    ],
  },
}
