import type { Grammar } from '../../engine/grammar.js'
import { words } from '../../language.js'

// Liquid templates (Shopify, Jekyll): HTML with {{ output | filters }} and {% tags %}, and YAML front matter.
const KEYWORDS = words(`
  if elsif else endif unless endunless case when endcase for in endfor break continue assign
  capture endcapture increment decrement include render layout section sections schema endschema
  form endform paginate endpaginate comment endcomment raw endraw liquid echo tablerow endtablerow
  cycle contains and or limit offset reversed with as
`)
const CONSTANTS = words('true false nil null empty blank forloop')

/** Elements whose content is another language. */
const RAW = new Set(['style', 'script'])

export const grammar: Grammar = {
  states: {
    root: [
      { match: /---\s*$/, token: 'meta', push: 'frontmatter', after: (p) => p === undefined },
      { include: 'template' },
      { match: /<!--/, token: 'comment', push: 'comment' },
      { match: /<!(?:DOCTYPE|doctype)[^>]*>?/, token: 'meta' },
      { match: /<!\[CDATA\[/, token: 'meta', push: 'cdata' },
      // A tag's state remembers its name: <style> and <script> hold CSS and JavaScript.
      { match: /(<)([A-Za-z][\w:-]*)/, groups: ['punctuation', 'tag'], push: (t) => `tag/${t.slice(1).toLowerCase()}` },
      { match: /(<\/)([A-Za-z][\w:-]*)(\s*>)?/, groups: ['punctuation', 'tag', 'punctuation'] },
      { match: /&(?:#\d+|#[xX][\da-fA-F]+|[A-Za-z][\w]*);/, token: 'escape' },
      { match: /[^<&{]+|[<&{]/ },
    ],
    tag: [
      // > enters the element; for <style> and <script>, its language.
      { match: (line, pos, name) => (line[pos] === '>' && RAW.has(name) ? 1 : -1), token: 'punctuation', next: (_t, name) => `@${name}` },
      { match: /\/?>/, token: 'punctuation', pop: true },
      { match: /\s+/ },
      { include: 'template' },
      { match: /([^\s"'<>/=]+)(\s*)(=)/, groups: ['property', undefined, 'operator'], push: 'value' },
      { match: /[^\s"'<>/=]+/, token: 'property' },
      { match: /\//, token: 'punctuation' },
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
      { include: 'template' },
      { match: /[^"&{]+/, token: 'string' },
      { match: /&(?:#\d+|#[xX][\da-fA-F]+|[A-Za-z]\w*);/, token: 'escape' },
      { match: /[&{]/, token: 'string' },
      { match: /"/, token: 'string', pop: true },
    ],
    single: [
      { include: 'template' },
      { match: /[^'&{]+/, token: 'string' },
      { match: /&(?:#\d+|#[xX][\da-fA-F]+|[A-Za-z]\w*);/, token: 'escape' },
      { match: /[&{]/, token: 'string' },
      { match: /'/, token: 'string', pop: true },
    ],
    template: [
      { match: /(\{%-?)(\s*)([A-Za-z_]\w*)?/, groups: ['meta', undefined, 'keyword'], push: 'statement' },
      { match: /\{\{-?/, token: 'meta', push: 'expression' },
    ],
    // Inside the delimiters: an expression, with filters (a | upper) and tests.
    expr: [
      { match: /\s+/ },
      { match: /"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?/, token: 'string' },
      { match: /(\|)(\s*)([A-Za-z_]\w*)/, groups: ['operator', undefined, 'function'] },
      { match: /(\.)([A-Za-z_]\w*)/, groups: ['punctuation', 'property'] },
      { match: /[A-Za-z_]\w*(?=\s*\()/, token: (t) => (KEYWORDS.has(t) ? 'keyword' : 'function') },
      { match: /[A-Za-z_]\w*(?=\s*[:=](?!=))/, token: 'property', after: (p) => !!p && (p.text === ',' || p.text === '(' || p.type === 'function') },
      { match: /[A-Za-z_]\w*/, token: (t) => (KEYWORDS.has(t) ? 'keyword' : CONSTANTS.has(t) ? 'constant' : undefined) },
      { match: /-?\d+(?:\.\d+)?/, token: 'number' },
      { match: /==|!=|<=|>=|\*\*|\/\/|\.\.|[-+*/%<>=~?:!]/, token: 'operator' },
      { match: /[()[\]{},]/, token: 'punctuation' },
    ],
    statement: [
      { match: /-?%\}/, token: 'meta', pop: true },
      { include: 'expr' },
    ],
    expression: [
      { match: /-?\}\}/, token: 'meta', pop: true },
      { include: 'expr' },
    ],
    // The frontmatter: --- on the first line, then --- again.
    frontmatter: [
      { match: (line, pos) => (pos === 0 && /^---\s*$/.test(line) ? line.length : -1), token: 'meta', pop: true },
      { match: (line, pos) => (pos === line.length ? 0 : -1), push: '@front' },
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
    style: { language: 'css', end: /<\/style/i },
    script: { language: 'javascript', end: /<\/script/i },

    front: { language: 'yaml', end: (line, from) => (from === 0 && /^---\s*$/.test(line) ? 0 : -1) },
  },
}
