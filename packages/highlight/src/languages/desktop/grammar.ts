import type { Grammar } from '../../engine/grammar.js'

// Linux .desktop entries: [Desktop Entry], Key[locale]=value, # comments,
// ; separated lists and %f field codes in Exec.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /#.*/, token: 'comment', after: (p) => p === undefined },
      { match: /\[[^\]\n]*\]/, token: 'type', after: (p) => p === undefined },
      { match: /([A-Za-z\d-]+)(\[[^\]\n]*\])?(?=\s*=)/, groups: ['property', 'meta'], after: (p) => p === undefined }, // Name[de]
      { match: /=/, token: 'operator', push: 'value' },
    ],
    // The value, to the end of the line.
    value: [
      { match: /[ \t]+/ },
      { match: /(?:true|false)(?=\s*$)/, token: 'constant' },
      { match: /[-+]?\d+(?:\.\d+)?(?=\s*$)/, token: 'number' },
      { match: /%[fFuUdDnNickvm%]/, token: 'variable' }, // Exec's field codes: %U
      { match: /\\[sntr\\;]/, token: 'escape' },
      { match: /;/, token: 'punctuation' }, // a list's separator
      { match: /[^\s%;\\]+|[%\\]/, token: 'string' },
      { match: /$/, pop: true },
    ],
  },
}
