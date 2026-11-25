import type { Grammar } from '../../engine/grammar.js'

// LaTeX: commands, environments, math, and comments.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /%.*/, token: 'comment' },
      { match: /(\\begin|\\end)(\{)(verbatim|lstlisting|minted|comment)(\})/, groups: ['keyword', 'punctuation', 'type', 'punctuation'], push: (t) => (t.startsWith('\\begin') ? `verbatim/${/\{(\w+)\}/.exec(t)![1]}` : 'root') },
      { match: /(\\begin|\\end)(\{)([\w*]+)(\})/, groups: ['keyword', 'punctuation', 'type', 'punctuation'] },
      { match: /(\\(?:documentclass|usepackage|input|include|bibliography|bibliographystyle))(?=[[{])/, token: 'keyword' },
      { match: /(\\(?:section|subsection|subsubsection|chapter|part|paragraph|title|caption)\*?)(\{)([^}\n]*)(\})/, groups: ['keyword', 'punctuation', 'property', 'punctuation'] },
      { match: /(\\(?:label|ref|eqref|cite|citep|citet|autoref|cref|url|href))(\{)([^}\n]*)(\})/, groups: ['keyword', 'punctuation', 'string', 'punctuation'] },
      { match: /\$\$|\\\[/, token: 'string', push: (t) => `display/${t === '$$' ? '$$' : '\\]'}` },
      { match: /\\\(/, token: 'string', push: 'inline/\\)' },
      { match: /\$/, token: 'string', push: 'inline/$' },
      { match: /\\(?:[A-Za-z@]+\*?|.)/, token: 'function' }, // \textbf, \\, \%
      { match: /[{}[\]]/, token: 'punctuation' },
      { match: /&|~|\^|_/, token: 'operator' },
      { match: /[^\\%${}[\]&~^_]+/ },
    ],
    // $…$, \(…\): math, colored as one piece with its commands.
    inline: [
      { match: (line, pos, close) => (line.startsWith(close, pos) ? close.length : -1), token: 'string', pop: true },
      { include: 'math' },
    ],
    display: [
      { match: (line, pos, close) => (line.startsWith(close, pos) ? close.length : -1), token: 'string', pop: true },
      { include: 'math' },
    ],
    math: [
      { match: /%.*/, token: 'comment' },
      { match: /\\[A-Za-z]+/, token: 'function' },
      { match: /\\./, token: 'escape' },
      { match: /[_^&]/, token: 'operator' },
      { match: /\d+(?:\.\d+)?/, token: 'number' },
      { match: /[^\\%$_^&\d)\]]+|[)\]]/, token: 'string' },
    ],
    verbatim: [
      { match: (line, pos, env) => (line.startsWith(`\\end{${env}}`, pos) ? 0 : -1), pop: true },
      { match: /.+/, token: 'string' },
    ],
  },
}
