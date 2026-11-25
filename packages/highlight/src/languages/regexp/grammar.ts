import type { Grammar } from '../../engine/grammar.js'

// A regular expression on its own, as in a ```regex fence: groups, classes,
// escapes, quantifiers and anchors.
const ESCAPE = /\\(?:[dDwWsSbBnrtfv0]|x[\da-fA-F]{2}|u\{?[\da-fA-F]{1,6}\}?|c[A-Za-z]|p\{[^}\n]*\}|P\{[^}\n]*\}|.)/

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\\[1-9]\d*|\\k<[^>\n]+>/, token: 'variable' }, // backreferences
      { match: ESCAPE, token: 'escape' },
      { match: /\(\?[imsxun-]+\)/, token: 'meta' }, // inline flags: (?i)
      { match: /(\(\?<?[=!])/, token: 'keyword', push: 'group' }, // lookarounds
      { match: /(\(\?)(<[A-Za-z_]\w*>|P<[A-Za-z_]\w*>|'[A-Za-z_]\w*')/, groups: ['punctuation', 'variable'], push: 'group' }, // named groups
      { match: /\(\?(?:[imsxu-]*:)?|\(/, token: 'punctuation', push: 'group' },
      { match: /\[\^?/, token: 'string', push: 'class' },
      { match: /[*+?](?:[?+])?|\{\d+(?:,\d*)?\}[?+]?/, token: 'operator' },
      { match: /[$^]|\\[bBAzZG]/, token: 'keyword' },
      { match: /\|/, token: 'operator' },
      { match: /\./, token: 'constant' },
      { match: /[^\\()[\]{}*+?|^$.]+|[\]{}]/ },
    ],
    group: [
      { match: /\)/, token: 'punctuation', pop: true },
      { include: 'root' },
    ],
    // [a-z0-9_]: a character class.
    class: [
      { match: /\]/, token: 'string', pop: true },
      { match: ESCAPE, token: 'escape' },
      { match: /\[:[a-z]+:\]/, token: 'builtin' }, // [:alpha:]
      { match: /(?<=[^\\[])-(?=[^\]])/, token: 'operator' },
      { match: /[^\]\\-]+|-/, token: 'string' },
    ],
  },
}
