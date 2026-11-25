import type { Grammar } from '../../engine/grammar.js'

// ASP.NET Razor (.cshtml, Blazor): HTML with C# after @: @Model.Name, @(…), @{ … }, @if (…).

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
      { include: 'template' },
      { match: /<!--/, token: 'comment', push: 'comment' },
      { match: /<!(?:DOCTYPE|doctype)[^>]*>?/, token: 'meta' },
      { match: /<!\[CDATA\[/, token: 'meta', push: 'cdata' },
      // A tag's state remembers its name: <style> and <script> hold CSS and JavaScript.
      { match: /(<)([A-Za-z][\w:-]*)/, groups: ['punctuation', 'tag'], push: (t) => `tag/${t.slice(1).toLowerCase()}` },
      { match: /(<\/)([A-Za-z][\w:-]*)(\s*>)?/, groups: ['punctuation', 'tag', 'punctuation'] },
      { match: /&(?:#\d+|#[xX][\da-fA-F]+|[A-Za-z][\w]*);/, token: 'escape' },
      { match: /[^<&@]+|[<&@]/ },
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
      { match: /[^"&@]+/, token: 'string' },
      { match: /&(?:#\d+|#[xX][\da-fA-F]+|[A-Za-z]\w*);/, token: 'escape' },
      { match: /[&@]/, token: 'string' },
      { match: /"/, token: 'string', pop: true },
    ],
    single: [
      { include: 'template' },
      { match: /[^'&@]+/, token: 'string' },
      { match: /&(?:#\d+|#[xX][\da-fA-F]+|[A-Za-z]\w*);/, token: 'escape' },
      { match: /[&@]/, token: 'string' },
      { match: /'/, token: 'string', pop: true },
    ],
    template: [
      { match: /@\*/, token: 'comment', push: 'comment2' },
      { match: /@@/, token: 'escape' },
      { match: /@\((?=.*\))/, token: 'meta', push: '@paren' },
      { match: /@\{(?=.*\}\s*$)/, token: 'meta', push: '@braceLine' }, // @{ var x = 1; }
      { match: /@\{/, token: 'meta', push: '@block' },
      { match: /(@(?:if|else if|foreach|for|while|switch|using|lock|try|catch))(\s*)(\()/, groups: ['keyword', undefined, 'punctuation'], push: '@paren' },
      { match: /@(?:else|try|finally|do)\b/, token: 'keyword' },
      { match: /(@(?:model|using|inject|page|namespace|inherits|layout|implements|attribute|section|code|functions|rendermode|typeparam))(\s+)([\w.<>]+)?/, groups: ['keyword', undefined, 'type'] },
      { match: /(?<![\w.])@[A-Za-z_]\w*/, token: 'variable', push: 'implicit' },
      { match: /^\s*\}\s*$|^\s*\}(?=\s*else)/, token: 'meta' }, // a C# block's closing }
      { match: /\)/, token: 'punctuation' }, // closes @( … ) and @if ( … )
    ],
    // @Model.City.ToUpper(): a chain of members and calls.
    implicit: [
      { match: /(\.)([A-Za-z_]\w*)(?=\()/, groups: ['punctuation', 'function'] },
      { match: /(\.)([A-Za-z_]\w*)/, groups: ['punctuation', 'property'] },
      { match: /\(/, token: 'punctuation', next: '@paren' },
      { match: /(?=.)|$/, pop: true },
    ],
    comment2: [
      { match: /\*@/, token: 'comment', pop: true },
      { match: /[^*]+|\*/, token: 'comment' },
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
    paren: { language: 'csharp', end: closing('(', ')') },
    braceLine: { language: 'csharp', end: /\}\s*$/ },
    block: { language: 'csharp', end: (line, from) => (/^\s*\}\s*$/.test(line) ? line.indexOf('}') : -1) },
  },
}
