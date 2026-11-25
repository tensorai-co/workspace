import type { Grammar } from '../../engine/grammar.js'

// BibTeX: @type{key, field = {value} or "value" or a number}, @string
// abbreviations joined with #, and % comments.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /%.*/, token: 'comment' },
      { match: /(@comment)(\s*)(\{)/i, groups: ['comment', undefined, 'comment'], push: 'commentEntry' },
      { match: /(@[A-Za-z]+)(\s*)([{(])(\s*)([^,\s{}()]*)(?=\s*,)/, groups: ['keyword', undefined, 'punctuation', undefined, 'function'], push: 'entry' },
      { match: /(@[A-Za-z]+)(\s*)([{(])/, groups: ['keyword', undefined, 'punctuation'], push: 'entry' },
      { match: /[^@%\s]+/, token: 'comment' }, // text between entries is ignored
    ],
    entry: [
      { match: /[})]/, token: 'punctuation', pop: true },
      { match: /\s+/ },
      { match: /%.*/, token: 'comment' },
      { match: /([\w-]+)(\s*)(=)/, groups: ['property', undefined, 'operator'] },
      { match: /\{/, token: 'string', push: 'braced' },
      { match: /"/, token: 'string', push: 'quoted' },
      { match: /\d+/, token: 'number' },
      { match: /#/, token: 'operator' },
      { match: /[A-Za-z][\w-]*/, token: 'variable' }, // an @string abbreviation: jan
      { match: /,/, token: 'punctuation' },
    ],
    braced: [
      { match: /\}/, token: 'string', pop: true },
      { match: /\{/, token: 'string', push: 'braced' },
      { match: /\\(?:[A-Za-z]+|.)/, token: 'escape' }, // LaTeX: \"o, \emph
      { match: /[^{}\\]+/, token: 'string' },
    ],
    quoted: [
      { match: /"/, token: 'string', pop: true },
      { match: /\{/, token: 'string', push: 'braced' },
      { match: /\\(?:[A-Za-z]+|.)/, token: 'escape' },
      { match: /[^"{\\]+/, token: 'string' },
    ],
    commentEntry: [
      { match: /\}/, token: 'comment', pop: true },
      { match: /\{/, token: 'comment', push: 'commentEntry' },
      { match: /[^{}]+/, token: 'comment' },
    ],
  },
}
