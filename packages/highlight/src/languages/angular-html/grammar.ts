import type { Grammar } from '../../engine/grammar.js'
import { lengthAt } from '../../language.js'

// Angular templates: HTML with {{ interpolation }}, [property], (event),
// [(two-way)] and *structural bindings, #references, and @if, @for,
// @switch and @defer blocks. Expressions are TypeScript.

/** Elements whose content is another language. */
const RAW = new Set(['style', 'script'])
/** lang="ts" on a <script> or <style>. */
const LANG = /lang(?=\s*=)/y

export const grammar: Grammar = {
  states: {
    root: [
      { match: /<!--/, token: 'comment', push: 'comment' },
      { match: /<!(?:DOCTYPE|doctype)[^>]*>?/, token: 'meta' },
      { match: /<!\[CDATA\[/, token: 'meta', push: 'cdata' },
      // A tag's state remembers its name: <style> and <script> hold CSS and JavaScript.
      { match: /(<)([A-Za-z][\w:-]*)/, groups: ['punctuation', 'tag'], push: (t) => `tag/${t.slice(1).toLowerCase()}` },
      { match: /(<\/)([A-Za-z][\w:-]*)(\s*>)?/, groups: ['punctuation', 'tag', 'punctuation'] },
      // {{ expression }}
      { match: /\{\{/, token: 'escape', push: '@mustache' },
      { match: /\}\}/, token: 'escape' },
      // @if (cond) {, } @else {, @for (item of items; track item.id) {
      { match: /@(?:if|else\s+if|else|for|switch|case|default|defer|placeholder|loading|error|empty)\b/, token: 'keyword' },
      { match: /(@let)(\s+)([A-Za-z_$][\w$]*)(\s*)(=)/, groups: ['keyword', undefined, 'variable', undefined, 'operator'], push: '@statement' },
      { match: /\(/, token: 'punctuation', push: '@block', after: (p) => p?.type === 'keyword' },
      { match: /[{}()]/, token: 'punctuation' },
      { match: /&(?:#\d+|#[xX][\da-fA-F]+|[A-Za-z][\w]*);/, token: 'escape' },
      { match: /[^<&{}()@]+|[<&@]/ },
    ],
    tag: [
      // <script lang="ts">, <style lang="scss">: the element's language.
      { match: (line, pos, name) => (RAW.has(name) ? lengthAt(LANG, line, pos) : -1), token: 'property', next: (_t, name) => `lang/${name}` },
      // > enters the element; for <style> and <script>, its language.
      { match: (line, pos, name) => (line[pos] === '>' && RAW.has(name.split(':')[0]!) ? 1 : -1), token: 'punctuation', next: (_t, name) => `@${name.replace(':', '/')}` },
      // [prop]="…", (event)="…", [(ngModel)]="…", *ngIf="…": the value is TypeScript.
      { match: /(\[\(?[\w.@-]+\)?\]|\([\w.:@-]+\)|\*[\w-]+|(?:bind|on|bindon)-[\w-]+)(\s*)(=)(\s*)(")/, groups: ['keyword', undefined, 'operator', undefined, 'string'], push: '@double' },
      { match: /(\[\(?[\w.@-]+\)?\]|\([\w.:@-]+\)|\*[\w-]+|(?:bind|on|bindon)-[\w-]+)(\s*)(=)(\s*)(')/, groups: ['keyword', undefined, 'operator', undefined, 'string'], push: '@single' },
      { match: /["']/, token: 'string' },
      { match: /#[\w-]+|let-[\w-]+/, token: 'variable' }, // #ref, let-item
      { match: /\/?>/, token: 'punctuation', pop: true },
      { match: /\s+/ },
      { match: /([^\s"'<>/=]+)(\s*)(=)/, groups: ['property', undefined, 'operator'], push: 'value' },
      { match: /[^\s"'<>/=]+/, token: 'property' },
      { match: /\//, token: 'punctuation' },
    ],
    // lang="ts": the language goes into the tag's state, tag/script:ts.
    lang: [
      { match: /\s*=\s*/, token: 'operator' },
      { match: /(["']?)[\w-]+\1/, token: 'string', next: (text, name) => `tag/${name}:${text.replace(/["']/g, '')}` },
      { match: /(?=.)/, next: (_t, name) => `tag/${name}` },
    ],
    // An attribute's value: quoted, or a run of characters.
    value: [
      { match: /\s+/ },
      { match: /"/, token: 'string', next: 'double' },
      { match: /'/, token: 'string', next: 'single' },
      { match: /[^\s"'<>=`]+/, token: 'string', pop: true },
      { match: /(?=[>/]|$)/, pop: true },
    ],
    double: [
      { match: /[^"&]+/, token: 'string' },
      { match: /&(?:#\d+|#[xX][\da-fA-F]+|[A-Za-z]\w*);/, token: 'escape' },
      { match: /&/, token: 'string' },
      { match: /"/, token: 'string', pop: true },
    ],
    single: [
      { match: /[^'&]+/, token: 'string' },
      { match: /&(?:#\d+|#[xX][\da-fA-F]+|[A-Za-z]\w*);/, token: 'escape' },
      { match: /&/, token: 'string' },
      { match: /'/, token: 'string', pop: true },
    ],
    comment: [
      { match: /-->/, token: 'comment', pop: true },
      { match: /[^-]+|-/, token: 'comment' },
    ],
    cdata: [
      { match: /\]\]>/, token: 'meta', pop: true },
      { match: /[^\]]+|\]/, token: 'string' },
    ],
  },
  embeds: {
    style: { language: (lang) => lang || 'css', end: /<\/style/i },
    script: { language: (lang) => lang || 'typescript', end: /<\/script/i },
    mustache: { language: 'typescript', end: /\}\}/ },
    double: { language: 'typescript', end: /"/ },
    single: { language: 'typescript', end: /'/ },
    block: { language: 'typescript', end: /\)(?=\s*\{)/ },
    statement: { language: 'typescript', end: /;/ },
  },
}
