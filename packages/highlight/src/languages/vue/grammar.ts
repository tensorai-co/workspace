import type { Grammar } from '../../engine/grammar.js'
import { lengthAt } from '../../language.js'

// Vue single-file components: HTML with {{ }} and directives whose values
// are JavaScript, and <script lang="ts"> and <style lang="scss"> in their languages.

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
      { match: /&(?:#\d+|#[xX][\da-fA-F]+|[A-Za-z][\w]*);/, token: 'escape' },
      { match: /[^<&{]+|[<&{]/ },
    ],
    tag: [
      // <script lang="ts">, <style lang="scss">: the element's language.
      { match: (line, pos, name) => (RAW.has(name) ? lengthAt(LANG, line, pos) : -1), token: 'property', next: (_t, name) => `lang/${name}` },
      // > enters the element; for <style> and <script>, its language.
      { match: (line, pos, name) => (line[pos] === '>' && RAW.has(name.split(':')[0]!) ? 1 : -1), token: 'punctuation', next: (_t, name) => `@${name.replace(':', '/')}` },
      // v-if="…", :prop="…", @click="…", #slot="…": the value is JavaScript.
      { match: /((?:v-[\w-]+|[:@#])[^\s"'<>/=]*)(\s*)(=)(\s*)(")/, groups: ['keyword', undefined, 'operator', undefined, 'string'], push: '@double' },
      { match: /((?:v-[\w-]+|[:@#])[^\s"'<>/=]*)(\s*)(=)(\s*)(')/, groups: ['keyword', undefined, 'operator', undefined, 'string'], push: '@single' },
      { match: /["']/, token: 'string' },
      { match: /v-[\w-]+(?:[:.][\w.-]+)*/, token: 'keyword' }, // v-else, v-cloak
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
    script: { language: (lang) => lang || 'javascript', end: /<\/script/i },
    mustache: { language: 'javascript', end: /\}\}/ },
    double: { language: 'javascript', end: /"/ },
    single: { language: 'javascript', end: /'/ },
  },
}
