import type { Grammar } from '../../engine/grammar.js'

// MediaWiki markup: == headings ==, '''bold''' and ''italic'', [[links]],
// {{templates|args}}, tables, lists, <ref> and other tags, and
// <syntaxhighlight lang="…"> blocks colored in their language.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /^(=+)(.+?)(=+)\s*$/, groups: ['punctuation', 'property', 'punctuation'] },
      { match: /^-{4,}\s*$/, token: 'meta' },
      { match: /^([*#:;]+)/, token: 'variable' }, // list markers
      { match: /^(\{\|)(.*)$/, groups: ['punctuation', 'string'] }, // {| class="wikitable"
      { match: /^(\|\}|\|-.*|\|\+|!|\|)/, token: 'punctuation' },
      { match: /^ (?=\S)/, token: 'string', push: 'preformatted' },
      { include: 'inline' },
    ],
    preformatted: [
      { match: /$/, pop: true },
      { match: /.+/, token: 'string' },
    ],
    inline: [
      { match: /<!--/, token: 'comment', push: 'comment' },
      { match: /(<)(syntaxhighlight|source)([^>]*)(>)/i, groups: ['punctuation', 'tag', 'property', 'punctuation'], push: (t) => `code/${/lang="?([\w+-]+)/i.exec(t)?.[1] ?? ''}` },
      { match: /(<)(nowiki|pre|code|math)(\s[^>]*)?(>)/i, groups: ['punctuation', 'tag', 'property', 'punctuation'], push: (t) => `raw/${/<(\w+)/.exec(t)![1]!.toLowerCase()}` },
      { match: /(<\/?)([A-Za-z][\w-]*)([^>]*?)(\/?>)/, groups: ['punctuation', 'tag', 'property', 'punctuation'] },
      { match: /'''''|'''|''/, token: 'keyword' },
      { match: /\{\{\{/, token: 'variable', push: 'parameter' },
      { match: /(\{\{)(#?[^|}:\n]+)(:?)/, groups: ['punctuation', 'function', 'punctuation'], push: 'template' },
      { match: /(\[\[)([^|\]\n]+)/, groups: ['punctuation', 'regexp'], push: 'link' },
      { match: /(\[)((?:https?:)?\/\/[^\s\]]+)/, groups: ['punctuation', 'regexp'], push: 'externalLink' },
      { match: /https?:\/\/[^\s<\]]+/, token: 'regexp' },
      { match: /__[A-Z]+__/, token: 'constant' }, // __TOC__
      { match: /~{3,5}/, token: 'variable' }, // a signature
      { match: /&[\w#]+;/, token: 'escape' },
      { match: /\|\||!!/, token: 'punctuation' },
      { match: /[^<'{[\]}_~&|!h]+|./ },
    ],
    template: [
      { match: /\}\}/, token: 'punctuation', pop: true },
      { match: /(\|)(\s*[\w -]+?\s*)(=)/, groups: ['punctuation', 'property', 'operator'] },
      { match: /\|/, token: 'punctuation' },
      { include: 'inline' },
    ],
    parameter: [
      { match: /\}\}\}/, token: 'variable', pop: true },
      { match: /[^}]+|\}/, token: 'variable' },
    ],
    link: [
      { match: /\]\]/, token: 'punctuation', pop: true },
      { match: /\|/, token: 'punctuation' },
      { include: 'inline' },
    ],
    externalLink: [
      { match: /\]/, token: 'punctuation', pop: true },
      { include: 'inline' },
    ],
    code: [
      { match: /(<\/)(syntaxhighlight|source)(>)/i, groups: ['punctuation', 'tag', 'punctuation'], pop: true },
      { match: /(?=[\s\S])/, push: (_t, lang) => `@code/${lang}` },
    ],
    raw: [
      { match: (line, pos, tag) => (line.slice(pos, pos + tag.length + 3).toLowerCase() === `</${tag}>` ? tag.length + 3 : -1), token: 'tag', pop: true },
      { match: /[^<]+|</, token: 'string' },
    ],
    comment: [
      { match: /-->/, token: 'comment', pop: true },
      { match: /[^-]+|-/, token: 'comment' },
    ],
  },
  embeds: {
    code: { language: (lang) => lang, end: /<\/(?:syntaxhighlight|source)>/i },
  },
}
