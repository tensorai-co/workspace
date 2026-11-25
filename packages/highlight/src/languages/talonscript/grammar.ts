import type { Grammar } from '../../engine/grammar.js'

// TalonScript: voice commands. A context header (app: terminal) above a -,
// then rules: what to say, a colon, and what to do.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /#.*/, token: 'comment' },
      { match: /^-$/, token: 'punctuation', next: 'body' },
      // app: terminal, os: mac, and not mode: sleep
      { match: /^((?:and\s+|not\s+|or\s+)*)(app|os|mode|tag|title|language|hostname|code\.language|(?:app|win|user|speech)\.[\w.]+)(:)(\s*)(.*)/, groups: ['keyword', 'property', 'punctuation', undefined, 'string'] },
      { match: /(?=.)/, next: 'body' },
    ],
    body: [
      { match: /\s+/ },
      { match: /#.*/, token: 'comment' },
      // tag(): user.tabs, settings():
      { match: /^(tag|settings)(\(\))(:)/, groups: ['keyword', 'punctuation', 'punctuation'] },
      // A rule: what's said, up to the colon that ends it.
      { match: /^(?=[^\s#])/, push: 'rule' },
      { include: 'actions' },
    ],
    rule: [
      { match: /:/, token: 'punctuation', pop: true },
      { match: /\s+/ },
      { match: /<[\w.]+>/, token: 'variable' }, // <user.text>
      { match: /\{[\w.]+\}/, token: 'variable' }, // {user.symbol}
      { match: /[[\]()|^$*+]/, token: 'operator' },
      { match: /[^\s:<{[\]()|^$*+]+/, token: 'string' },
    ],
    actions: [
      { match: /"/, token: 'string', push: 'double' },
      { match: /'/, token: 'string', push: 'single' },
      { match: /([\w.]+)(\s*)(=)(?!=)/, groups: ['variable', undefined, 'operator'] },
      { match: /(key|insert|sleep|repeat|auto_insert|mimic|skip)(?=\()/, token: 'builtin' },
      { match: /[A-Za-z_][\w.]*(?=\()/, token: 'function' }, // user.tab_next()
      { match: /(\()([\w-]+(?:\s+[\w-]+)*)(\))/, groups: ['punctuation', 'constant', 'punctuation'] }, // key(ctrl-s)
      { match: /<[\w.]+>|[A-Za-z_][\w.]*/, token: 'variable' },
      { match: /\d+(?:\.\d+)?(?:ms|s)?/, token: 'number' },
      { match: /[-+*/=]/, token: 'operator' },
      { match: /[(),:]/, token: 'punctuation' },
    ],
    double: [
      { match: /"/, token: 'string', pop: true },
      { match: /\{[\w.]+\}/, token: 'escape' },
      { match: /\\./, token: 'escape' },
      { match: /[^"{\\]+|\{/, token: 'string' },
    ],
    single: [
      { match: /'/, token: 'string', pop: true },
      { match: /\{[\w.]+\}/, token: 'escape' },
      { match: /\\./, token: 'escape' },
      { match: /[^'{\\]+|\{/, token: 'string' },
    ],
  },
}
