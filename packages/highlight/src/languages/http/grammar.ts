import type { Grammar } from '../../engine/grammar.js'

// Raw HTTP: a request or status line, headers, a blank line, then a body,
// as in .http files (### separates requests). A JSON body is colored as JSON.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /###.*/, token: 'comment', after: (p) => p === undefined },
      { match: /(?:#|\/\/).*/, token: 'comment', after: (p) => p === undefined },
      { match: /(@)([\w-]+)(\s*=\s*)(.*)/, groups: ['operator', 'variable', 'operator', 'string'], after: (p) => p === undefined }, // @host = …
      // GET /path HTTP/1.1
      { match: /(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|CONNECT|TRACE)(\s+)(\S+)(?:(\s+)(HTTP\/[\d.]+))?/, groups: ['keyword', undefined, 'string', undefined, 'meta'], next: 'headers', after: (p) => p === undefined },
      // HTTP/1.1 200 OK
      { match: /(HTTP\/[\d.]+)(\s+)(\d{3})(.*)/, groups: ['meta', undefined, 'number', 'string'], next: 'headers', after: (p) => p === undefined },
      { include: 'variables' },
    ],
    headers: [
      { match: /###.*/, token: 'comment', next: 'root', after: (p) => p === undefined },
      { match: (line, pos) => (pos === 0 && line.trim() === '' ? line.length || 0 : -1), next: 'body' },
      { match: /([\w-]+)(:)(.*)/, groups: ['property', 'punctuation', 'string'], after: (p) => p === undefined },
      { include: 'variables' },
    ],
    // A JSON body runs as JSON to the next ###; anything else is plain.
    body: [
      { match: /###.*/, token: 'comment', next: 'root', after: (p) => p === undefined },
      { match: /(?=\s*[[{])/, push: '@json', after: (p) => p === undefined },
      { include: 'variables' },
      { match: /.+/ },
    ],
    variables: [
      { match: /\{\{[^}\n]*\}\}/, token: 'variable' }, // {{host}}
      { match: /\s+/ },
    ],
  },
  embeds: {
    json: { language: 'json', end: (line, from) => (from === 0 && line.startsWith('###') ? 0 : -1) },
  },
}
