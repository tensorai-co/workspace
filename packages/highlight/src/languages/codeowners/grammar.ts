import type { Grammar } from '../../engine/grammar.js'

// CODEOWNERS: a path pattern, then its owners (@user, @org/team or an
// email). GitLab's [Sections] and ^[optional sections] too.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /#.*/, token: 'comment' },
      { match: /(\^?)(\[)([^\]\n]+)(\])(\[\d+\])?/, groups: ['operator', 'punctuation', 'type', 'punctuation', 'number'], after: (p) => p === undefined },
      { match: /(?:\\.|[^\s#])+/, token: 'string', after: (p) => p === undefined }, // the pattern
      { match: /@[\w./-]+/, token: 'variable' }, // @user, @org/team
      { match: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/, token: 'variable' }, // an email
      { match: /\S+/ },
    ],
  },
}
