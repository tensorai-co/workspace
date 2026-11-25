import type { Grammar } from '../../engine/grammar.js'

// Astro components: TypeScript frontmatter between ---, then HTML with {expressions}.

/** closing finds where a bracket that's already open closes on this line, or -1. */
function closing(open: string, close: string) {
  return (line: string, from: number) => {
    let depth = 1
    for (let i = from; i < line.length; i++) {
      if (line[i] === open) depth++
      else if (line[i] === close && --depth === 0) return i
    }
    return -1
  }
}

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
      // name={…}: the value is an expression.
      { match: /([^\s"'<>/={]+)(\s*)(=)(\s*)(\{)/, groups: ['property', undefined, 'operator', undefined, 'punctuation'], push: '@expression' },
      { match: /\{/, token: 'punctuation', push: '@expression' },
      { match: /\}/, token: 'punctuation' },
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
    expression: { language: 'tsx', end: closing('{', '}') },
    front: { language: 'typescript', end: (line, from) => (from === 0 && /^---\s*$/.test(line) ? 0 : -1) },
  },
}
