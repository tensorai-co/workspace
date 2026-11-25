import type { Grammar } from '../../engine/grammar.js'

// templ: Go files with templ components. Outside a component it's Go; a
// component's body is HTML with { expressions }, @calls and Go's if, for and
// switch around them.

/** Elements whose content is another language. */
const RAW = new Set(['style', 'script'])

export const grammar: Grammar = {
  states: {
    root: [
      // templ Name(args) {, css name() {, script name() {
      { match: /^(templ)(\s+)(?:(\([^)]*\))(\s*))?([A-Za-z_]\w*)/, groups: ['keyword', undefined, 'variable', undefined, 'function'], push: 'signature' },
      { match: /^(css|script)(\s+)([A-Za-z_]\w*)/, groups: ['keyword', undefined, 'function'], push: 'signature' },
      // Anything else is Go, to the next component.
      { match: /(?=[\s\S])/, push: '@go' },
    ],
    // (args) {: Go, then the body.
    signature: [
      { match: /\{\s*$/, token: 'punctuation', next: 'body' },
      { match: /\(/, token: 'punctuation', push: 'params' },
      { match: /\s+/ },
      { match: /[^\s({]+/ },
    ],
    params: [
      { match: /\)/, token: 'punctuation', pop: true },
      { match: /(?=[^)])/, push: '@params' },
    ],
    // The body ends at the } that starts a line.
    body: [
      { match: /^\}/, token: 'punctuation', pop: true },
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment', after: (p) => p === undefined },
      // if x {, for _, i := range xs {, } else {, switch, case:
      { match: /(\}?)(\s*)(if|else if|else|for|switch|case|default)\b/, groups: ['punctuation', undefined, 'keyword'], push: '@control', after: (p) => p === undefined },
      { match: /\}/, token: 'punctuation', after: (p) => p === undefined },
      { match: /\{(?=\s*$)/, token: 'punctuation' }, // a block's {, after its Go
      { match: /(@)([A-Za-z_][\w.]*)/, groups: ['operator', 'function'], push: 'call' }, // @Button("Save")
      { match: /\{\{?/, token: 'escape', push: 'expression' },
      { match: /<!--/, token: 'comment', push: 'comment' },
      { match: /(<)([A-Za-z][\w:.-]*)/, groups: ['punctuation', 'tag'], push: (t) => `tag/${t.slice(1).toLowerCase()}` },
      { match: /(<\/)([A-Za-z][\w:.-]*)(\s*>)?/, groups: ['punctuation', 'tag', 'punctuation'] },
      { match: /&(?:#\d+|#[xX][\da-fA-F]+|[A-Za-z]\w*);/, token: 'escape' },
      { match: /[^<&{}@\s]+|[<&@]/ },
    ],
    tag: [
      { match: (line, pos, name) => (line[pos] === '>' && RAW.has(name) ? 1 : -1), token: 'punctuation', next: (_t, name) => `@${name}` },
      { match: /\/?>/, token: 'punctuation', pop: true },
      { match: /\s+/ },
      { match: /([^\s"'<>/={?]+)(\??)(=)(\s*)(\{)/, groups: ['property', 'operator', 'operator', undefined, 'escape'], push: 'expression' }, // href={ url }
      { match: /([^\s"'<>/={]+)(\s*)(=)/, groups: ['property', undefined, 'operator'] },
      { match: /\{/, token: 'escape', push: 'expression' }, // { attrs... }
      { match: /"[^"]*"?|'[^']*'?/, token: 'string' },
      { match: /[^\s"'<>/={]+/, token: 'property' },
      { match: /\//, token: 'punctuation' },
    ],
    expression: [
      { match: /\}\}?/, token: 'escape', pop: true },
      { match: /(?=[^}])/, push: '@expression' },
    ],
    call: [
      { match: /\(/, token: 'punctuation', push: 'params' },
      { match: /(?=\s*\{\s*$)/, next: 'children' },
      { match: /(?=.|$)/, pop: true },
    ],
    // @Card() { …children… }
    children: [
      { match: /\s*\{\s*$/, token: 'punctuation', next: 'childBody' },
    ],
    childBody: [
      { match: /^\s*\}/, token: 'punctuation', pop: true },
      { include: 'body' },
    ],
    comment: [
      { match: /-->/, token: 'comment', pop: true },
      { match: /[^-]+|-/, token: 'comment' },
    ],
  },
  embeds: {
    go: { language: 'go', end: /^(?=templ\s|css\s+\w+\s*\(|script\s+\w+\s*\()/ },
    params: { language: 'go', end: /\)(?![^(]*\))/ },
    expression: { language: 'go', end: /\}/ },
    control: { language: 'go', end: /\{\s*$|:\s*$/ },
    style: { language: 'css', end: /<\/style/i },
    script: { language: 'javascript', end: /<\/script/i },
  },
}
