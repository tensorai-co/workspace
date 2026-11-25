import type { Grammar } from '../../engine/grammar.js'

// Sass's indented syntax: SCSS without braces or semicolons. A line is a
// selector, a property: value, a $variable: value, an @rule, or a mixin's
// =definition or +include.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*.*/, token: 'comment' },
      { match: /(\$[\w-]+)(\s*)(:)/, groups: ['variable', undefined, 'punctuation'], push: 'value', after: (p) => p === undefined },
      { match: /(=|\+|@mixin|@include)(\s*)([\w-]+)/, groups: ['keyword', undefined, 'function'], push: 'value', after: (p) => p === undefined },
      { match: /@[\w-]+/, token: 'keyword', push: 'value', after: (p) => p === undefined },
      // A declaration: name: value, or :name value.
      { match: /(--[\w-]+|-?[A-Za-z][\w-]*(?:#\{[^}\n]*\}[\w-]*)*)(\s*)(:)(?=\s|$)/, groups: ['property', undefined, 'punctuation'], push: 'value', after: (p) => p === undefined },
      { match: /(:)([A-Za-z][\w-]*)(?=\s)/, groups: ['punctuation', 'property'], push: 'value', after: (p) => p === undefined },
      { include: 'selectors' },
    ],
    selectors: [
      { match: /\s+/ },
      { match: /#\{/, token: 'escape', push: 'interpolation' },
      { match: /[.#%][\w-]+/, token: 'function' },
      { match: /::?[\w-]+/, token: 'function' },
      { match: /\[[^\]\n]*\]?/, token: 'property' },
      { match: /&[\w-]*/, token: 'operator' },
      { match: /[A-Za-z][\w-]*|\*/, token: 'tag' },
      { match: /[>+~,()]/, token: 'operator' },
    ],
    // The rest of the line.
    value: [
      { match: /$/, pop: true },
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?/, token: 'string' },
      { match: /\$[\w-]+/, token: 'variable' },
      { match: /#\{/, token: 'escape', push: 'interpolation' },
      { match: /!(?:default|global|optional|important)\b/, token: 'keyword' },
      { match: /(?:and|or|not|in|from|through|to|if|else)\b/, token: 'keyword' },
      { match: /#[\da-fA-F]{3,8}\b/, token: 'constant' },
      { match: /(?:[\w-]+\.)?[\w-]+(?=\()/, token: 'builtin' },
      { match: /[-+]?(?:\d+\.?\d*|\.\d+)(?:%|[A-Za-z]+)?/, token: 'number' },
      { match: /==|!=|<=|>=|[-+*/%<>,]/, token: 'operator' },
      { match: /[()]/, token: 'punctuation' },
      { match: /[A-Za-z_-][\w-]*/ },
    ],
    interpolation: [
      { match: /\}/, token: 'escape', pop: true },
      { include: 'value' },
    ],
  },
}
