import type { Grammar } from '../../engine/grammar.js'

// Haml: HTML by indentation. %tag.class#id{attributes}, = and - lines of
// Ruby, #{interpolation}, -# and / comments, and :filters.
const FILTERS: Record<string, string> = { javascript: 'javascript', css: 'css', scss: 'scss', sass: 'sass', ruby: 'ruby', markdown: 'markdown', erb: 'erb', coffee: 'coffee', plain: '', escaped: '', preserve: '' }

/** A filter's body: the lines indented deeper than the :filter line, whose indent is after the colon in arg. */
function filterEnd(line: string, from: number, arg: string): number {
  if (from > 0 || line.trim() === '') return -1
  let i = 0
  while (line[i] === ' ' || line[i] === '\t') i++
  return i <= Number(arg.split(':')[1]) ? 0 : -1
}

/** Whether pos directly follows the tag, with no space: %a{…}, not %a {text}. */
const touches = (line: string, pos: number) => pos > 0 && line[pos - 1] !== ' ' && line[pos - 1] !== '\t'

export const grammar: Grammar = {
  states: {
    root: [
      // :javascript, :css: the lines indented below are that language.
      { match: /^(\s*)(:[a-z]+)(\s*)$/, groups: [undefined, 'keyword', undefined], push: (t) => `@filter/${t.trim().slice(1)}:${t.length - t.trimStart().length}` },
      { match: /\s+/ },
      { match: /!!!.*/, token: 'meta', after: (p) => p === undefined },
      { match: /-#.*/, token: 'comment', after: (p) => p === undefined },
      { match: /\/.*/, token: 'comment', after: (p) => p === undefined },
      { match: /(=|-|!=|&=|~)(?=\s|$)/, token: 'operator', push: '@ruby', after: (p) => p === undefined || p.type === 'tag' || p.type === 'function' || p.text === '}' || p.text === ')' },
      { match: /%[\w:-]+/, token: 'tag', after: (p) => p === undefined },
      { match: /[.#][\w-]+/, token: 'function', after: (p) => p === undefined || p.type === 'tag' || p.type === 'function' },
      { match: (line, pos) => (line[pos] === '{' && touches(line, pos) ? 1 : -1), token: 'punctuation', push: '@hash', after: (p) => !!p && (p.type === 'tag' || p.type === 'function') },
      { match: /\}/, token: 'punctuation' },
      { match: (line, pos) => (line[pos] === '(' && touches(line, pos) ? 1 : -1), token: 'punctuation', push: 'attributes', after: (p) => !!p && (p.type === 'tag' || p.type === 'function') },
      { match: /[<>]=?(?=\s|$)|\/$/, token: 'operator', after: (p) => !!p && (p.type === 'tag' || p.type === 'function') },
      { match: /#\{/, token: 'escape', push: 'interpolation' },
      { match: /\\./, token: 'escape' },
      { match: /&[\w#]+;/, token: 'escape' },
      { match: /[^#\\&\s]+|[#\\&]/ },
    ],
    // (name="value" other=@x)
    attributes: [
      { match: /\)/, token: 'punctuation', pop: true },
      { match: /\s+/ },
      { match: /([\w:-]+)(\s*)(=)/, groups: ['property', undefined, 'operator'] },
      { match: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/, token: 'string' },
      { match: /@{1,2}\w+|\$\w+/, token: 'variable' },
      { match: /[\w:-]+/, token: 'property' },
    ],
    interpolation: [
      { match: /\}/, token: 'escape', pop: true },
      { match: /(?=[^}])/, push: '@interpolated' },
    ],
  },
  embeds: {
    ruby: { language: 'ruby', end: /$/ },
    hash: { language: 'ruby', end: /\}(?=[^}]*$)/ },
    interpolated: { language: 'ruby', end: /\}/ },
    filter: { language: (arg) => FILTERS[arg.split(':')[0]!] ?? '', end: filterEnd },
  },
}
