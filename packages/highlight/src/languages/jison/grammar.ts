import type { Grammar } from '../../engine/grammar.js'

// Jison: Bison-style grammars for JavaScript parsers. A %lex section of
// patterns and actions, %declarations, %% and rules with { JavaScript }.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'comment' },
      { match: /%lex\b/, token: 'keyword', push: 'lex' },
      { match: /%%/, token: 'meta' },
      { match: /%[a-z_-]+/, token: 'keyword' }, // %left, %start, %token
      { match: /%\{/, token: 'meta', push: 'prologue' },
      { match: /([A-Za-z_][\w]*)(\s*)(:)/, groups: ['function', undefined, 'operator'] }, // expr :
      { match: /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/, token: 'string' },
      { match: /\{/, token: 'punctuation', push: 'action' },
      { match: /^[a-z_]\w*(?=\s*$)/, token: 'function' }, // a rule's name, on its own line
      { match: /[A-Z][A-Z\d_]*/, token: 'constant' }, // a token: NUMBER
      { match: /[a-z_][\w]*/ },
      { match: /[|;:]/, token: 'operator' },
      { match: /\[[a-z_]\w*\]/, token: 'variable' }, // a named value: expr[left]
    ],
    // The lexer: a pattern, then its action.
    lex: [
      { match: /^\s*\/lex\b/, token: 'keyword', pop: true },
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'comment' },
      { match: /%%/, token: 'meta' },
      { match: /%[a-z_-]+/, token: 'keyword' },
      { match: /\{/, token: 'punctuation', push: 'action' },
      { match: /<[\w,*]+>/, token: 'meta' }, // <INITIAL>
      { match: /return\b/, token: 'keyword' },
      { match: /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/, token: 'string' },
      { match: /\S+/, token: 'regexp' }, // a pattern
    ],
    // { JavaScript }, to the } that closes it.
    action: [
      { match: /\}/, token: 'punctuation', pop: true },
      { match: /\$\$|\$\d+|@\d+|\$[a-z_]\w*|yytext|yylloc|yy\b/, token: 'variable' },
      { match: /(?=[^}])/, push: '@action' },
    ],
    prologue: [
      { match: /%\}/, token: 'meta', pop: true },
      { match: /(?=[\s\S])/, push: '@prologue' },
    ],
    comment: [
      { match: /\*\//, token: 'comment', pop: true },
      { match: /[^*]+|\*/, token: 'comment' },
    ],
  },
  embeds: {
    // To the first } with no { before it on the line, or the line's end.
    action: {
      language: 'javascript',
      end: (line, from) => {
        let depth = 0
        for (let i = from; i < line.length; i++) {
          const c = line[i]
          if (c === '{') depth++
          else if (c === '}' && depth-- === 0) return i
          else if (c === '$' && depth === 0) return i
        }
        return -1
      },
    },
    prologue: { language: 'javascript', end: /%\}/ },
  },
}
