import type { Grammar } from '../../engine/grammar.js'

// Marko: HTML with ${placeholders}, attribute values that are JavaScript,
// tags with arguments and |params| (<for|item| of=items>, <if(x)>), and
// lines of JavaScript after $, import, export, static and class.

/** Elements whose content is another language. */
const RAW = new Set(['style', 'script'])

/** Where an unquoted attribute value ends: a space or the tag's end, outside brackets and strings. */
function valueEnd(line: string, from: number): number {
  let depth = 0
  for (let i = from; i < line.length; i++) {
    const c = line[i]!
    if (c === '"' || c === "'" || c === '`') {
      const close = line.indexOf(c, i + 1)
      if (close < 0) return -1
      i = close
    } else if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') depth--
    else if (depth <= 0 && (c === ' ' || c === '\t' || c === '>' || (c === '/' && line[i + 1] === '>'))) return i
  }
  return depth <= 0 ? line.length : -1
}

export const grammar: Grammar = {
  states: {
    root: [
      { match: /<!--/, token: 'comment', push: 'comment' },
      { match: /\/\/.*/, token: 'comment', after: (p) => p === undefined },
      { match: /<!(?:DOCTYPE|doctype)[^>]*>?/, token: 'meta' },
      // $ const total = 1;  import x from "y"  static const n = 1
      { match: /(\$)(\s)/, groups: ['keyword', undefined], push: '@line', after: (p) => p === undefined },
      { match: /(?:import|export|static)\b/, token: 'keyword', push: '@line', after: (p) => p === undefined },
      { match: /(class)(\s*)(\{)/, groups: ['keyword', undefined, 'punctuation'], push: '@class', after: (p) => p === undefined },
      // A tag's state remembers its name: <style> and <script> hold CSS and JavaScript.
      { match: /(<)([A-Za-z@][\w:-]*)/, groups: ['punctuation', 'tag'], push: (t) => `tag/${t.slice(1).toLowerCase()}` },
      { match: /(<\/)([A-Za-z@][\w:-]*)?(\s*>)/, groups: ['punctuation', 'tag', 'punctuation'] },
      { match: /\$!?\{/, token: 'escape', push: 'placeholder' },
      { match: /&(?:#\d+|#[xX][\da-fA-F]+|[A-Za-z][\w]*);/, token: 'escape' },
      { match: /\}(?=\s*$)/, token: 'punctuation', after: (p) => p === undefined }, // the class block's end
      { match: /[^<&$}]+|[<&$}]/ },
    ],
    tag: [
      { match: (line, pos, name) => (line[pos] === '>' && RAW.has(name) ? 1 : -1), token: 'punctuation', next: (_t, name) => `@${name}` },
      { match: /\/?>/, token: 'punctuation', pop: true },
      { match: /\s+/ },
      { match: /\|/, token: 'punctuation', push: 'params' }, // <for|item, i| of=list>
      { match: /\(/, token: 'punctuation', push: 'args' }, // <if(cond)>
      { match: /[.#][\w-]+/, token: 'function' }, // <div.card#main>
      { match: /([^\s"'<>/=|(]+)(\s*)(=)(\s*)/, groups: ['property', undefined, 'operator', undefined], push: 'value' },
      { match: /[^\s"'<>/=|(]+/, token: 'property' },
      { match: /\//, token: 'punctuation' },
    ],
    // An attribute's value is JavaScript: count=input.count, class="a ${b}"
    value: [
      { match: /"/, token: 'string', next: 'double' },
      { match: /'/, token: 'string', next: 'single' },
      { match: /(?=[^\s>"'])/, next: '@attr' },
      { match: /(?=\s|\/?>|$)/, pop: true },
    ],
    params: [
      { match: /\|/, token: 'punctuation', pop: true },
      { match: /[A-Za-z_$][\w$]*/, token: 'variable' },
      { match: /[^|A-Za-z_$]+/, token: 'punctuation' },
    ],
    args: [
      { match: /\)/, token: 'punctuation', pop: true },
      { match: /(?=[^)])/, push: '@args' },
    ],
    placeholder: [
      { match: /\}/, token: 'escape', pop: true },
      { match: /(?=[^}])/, push: '@placeholder' },
    ],
    double: [
      { match: /"/, token: 'string', pop: true },
      { match: /\$!?\{/, token: 'escape', push: 'placeholder' },
      { match: /[^"$]+|\$/, token: 'string' },
    ],
    single: [
      { match: /'/, token: 'string', pop: true },
      { match: /\$!?\{/, token: 'escape', push: 'placeholder' },
      { match: /[^'$]+|\$/, token: 'string' },
    ],
    comment: [
      { match: /-->/, token: 'comment', pop: true },
      { match: /[^-]+|-/, token: 'comment' },
    ],
  },
  embeds: {
    style: { language: 'css', end: /<\/style/i },
    script: { language: 'javascript', end: /<\/script/i },
    line: { language: 'javascript', end: /$/ },
    class: { language: 'javascript', end: /^\}/ },
    attr: { language: 'javascript', end: valueEnd },
    args: { language: 'javascript', end: /\)(?=\s*[|/>\s])/ },
    placeholder: { language: 'javascript', end: /\}/ },
  },
}
