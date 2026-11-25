import type { Grammar } from '../../engine/grammar.js'

// Edge (AdonisJS): HTML with {{ expressions }}, {{{ raw output }}},
// {{-- comments --}} and @tags whose arguments are JavaScript.

/** Elements whose content is another language. */
const RAW = new Set(['style', 'script'])

export const grammar: Grammar = {
  states: {
    root: [
      { include: 'template' },
      { match: /<!--/, token: 'comment', push: 'comment' },
      { match: /<!(?:DOCTYPE|doctype)[^>]*>?/, token: 'meta' },
      { match: /(<)([A-Za-z][\w:-]*)/, groups: ['punctuation', 'tag'], push: (t) => `tag/${t.slice(1).toLowerCase()}` },
      { match: /(<\/)([A-Za-z][\w:-]*)(\s*>)?/, groups: ['punctuation', 'tag', 'punctuation'] },
      { match: /&(?:#\d+|#[xX][\da-fA-F]+|[A-Za-z]\w*);/, token: 'escape' },
      // @if(cond), @each(item in items), @!component('x'), @end
      { match: /(@!?)([A-Za-z][\w.]*)(\()/, groups: ['keyword', 'keyword', 'punctuation'], push: 'args' },
      { match: /@!?[A-Za-z][\w.]*/, token: 'keyword' },
      { match: /[^<&{@]+|[<&{@]/ },
    ],
    tag: [
      { match: (line, pos, name) => (line[pos] === '>' && RAW.has(name) ? 1 : -1), token: 'punctuation', next: (_t, name) => `@${name}` },
      { match: /\/?>/, token: 'punctuation', pop: true },
      { match: /\s+/ },
      { include: 'template' },
      { match: /([^\s"'<>/=]+)(\s*)(=)/, groups: ['property', undefined, 'operator'] },
      { match: /"/, token: 'string', push: 'double' },
      { match: /'/, token: 'string', push: 'single' },
      { match: /[^\s"'<>/=]+/, token: 'property' },
      { match: /\//, token: 'punctuation' },
    ],
    template: [
      { match: /\{\{--/, token: 'comment', push: 'templateComment' },
      { match: /@?\{\{\{/, token: 'escape', push: 'raw' },
      { match: /@?\{\{/, token: 'escape', push: 'output' },
    ],
    output: [
      { match: /\}\}/, token: 'escape', pop: true },
      { match: /(?=[^}])/, push: '@output' },
    ],
    raw: [
      { match: /\}\}\}/, token: 'escape', pop: true },
      { match: /(?=[^}])/, push: '@raw' },
    ],
    args: [
      { match: /\)/, token: 'punctuation', pop: true },
      { match: /(?=[^)])/, push: '@args' },
    ],
    double: [
      { match: /"/, token: 'string', pop: true },
      { include: 'template' },
      { match: /[^"{]+|\{/, token: 'string' },
    ],
    single: [
      { match: /'/, token: 'string', pop: true },
      { include: 'template' },
      { match: /[^'{]+|\{/, token: 'string' },
    ],
    templateComment: [
      { match: /--\}\}/, token: 'comment', pop: true },
      { match: /[^-]+|-/, token: 'comment' },
    ],
    comment: [
      { match: /-->/, token: 'comment', pop: true },
      { match: /[^-]+|-/, token: 'comment' },
    ],
  },
  embeds: {
    style: { language: 'css', end: /<\/style/i },
    script: { language: 'javascript', end: /<\/script/i },
    output: { language: 'javascript', end: /\}\}/ },
    raw: { language: 'javascript', end: /\}\}\}/ },
    // @if(a(b)): to the ) that ends the line, or the first one.
    args: { language: 'javascript', end: (line, from) => { const i = line.lastIndexOf(')'); return i >= from ? i : -1 } },
  },
}
