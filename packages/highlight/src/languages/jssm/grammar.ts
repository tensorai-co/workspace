import type { Grammar } from '../../engine/grammar.js'

// JSSM's finite state machine language (FSL): states joined by arrows
// (->, =>, ~>), 'actions', probabilities, [groups] and machine settings.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'comment' },
      { match: /([a-z_]+)(\s*)(:)/, groups: ['property', undefined, 'punctuation'] }, // machine_name:, flow:
      { match: /(state)(\s+)([\w]+)(\s*)(:)/, groups: ['keyword', undefined, 'type', undefined, 'punctuation'] },
      { match: /&[\w]+/, token: 'variable' }, // &named_list
      { match: /'(?:[^'\\]|\\.)*'/, token: 'function' }, // an action
      { match: /"(?:[^"\\]|\\.)*"/, token: 'string' },
      { match: /\d+(?:\.\d+)?%/, token: 'number' }, // a probability
      { match: /<?(?:-|=|~)>|<(?:-|=|~)|<->|<=>|<~>|<-=>|<=->|<-~>|<~->|<=~>|<~=>|[←→↔⇐⇒⇔↚↛↮]/, token: 'operator' },
      { match: /#[\da-fA-F]{3,8}\b/, token: 'constant' },
      { match: /\d+(?:\.\d+)?/, token: 'number' },
      { match: /[A-Za-z_][\w]*/, token: 'type' }, // a state
      { match: /[[\]{};,]/, token: 'punctuation' },
    ],
    comment: [
      { match: /\*\//, token: 'comment', pop: true },
      { match: /[^*]+|\*/, token: 'comment' },
    ],
  },
}
