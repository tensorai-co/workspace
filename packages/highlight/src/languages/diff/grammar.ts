import type { Grammar } from '../../engine/grammar.js'

// Unified diffs, as git prints them: headers, @@ ranges, and + and - lines.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /(?:diff|index|new file mode|deleted file mode|similarity index|rename from|rename to|old mode|new mode|Binary files)\b.*/, token: 'meta', after: (p) => p === undefined },
      { match: /(?:---|\+\+\+)(?: .*|$)/, token: 'keyword', after: (p) => p === undefined },
      { match: /(@@ [^@\n]* @@)(.*)/, groups: ['function', 'comment'], after: (p) => p === undefined },
      { match: /[+>].*/, token: 'inserted', after: (p) => p === undefined },
      { match: /[-<].*/, token: 'deleted', after: (p) => p === undefined },
      { match: /\\ No newline at end of file/, token: 'comment', after: (p) => p === undefined },
      { match: /\d+(?:,\d+)?[acd]\d+(?:,\d+)?$/, token: 'function', after: (p) => p === undefined }, // a normal diff's 2,3c2
      { match: /.+/ },
    ],
  },
}
