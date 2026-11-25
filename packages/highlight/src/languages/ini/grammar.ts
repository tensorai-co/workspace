import type { Grammar } from '../../engine/grammar.js'

// INI and its relatives (.cfg, .conf, .properties, .gitconfig, systemd units):
// [sections], key = value or key: value, and ; or # comments.
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
      { match: /[-+]?\d+(?:\.\d+)?(?=\s*(?:[;#]|$))/, token: 'number' },
      { match: /\$\{[^}\n]*\}|%\([\w.]+\)s|%[\w.]+%/, token: 'variable' }, // ${x}, %(x)s, %x%
      { match: /[^\s"';#$%]+|[$%]/, token: 'string' },
      { match: /$/, pop: true },
    ],
  },
}
