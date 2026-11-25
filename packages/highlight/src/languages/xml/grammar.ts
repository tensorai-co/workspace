import type { Grammar } from '../../engine/grammar.js'

// XML, and markup like it: SVG, RSS, Android layouts, Maven poms, plists.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /<!--/, token: 'comment', push: 'comment' },
      { match: /<!\[CDATA\[/, token: 'meta', push: 'cdata' },
      { match: /<\?[\w:-]+/, token: 'meta', push: 'instruction' },
      { match: /<![A-Za-z]+/, token: 'meta', push: 'declaration' },
      { match: /(<\/?)([\w:.-]+)/, groups: ['punctuation', 'tag'], push: 'tag' },
      { match: /&(?:#\d+|#x[\da-fA-F]+|[\w.-]+);/, token: 'escape' },
      { match: /[^<&]+/ },
      { match: /[<&]/ },
    ],
    // Inside <name …>: attributes, to > or />.
    tag: [
      { match: /\/?>/, token: 'punctuation', pop: true },
      { match: /\s+/ },
      { match: /([\w:.-]+)(\s*)(=)/, groups: ['property', undefined, 'operator'] },
      { match: /[\w:.-]+/, token: 'property' },
      { match: /"/, token: 'string', push: 'double' },
      { match: /'/, token: 'string', push: 'single' },
    ],
    double: [
      { match: /[^"&]+/, token: 'string' },
      { match: /&(?:#\d+|#x[\da-fA-F]+|[\w.-]+);/, token: 'escape' },
      { match: /&/, token: 'string' },
      { match: /"/, token: 'string', pop: true },
    ],
    single: [
      { match: /[^'&]+/, token: 'string' },
      { match: /&(?:#\d+|#x[\da-fA-F]+|[\w.-]+);/, token: 'escape' },
      { match: /&/, token: 'string' },
      { match: /'/, token: 'string', pop: true },
    ],
    // <?xml version="1.0"?>
    instruction: [
      { match: /\?>/, token: 'meta', pop: true },
      { match: /\s+/ },
      { match: /[\w:.-]+(?=\s*=)/, token: 'property' },
      { match: /=/, token: 'operator' },
      { match: /"[^"]*"|'[^']*'/, token: 'string' },
      { match: /[^?\s"'=]+|\?/, token: 'meta' },
    ],
    // <!DOCTYPE html …>, with [ internal subsets ].
    declaration: [
      { match: />/, token: 'meta', pop: true },
      { match: /"[^"]*"|'[^']*'/, token: 'string' },
      { match: /<!--/, token: 'comment', push: 'comment' },
      { match: /\[/, token: 'punctuation', push: 'subset' },
      { match: /[^>"'[<]+|</, token: 'meta' },
    ],
    subset: [
      { match: /\]/, token: 'punctuation', pop: true },
      { match: /<!--/, token: 'comment', push: 'comment' },
      { match: /<!/, token: 'meta', push: 'declaration' },
      { match: /[^\]<]+|</ },
    ],
    comment: [
      { match: /-->/, token: 'comment', pop: true },
      { match: /[^-]+|-/, token: 'comment' },
    ],
    cdata: [
      { match: /\]\]>/, token: 'meta', pop: true },
      { match: /[^\]]+|\]/, token: 'string' },
    ],
  },
}
