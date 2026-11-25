import type { Grammar } from '../../engine/grammar.js'
import { words } from '../../language.js'

// Twig templates (Symfony): HTML with {{ expressions }}, {% tags %} and {# comments #}.
const KEYWORDS = words(`
  if elseif else endif for in endfor block endblock extends include embed endembed use set endset
  macro endmacro import from with endwith only filter endfilter apply endapply autoescape
  endautoescape verbatim endverbatim do flush deprecated sandbox endsandbox not and or b-and b-or
  b-xor matches starts ends is defined empty same as divisible by iterable null
`)
const CONSTANTS = words('true false null none loop _self')

/** Elements whose content is another language. */
const RAW = new Set(['style', 'script'])

export const grammar: Grammar = {
  states: {
    root: [
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
      { match: /\{#/, token: 'comment', push: 'comment2' },
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
      { match: /==|!=|<=|>=|\*\*|\/\/|\.\.|[-+*/%<>=~?:!~]/, token: 'operator' },
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
    comment2: [
      { match: /#\}/, token: 'comment', pop: true },
      { match: /[^#]+|#/, token: 'comment' },
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
  },
}
