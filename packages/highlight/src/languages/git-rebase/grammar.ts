import type { Grammar } from '../../engine/grammar.js'
import { words } from '../../language.js'

const COMMANDS = words('pick p reword r edit e squash s fixup f exec x break b drop d label l reset t merge m update-ref u')

// git rebase -i's todo list: a command, a commit and its subject per line.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /#.*/, token: 'comment' },
      { match: /(exec|x)(\s+)(.*)/, groups: ['keyword', undefined, 'string'], after: (p) => p === undefined },
      { match: /(fixup|f)(\s+)(-[cC])(?=\s)/, groups: ['keyword', undefined, 'constant'], after: (p) => p === undefined },
      { match: /[a-z-]+/, token: (t) => (COMMANDS.has(t) ? 'keyword' : undefined), after: (p) => p === undefined },
      { match: /(merge|m)(\s+)(-[cC])(\s+)([\da-f]{4,40})/, groups: ['keyword', undefined, 'constant', undefined, 'number'], after: (p) => p === undefined },
      { match: /[\da-f]{4,40}(?=\s|$)/, token: 'number', after: (p) => p?.type === 'keyword' || p?.type === 'constant' },
      { match: /.+/, token: 'string' }, // the subject, or a label
    ],
  },
}
