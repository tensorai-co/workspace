import type { Grammar } from '../../engine/grammar.js'

// HXML: Haxe's build files, one compiler flag and its argument per line.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /#.*/, token: 'comment', after: (p) => p === undefined },
      { match: /(-D|--define)(\s+)([\w.-]+)(=?)(.*)/, groups: ['keyword', undefined, 'variable', 'operator', 'string'] },
      { match: /(-(?:m|main|-main))(\s+)([\w.]+)/, groups: ['keyword', undefined, 'type'] },
      { match: /--?[A-Za-z][\w-]*/, token: 'keyword', after: (p) => p === undefined },
      { match: /[A-Z][\w]*(?:\.[A-Z]\w*)*$/, token: 'type' },
      { match: /\S+/, token: 'string' },
    ],
  },
}
