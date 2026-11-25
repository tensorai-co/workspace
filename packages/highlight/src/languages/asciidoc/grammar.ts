import type { Grammar } from '../../engine/grammar.js'

// AsciiDoc: = titles, :attributes:, *bold*, _italic_, `mono`, macros like
// link:url[text], [source,lang] blocks colored in their language, admonitions,
// lists, tables and // comments.

/** [source,python] → "python": the next ---- block's language. */
const sourceLanguage = (text: string) => /^\[source(?:,\s*([^,\]\s]+))?/.exec(text)?.[1] ?? ''

export const grammar: Grammar = {
  states: {
    root: [
      { match: /^\/\/\/\/+\s*$/, token: 'comment', push: 'blockComment' },
      { match: /^\/\/.*/, token: 'comment' },
      { match: /^(=+|#+)(\s+)(.*)/, groups: ['punctuation', undefined, 'property'] }, // = Title, == Section
      { match: /^(:!?)([\w-]+)(!?:)(.*)/, groups: ['punctuation', 'variable', 'punctuation', 'string'] }, // :toc: left
      { match: /^\[source[^\]]*\]\s*$/, token: 'meta', push: (t) => `source/${sourceLanguage(t)}` },
      { match: /^\[[^\]\n]*\]\s*$/, token: 'meta' }, // [NOTE], [quote, Author]
      { match: /^\.[^\s.].*/, token: 'property' }, // .A block title
      { match: /^(?:----|\.\.\.\.)\s*$/, token: 'meta', push: 'listing' },
      { match: /^(?:____|====|\*\*\*\*|--|\+\+\+\+)\s*$/, token: 'meta' }, // other delimited blocks
      { match: /^(\|===|,===|:===)\s*$/, token: 'punctuation' },
      { match: /^(NOTE|TIP|IMPORTANT|WARNING|CAUTION):(?=\s)/, token: 'keyword' },
      { match: /^(\s*)([*.\-]+|\d+\.)(?=\s)/, groups: [undefined, 'variable'] }, // list items
      { match: /^(include|image|video|toc)(::)([^\[\n]*)(\[)/, groups: ['keyword', 'punctuation', 'regexp', 'punctuation'], push: 'attributes' },
      { match: /^'''\s*$|^<<<\s*$/, token: 'meta' },
      { include: 'inline' },
    ],
    inline: [
      { match: /\\[*_`#+{]/, token: 'escape' },
      { match: /`[^`\n]+`/, token: 'string' },
      { match: /\*\*[^*\n]+\*\*|(?<![\w*])\*[^*\s](?:[^*\n]*[^*\s])?\*(?![\w*])/, token: 'keyword' },
      { match: /__[^_\n]+__|(?<![\w_])_[^_\s](?:[^_\n]*[^_\s])?_(?![\w_])/, token: 'variable' },
      { match: /#[^#\n]+#/, token: 'meta' }, // #highlight#
      { match: /\{[\w-]+\}/, token: 'variable' }, // {attribute}
      { match: /<<[^>\n]+>>/, token: 'regexp' }, // <<cross-reference>>
      { match: /(link|mailto|xref|kbd|btn|menu|footnote|pass|image|icon|stem):([^\[\s]*)(\[)/, groups: ['keyword', 'regexp', 'punctuation'], push: 'attributes' },
      { match: /(https?:\/\/[^\s[]+)(\[)/, groups: ['regexp', 'punctuation'], push: 'attributes' },
      { match: /https?:\/\/[^\s[\]]+/, token: 'regexp' },
      { match: /\s\+$/, token: 'operator' }, // a hard line break
      { match: /[^\\`*_#{<lhmxkbfpisc|]+|./ },
    ],
    attributes: [
      { match: /\]/, token: 'punctuation', pop: true },
      { match: /([\w-]+)(=)/, groups: ['property', 'operator'] },
      { match: /"[^"\n]*"/, token: 'string' },
      { match: /[^\]=",]+|[=",]/, token: 'string' },
    ],
    // After [source,lang]: the ---- block below is code.
    source: [
      { match: /^(?:----|\.\.\.\.)\s*$/, token: 'meta', next: (_t, lang) => `code/${lang}` },
      { match: /^\..*/, token: 'property' }, // a title between them
      { match: /(?=.)/, pop: true },
    ],
    code: [
      { match: /^(?:----|\.\.\.\.)\s*$/, token: 'meta', pop: true },
      { match: (line, pos) => (pos === 0 ? 0 : -1), push: (_t, lang) => `@code/${lang}` },
    ],
    listing: [
      { match: /^(?:----|\.\.\.\.)\s*$/, token: 'meta', pop: true },
      { match: /.+/, token: 'string' },
    ],
    blockComment: [
      { match: /^\/\/\/\/+\s*$/, token: 'comment', pop: true },
      { match: /.+/, token: 'comment' },
    ],
  },
  embeds: {
    code: { language: (lang) => lang, end: /^(?=(?:----|\.\.\.\.)\s*$)/ },
  },
}
