import type { Grammar } from '../../engine/grammar.js'

// XSLT: XML whose xsl: elements are the language, with XPath in select,
// test and match, and {expressions} in other attributes.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /<!--/, token: 'comment', push: 'comment' },
      { match: /<!\[CDATA\[/, token: 'meta', push: 'cdata' },
      { match: /<\?[\w:-]+/, token: 'meta', push: 'instruction' },
      { match: /<![A-Za-z]+/, token: 'meta', push: 'declaration' },
      { match: /(<\/?)(xsl:[\w.-]+)/, groups: ['punctuation', 'keyword'], push: 'tag' },
      { match: /(<\/?)([\w:.-]+)/, groups: ['punctuation', 'tag'], push: 'tag' },
      { match: /&(?:#\d+|#x[\da-fA-F]+|[\w.-]+);/, token: 'escape' },
      { match: /[^<&]+/ },
      { match: /[<&]/ },
    ],
    // Inside <name …>: attributes, to > or />.
    tag: [
      { match: /\/?>/, token: 'punctuation', pop: true },
      { match: /\s+/ },
      // select="…", test="…", match="…": XPath.
      { match: /(select|test|match|use|count|from|value|group-by|group-adjacent)(\s*)(=)(\s*)(")/, groups: ['property', undefined, 'operator', undefined, 'string'], push: 'xpath' },
      { match: /([\w:.-]+)(\s*)(=)/, groups: ['property', undefined, 'operator'] },
      { match: /[\w:.-]+/, token: 'property' },
      { match: /"/, token: 'string', push: 'double' },
      { match: /'/, token: 'string', push: 'single' },
    ],
    xpath: [
      { match: /"/, token: 'string', pop: true },
      { match: /\s+/ },
      { match: /'[^']*'/, token: 'string' },
      { match: /\$[\w.-]+/, token: 'variable' },
      { match: /@[\w:*.-]+/, token: 'property' },
      { match: /[\w.-]+(?::[\w.-]+)?(?=\()/, token: 'builtin' }, // count(), concat()
      { match: /(?:and|or|div|mod)(?![\w-])/, token: 'operator' },
      { match: /\d+(?:\.\d+)?/, token: 'number' },
      { match: /&(?:#\d+|#x[\da-fA-F]+|[\w.-]+);/, token: 'escape' },
      { match: /\/\/?|\.\.?|::|!=|<=|>=|[=<>|*+-]/, token: 'operator' },
      { match: /[\w:.-]+/ },
      { match: /[()[\],]/, token: 'punctuation' },
    ],
    double: [
      { match: /\{[^}"]*\}/, token: 'escape' }, // an attribute value template: {@id}
      { match: /[^"&{]+|\{/, token: 'string' },
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
