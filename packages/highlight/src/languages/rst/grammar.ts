import type { Grammar } from '../../engine/grammar.js'

// reStructuredText: titles underlined with punctuation, .. directives (with
// code-block bodies colored in their language), :fields:, **strong**,
// *emphasis*, ``literals``, `links`_ and :roles:`text`.

/** A directive's body: the lines indented deeper than its ".." line, whose indent is after the colon in arg. */
function bodyEnd(line: string, from: number, arg: string): number {
  if (from > 0 || line.trim() === '') return -1
  let i = 0
  while (line[i] === ' ' || line[i] === '\t') i++
  return i <= Number(arg.split(':').pop()) ? 0 : -1
}

const indent = (text: string) => text.length - text.trimStart().length

export const grammar: Grammar = {
  states: {
    root: [
      // .. code-block:: python, .. sourcecode:: js, .. code:: rust
      { match: /^(\s*)(\.\.)(\s+)(code-block|sourcecode|code)(::)(\s*)([\w+-]*)(.*)$/, groups: [undefined, 'punctuation', undefined, 'keyword', 'punctuation', undefined, 'meta', 'string'], push: (t) => `directive/${/::\s*([\w+-]+)/.exec(t)?.[1] ?? ''}:${indent(t)}` },
      { match: /^(\s*)(\.\.)(\s+)([\w:-]+)(::)(.*)$/, groups: [undefined, 'punctuation', undefined, 'keyword', 'punctuation', 'string'] }, // .. note::
      { match: /^(\s*)(\.\.)(\s+)(_[^:\n]+:)(.*)$/, groups: [undefined, 'punctuation', undefined, 'variable', 'regexp'] }, // .. _target: url
      { match: /^(\s*)(\.\.)(\s+)(\[[^\]\n]+\])(.*)$/, groups: [undefined, 'punctuation', undefined, 'variable', 'string'] }, // .. [1] footnote
      { match: /^(\s*)(\.\.)(\s+)(\|[^|\n]+\|)(\s+)([\w-]+)(::)(.*)$/, groups: [undefined, 'punctuation', undefined, 'variable', undefined, 'keyword', 'punctuation', 'string'] }, // .. |sub| image::
      { match: /^\s*\.\.(?:\s.*)?$/, token: 'comment' },
      { match: /^([=\-`:'"~^_*+#<>])\1{2,}\s*$/, token: 'punctuation' }, // a title's underline
      { match: /^(\s*)(:[^:\n]+:)(?=\s|$)/, groups: [undefined, 'property'] }, // :field: value
      { match: /^(\s*)([-*+•]|\d+\.|#\.|\(?[a-zA-Z\d]+\))(?=\s)/, groups: [undefined, 'variable'] },
      { match: /^(\s*)(>>>)(.*)$/, groups: [undefined, 'operator', 'string'] }, // a doctest
      { include: 'inline' },
    ],
    // A code-block's options (:linenos:), then its indented body.
    directive: [
      { match: /^(\s+)(:[\w-]+:)(.*)$/, groups: [undefined, 'property', 'string'] },
      { match: /^(?=\S)/, pop: true },
      { match: (line, pos) => (pos === 0 && line.trim() !== '' ? 0 : -1), push: (_t, arg) => `@body/${arg}` },
    ],
    inline: [
      { match: /\\./, token: 'escape' },
      { match: /``[^`\n]+``/, token: 'string' },
      { match: /(:[\w:+-]+:)(`[^`\n]+`)/, groups: ['keyword', 'string'] }, // :ref:`target`
      { match: /(`)([^`<\n]*?)(\s*<[^>\n]+>)?(`__?)/, groups: ['punctuation', 'string', 'regexp', 'punctuation'] }, // `text <url>`_
      { match: /`[^`\n]+`/, token: 'variable' }, // interpreted text
      { match: /\*\*[^*\n]+\*\*/, token: 'keyword' },
      { match: /(?<![\w*])\*[^*\s](?:[^*\n]*[^*\s])?\*(?![\w*])/, token: 'variable' },
      { match: /\|[^|\s][^|\n]*\|_{0,2}/, token: 'variable' }, // |substitution|
      { match: /\[[\d#*][\w-]*\]_|\[\w[\w-]*\]_/, token: 'regexp' }, // [1]_, [cite]_
      { match: /\w[\w-]*_(?!\w)/, token: 'regexp' }, // a reference_
      { match: /https?:\/\/[^\s>]+/, token: 'regexp' },
      { match: /::\s*$/, token: 'punctuation' }, // a literal block follows
      { match: /[^\\`*|[\w:h]+|\w+|./ },
    ],
  },
  embeds: {
    body: { language: (arg) => arg.slice(0, arg.lastIndexOf(':')), end: bodyEnd },
  },
}
