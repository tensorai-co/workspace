import type { Grammar } from '../../engine/grammar.js'

// justfiles: recipes, their parameters and dependencies, and recipe lines
// run by the shell, with {{ interpolation }}.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /#!.*/, token: 'meta', after: (p) => p === undefined },
      { match: /#.*/, token: 'comment', after: (p) => p === undefined },
      // A recipe's line: indented, run by the shell.
      { match: /[ \t]+(?=\S)/, push: 'body', after: (p) => p === undefined },
      { match: /\s+/ },
      { match: /\[[\w:,\s"'()-]*\]/, token: 'meta', after: (p) => p === undefined }, // [private], [group('ci')]
      { match: /(set|export|alias|import|mod)(?=\s)/, token: 'keyword', after: (p) => p === undefined },
      { match: /([A-Za-z_][\w-]*)(\s*)(:=)/, groups: ['variable', undefined, 'operator'], push: 'expression' },
      // A recipe: name params: deps
      { match: /@?[A-Za-z_][\w-]*(?=[^:\n]*:(?!=))/, token: 'function', push: 'header', after: (p) => p === undefined || p.text === 'export' },
      { include: 'expression' },
    ],
    header: [
      { match: /$/, pop: true },
      { match: /:/, token: 'operator' },
      { match: /([+*$]?)([A-Za-z_][\w-]*)(=)/, groups: ['operator', 'variable', 'operator'] },
      { match: /[+*$]?[A-Za-z_][\w-]*/, token: 'variable', after: (p) => p?.type !== 'operator' || p.text !== ':' },
      { include: 'expression' },
    ],
    expression: [
      { match: /$/, pop: true },
      { match: /\s+/ },
      { match: /#.*/, token: 'comment' },
      { match: /'''|"""/, token: 'string', push: 'triple' },
      { match: /'[^'\n]*'?|"(?:[^"\\\n]|\\.)*"?|`[^`\n]*`?/, token: 'string' },
      { match: /(?:if|else|true|false)(?![\w-])/, token: 'keyword' },
      { match: /[A-Za-z_][\w-]*(?=\()/, token: 'builtin' }, // env_var(), os(), join()
      { match: /==|!=|=~|:=|&&|\|\||[+/:=]/, token: 'operator' },
      { match: /[A-Za-z_][\w-]*/, token: (t) => (t === 'true' || t === 'false' ? 'constant' : undefined) },
      { match: /[()[\]{},]/, token: 'punctuation' },
    ],
    triple: [
      { match: /'''|"""/, token: 'string', pop: true },
      { match: /.+/, token: 'string' },
    ],
    // A recipe line: @ hides it, - ignores its errors; {{ }} interpolates.
    body: [
      { match: /$/, pop: true },
      { match: /[@-]+(?=\S)/, token: 'operator', after: (p) => p === undefined },
      { match: /\{\{/, token: 'escape', push: 'interpolation' },
      { match: /(?=\S)/, push: '@shell' },
    ],
    interpolation: [
      { match: /\}\}/, token: 'escape', pop: true },
      { include: 'expression' },
    ],
  },
  embeds: {
    // The shell runs the line; {{ ends it for a moment.
    shell: { language: 'bash', end: /\{\{|$/ },
  },
}
