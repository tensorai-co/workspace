import type { Grammar } from '../../engine/grammar.js'
import { words } from '../../language.js'

const COMMANDS = words(`
  namespace template deltemplate delpackage element param let if elseif else switch case default for
  foreach ifempty call delcall msg fallbackmsg plural select print literal sp nil lb rb r n t log
  debugger css xid alias
`)
const CONSTANTS = words('true false null')
const OPERATORS = words('and or not in')

// Closure Templates (Soy): HTML with {commands}, {$variables} and
// {/endings}, and // and /* */ comments between them.

/** Elements whose content is another language. */
const RAW = new Set(['style', 'script'])

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\{literal\}/, token: 'keyword', push: 'literal' },
      { match: /\{/, token: 'punctuation', push: 'command' },
      { match: /(?:^|\s)\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'comment' },
      { match: /<!--/, token: 'comment', push: 'htmlComment' },
      { match: /(<)([A-Za-z][\w:-]*)/, groups: ['punctuation', 'tag'], push: (t) => `tag/${t.slice(1).toLowerCase()}` },
      { match: /(<\/)([A-Za-z][\w:-]*)(\s*>)?/, groups: ['punctuation', 'tag', 'punctuation'] },
      { match: /&(?:#\d+|#[xX][\da-fA-F]+|[A-Za-z]\w*);/, token: 'escape' },
      { match: /[^<&{/]+|[<&/]/ },
    ],
    tag: [
      { match: (line, pos, name) => (line[pos] === '>' && RAW.has(name) ? 1 : -1), token: 'punctuation', next: (_t, name) => `@${name}` },
      { match: /\/?>/, token: 'punctuation', pop: true },
      { match: /\s+/ },
      { match: /\{/, token: 'punctuation', push: 'command' },
      { match: /([^\s"'<>/={]+)(\s*)(=)/, groups: ['property', undefined, 'operator'] },
      { match: /"/, token: 'string', push: 'double' },
      { match: /'/, token: 'string', push: 'single' },
      { match: /[^\s"'<>/={]+/, token: 'property' },
      { match: /\//, token: 'punctuation' },
    ],
    // {template .name}, {if $x > 1}, {/if}, {$name |escapeHtml}
    command: [
      { match: /\/?\}/, token: 'punctuation', pop: true },
      { match: /\s+/ },
      { match: /(template|deltemplate|element)(\s+)([\w.]+)/, groups: ['keyword', undefined, 'function'] },
      { match: /(call|delcall)(\s+)([\w.]+)/, groups: ['keyword', undefined, 'function'] },
      { match: /\/?[a-z]+/, token: (t) => (COMMANDS.has(t.replace('/', '')) ? 'keyword' : OPERATORS.has(t) ? 'operator' : CONSTANTS.has(t) ? 'constant' : undefined), after: (p) => p?.text === '{' },
      { match: /\$[\w.]+|@[\w]+/, token: 'variable' },
      { match: /\|[\w]+/, token: 'builtin' }, // a print directive: |escapeHtml
      { match: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/, token: 'string' },
      { match: /\d+(?:\.\d+)?/, token: 'number' },
      { match: /[a-zA-Z_]\w*(?=\()/, token: 'builtin' },
      { match: /[a-zA-Z_]\w*(?==)/, token: 'property' },
      { match: /[a-zA-Z_][\w.]*/, token: (t) => (OPERATORS.has(t) ? 'operator' : CONSTANTS.has(t) ? 'constant' : undefined) },
      { match: /==|!=|<=|>=|\?:|[-+*/%<>=?:!]/, token: 'operator' },
      { match: /[()[\],.]/, token: 'punctuation' },
    ],
    literal: [
      { match: /\{\/literal\}/, token: 'keyword', pop: true },
      { match: /[^{]+|\{/, token: 'string' },
    ],
    double: [
      { match: /"/, token: 'string', pop: true },
      { match: /\{/, token: 'punctuation', push: 'command' },
      { match: /[^"{]+/, token: 'string' },
    ],
    single: [
      { match: /'/, token: 'string', pop: true },
      { match: /\{/, token: 'punctuation', push: 'command' },
      { match: /[^'{]+/, token: 'string' },
    ],
    comment: [
      { match: /\*\//, token: 'comment', pop: true },
      { match: /[^*]+|\*/, token: 'comment' },
    ],
    htmlComment: [
      { match: /-->/, token: 'comment', pop: true },
      { match: /[^-]+|-/, token: 'comment' },
    ],
  },
  embeds: {
    style: { language: 'css', end: /<\/style/i },
    script: { language: 'javascript', end: /<\/script/i },
  },
}
