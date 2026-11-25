import type { Grammar } from '../../engine/grammar.js'

// Less: CSS with @variables, @{interpolation}, mixins and guards.

/** A declaration: name: value, where no { follows before the ; (a:hover { is a selector). */
const PROPERTY = /--[\w-]+(?=\s*:)|-?[A-Za-z][\w-]*(?:@\{[^}\n]*\}[\w-]*)*(?=\s*:(?!(?:[^;{}@]|@(?!\{)|@\{[^}\n]*\})*\{))/

export const grammar: Grammar = {
  states: {
    root: [{ include: 'selectors' }],
    // Selectors and at-rules, outside or inside blocks.
    selectors: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'comment' },
      { match: /(@[\w-]+)(\s*)(:)/, groups: ['variable', undefined, 'punctuation'], push: 'value' },
      { match: /@\{/, token: 'escape', push: 'interpolation' },
      { match: /@[\w-]+/, token: 'keyword', push: 'atRule' },
      // A mixin: .rounded(4px); or .rounded(@r: 2px) { … }. Its arguments are values.
      { match: /([.#][\w-]+)(\s*)(\()/, groups: ['function', undefined, 'punctuation'], push: 'call' },
      { match: /\bwhen\b/, token: 'keyword' },
      { match: /%[\w-]+/, token: 'function' }, // %placeholder
      { match: /(&)([\w-]+)/, groups: ['operator', 'function'] }, // &--modifier
      { match: /\{/, token: 'punctuation', push: 'block' },
      { match: /[.#][\w-]+/, token: 'function' }, // .class, #id
      { match: /::?[\w-]+/, token: 'function' }, // :hover, ::before
      { match: /\[/, token: 'punctuation', push: 'attribute' },
      { match: /\(/, token: 'punctuation', push: 'parens' },
      { match: /[A-Za-z][\w-]*|\*/, token: 'tag' }, // div, svg|rect, *
      { match: /\d+(?:\.\d+)?%/, token: 'number' }, // keyframe stops: 50%
      { match: /[>+~&|]/, token: 'operator' },
      { match: /[,;)]/, token: 'punctuation' },
    ],
    // { declarations, and nested rules }
    block: [
      { match: /\}/, token: 'punctuation', pop: true },
      { match: /\s+/ },
      { match: /\/\*/, token: 'comment', push: 'comment' },
      { match: /\/\/.*/, token: 'comment' },
      { match: PROPERTY, token: 'property' },
      { match: /:/, token: 'punctuation', push: 'value', after: (p) => p?.type === 'property' },
      { include: 'selectors' },
    ],
    // A declaration's value, to ; or the block's }.
    value: [
      { match: /;/, token: 'punctuation', pop: true },
      { match: /(?=[})])/, pop: true }, // or a mixin's parameter list closes
      { include: 'values' },
    ],
    values: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'comment' },
      { match: /@@?[\w-]+/, token: 'variable' },
      { match: /@\{/, token: 'escape', push: 'interpolation' },
      { match: /~(?=["'])/, token: 'operator' }, // ~"escaped"
      { match: /!important\b/, token: 'keyword' },
      { match: /(?:and|or|not|in|from|through|to)\b/, token: 'keyword' },
      { match: /==|!=|<=|>=|[<>%]/, token: 'operator' },
      { match: /"/, token: 'string', push: 'double' },
      { match: /'/, token: 'string', push: 'single' },
      { match: /(url)(\()([^)'"\n]*)(\))/i, groups: ['builtin', 'punctuation', 'string', 'punctuation'] },
      { match: /(?:[\w-]+\.)?[\w-]+(?=\()/, token: 'builtin', push: 'call' }, // var(), calc(), math.div()
      { match: /!\s*important\b/i, token: 'keyword' },
      { match: /#[\da-fA-F]{3,8}\b/, token: 'constant' },
      { match: /--[\w-]+/, token: 'variable' },
      { match: /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?(?:%|[A-Za-z]+)?/, token: 'number' },
      { match: /[A-Za-z_-][\w-]*/ },
      { match: /[,/*+]|-(?=\s)/, token: 'operator' },
      { match: /\(/, token: 'punctuation', push: 'call' },
    ],
    // Inside a function's parentheses: var(--x, 1px), calc(100% - 2rem).
    call: [
      { match: /\(/, token: 'punctuation' },
      { match: /\)/, token: 'punctuation', pop: true },
      { include: 'values' },
    ],
    // At-rule preludes: @media (min-width: 600px) and (hover), @import url(x);
    atRule: [
      { match: /;/, token: 'punctuation', pop: true },
      { match: /(?=\{)/, pop: true },
      { match: /(?:and|or|not|only|from|to|of|layer|supports|screen|print|all)\b/, token: 'keyword' },
      { match: /%[\w-]+/, token: 'function' }, // @extend %placeholder
      { match: /([\w-]+)(\s*)(:)/, groups: ['property', undefined, 'punctuation'] },
      { match: /[()]/, token: 'punctuation' },
      { include: 'values' },
    ],
    // (…) in a selector: :not(.a), :nth-child(2n + 1)
    parens: [
      { match: /\)/, token: 'punctuation', pop: true },
      { match: /\d*n(?:\s*[-+]\s*\d+)?|\d+|odd|even/, token: 'number' },
      { include: 'selectors' },
    ],
    // [type="text" i]
    attribute: [
      { match: /\]/, token: 'punctuation', pop: true },
      { match: /\s+/ },
      { match: /[\w-]+/, token: 'property' },
      { match: /[~|^$*]?=/, token: 'operator' },
      { match: /"[^"\n]*"?|'[^'\n]*'?/, token: 'string' },
    ],
    double: [
      { match: /@\{/, token: 'escape', push: 'interpolation' },
      { match: /[^"\\@]+|@/, token: 'string' },
      { match: /\\(?:[\da-fA-F]{1,6}\s?|.?)/, token: 'escape' },
      { match: /"/, token: 'string', pop: true },
      { match: /$/, pop: true },
    ],
    single: [
      { match: /[^'\\]+/, token: 'string' },
      { match: /\\(?:[\da-fA-F]{1,6}\s?|.?)/, token: 'escape' },
      { match: /'/, token: 'string', pop: true },
      { match: /$/, pop: true },
    ],
    // @{…} in selectors, properties and strings.
    interpolation: [
      { match: /\}/, token: 'escape', pop: true },
      { include: 'values' },
    ],
    comment: [
      { match: /[^*]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /\*/, token: 'comment' },
    ],
  },
}
