import type { Grammar } from '../../engine/grammar.js'

// Org mode: * headings with TODO keywords and :tags:, #+KEYWORDS:,
// #+BEGIN_SRC blocks colored in their language, lists, [[links]],
// *bold* /italic/ =verbatim= ~code~, <timestamps> and tables.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /^(\*+)(\s+)(?:(TODO|DONE|NEXT|WAITING|CANCELLED|CANCELED)(\s+))?(\[#[A-C]\]\s+)?/, groups: ['punctuation', undefined, 'keyword', undefined, 'constant'], push: 'heading' },
      { match: /^(\s*)(#\+begin_src)(\s*)([\w+-]*)(.*)$/i, groups: [undefined, 'meta', undefined, 'meta', 'string'], push: (t) => `src/${/#\+begin_src\s+([\w+-]+)/i.exec(t)?.[1] ?? ''}` },
      { match: /^(\s*)(#\+begin_(?:example|quote|verse|center|export)\b.*)$/i, groups: [undefined, 'meta'], push: 'block' },
      { match: /^(\s*)(#\+[\w_-]+:)(.*)$/, groups: [undefined, 'meta', 'string'] }, // #+TITLE: Inventory
      { match: /^\s*#(?:\s.*|$)/, token: 'comment' },
      { match: /^(\s*)(:[\w-]+:)(.*)$/, groups: [undefined, 'variable', 'string'] }, // :PROPERTIES:, :ID: x
      { match: /^\s*\|[-+]+\|?\s*$/, token: 'punctuation' }, // a table rule
      { match: /^(\s*)([-+]|\d+[.)])(\s+)(\[[ X-]\])?/, groups: [undefined, 'variable', undefined, 'variable'] }, // - [X] item
      { match: /^(\s*)(CLOSED|SCHEDULED|DEADLINE):/, groups: [undefined, 'keyword'] },
      { include: 'inline' },
    ],
    heading: [
      { match: /$/, pop: true },
      { match: /(\s+)(:[\w@#%:]+:)\s*$/, groups: [undefined, 'meta'] }, // :work:urgent:
      { match: /[^\s[<*/=~+:]+/, token: 'property' },
      { include: 'inline' },
    ],
    inline: [
      { match: /(\[\[)([^\]\n]+)(\]\[)([^\]\n]*)(\]\])/, groups: ['punctuation', 'regexp', 'punctuation', 'string', 'punctuation'] },
      { match: /(\[\[)([^\]\n]+)(\]\])/, groups: ['punctuation', 'regexp', 'punctuation'] },
      { match: /[<[]\d{4}-\d{2}-\d{2}[^>\]\n]*[>\]]/, token: 'number' }, // <2026-01-01 Thu>
      { match: /(?<![\w*])\*[^*\s](?:[^*\n]*[^*\s])?\*(?![\w*])/, token: 'keyword' },
      { match: /(?<![\w/])\/[^/\s](?:[^/\n]*[^/\s])?\/(?![\w/])/, token: 'variable' },
      { match: /(?<![\w=])=[^=\s](?:[^=\n]*[^=\s])?=(?![\w=])|(?<![\w~])~[^~\s](?:[^~\n]*[^~\s])?~(?![\w~])/, token: 'string' },
      { match: /(?<![\w+])\+[^+\s](?:[^+\n]*[^+\s])?\+(?![\w+])/, token: 'comment' },
      { match: /\|/, token: 'punctuation' },
      { match: /https?:\/\/\S+/, token: 'regexp' },
      { match: /[^\s\[<*/=~+|h]+|\s+|./ },
    ],
    src: [
      { match: /^\s*#\+end_src\b.*/i, token: 'meta', pop: true },
      { match: (line, pos) => (pos === 0 ? 0 : -1), push: (_t, lang) => `@src/${lang}` },
    ],
    block: [
      { match: /^\s*#\+end_\w+\b.*/i, token: 'meta', pop: true },
      { match: /.+/, token: 'string' },
    ],
  },
  embeds: {
    src: { language: (lang) => (lang === 'emacs-lisp' || lang === 'elisp' ? 'emacs-lisp' : lang), end: /^(?=\s*#\+end_src\b)/i },
  },
}
