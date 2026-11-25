import type { Grammar } from '../../engine/grammar.js'

// Fluent (Mozilla's localization): message = text with { placeables },
// -terms, .attributes, selectors with [variants] and *[default], and #
// comments.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /#{1,3}(?: .*)?$/, token: 'comment', after: (p) => p === undefined },
      { match: /(-?[A-Za-z][\w-]*)(\s*)(=)/, groups: ['property', undefined, 'operator'], after: (p) => p === undefined },
      { match: /(\s+)(\.)([A-Za-z][\w-]*)(\s*)(=)/, groups: [undefined, 'punctuation', 'property', undefined, 'operator'], after: (p) => p === undefined }, // .attribute =
      { match: /(\s+)(\*?\[)([^\]\n]*)(\])/, groups: [undefined, 'operator', 'constant', 'operator'], after: (p) => p === undefined || p.type === undefined }, // [one], *[other]
      { match: /\{/, token: 'punctuation', push: 'placeable' },
      { match: /\}/, token: 'punctuation' },
      { match: /[^{}\n]+/ },
    ],
    placeable: [
      { match: /\}/, token: 'punctuation', pop: true },
      { match: /\{/, token: 'punctuation', push: 'placeable' },
      { match: /\s+/ },
      { match: /"(?:[^"\\]|\\.)*"/, token: 'string' },
      { match: /\$[A-Za-z][\w-]*/, token: 'variable' },
      { match: /-[A-Za-z][\w-]*/, token: 'variable' }, // a -term
      { match: /[A-Z][A-Z\d_-]*(?=\()/, token: 'builtin' }, // NUMBER(), DATETIME()
      { match: /->/, token: 'operator', push: 'variants' },
      { match: /([A-Za-z][\w-]*)(\s*)(:)/, groups: ['property', undefined, 'operator'] }, // named arguments
      { match: /-?\d+(?:\.\d+)?/, token: 'number' },
      { match: /[A-Za-z][\w-]*(?:\.[A-Za-z][\w-]*)?/, token: 'property' }, // a message reference
      { match: /[(),]/, token: 'punctuation' },
    ],
    // The variants of a selector, to its closing }.
    variants: [
      { match: /(?=\s*\})/, pop: true },
      { match: /(\*?\[)([^\]\n]*)(\])/, groups: ['operator', 'constant', 'operator'] },
      { match: /\{/, token: 'punctuation', push: 'placeable' },
      { match: /\s+/ },
      { match: /[^{}[*\s][^{}[\n]*|\*/ },
    ],
  },
}
