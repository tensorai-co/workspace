import type { Grammar } from '../../engine/grammar.js'
import { words } from '../../language.js'

const QUERIES = words('status version url header cookie body bytes xpath jsonpath regex variable duration sha256 md5 certificate ip redirects')
const PREDICATES = words('equals notEquals greaterThan lessThan startsWith endsWith contains matches exists isBoolean isCollection isDate isEmpty isFloat isInteger isIsoDate isNumber isString includes not count')
const FILTERS = words('count daysAfterNow daysBeforeNow decode format htmlEscape htmlUnescape jsonpath nth regex replace split toDate toFloat toInt urlDecode urlEncode xpath')

// Hurl: plain-text HTTP requests and their expected responses. A method and
// URL, headers, [Sections], HTTP status lines, {{templates}} and asserts.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /#.*/, token: 'comment' },
      { match: /(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|CONNECT|TRACE)(\s+)/, groups: ['keyword', undefined], push: 'url', after: (p) => p === undefined },
      { match: /(HTTP(?:\/[\d.]+)?)(\s+)(\d{3}|\*)/, groups: ['keyword', undefined, 'number'], after: (p) => p === undefined },
      { match: /\[[A-Za-z]+\]/, token: 'type', after: (p) => p === undefined }, // [Asserts], [QueryStringParams]
      { match: /```/, token: 'string', push: 'multiline' },
      { match: /\{\{/, token: 'escape', push: 'template' },
      { match: /[A-Za-z][\w-]*(?=\s*:)/, token: 'property', after: (p) => p === undefined }, // Accept:, name:
      { match: /"/, token: 'string', push: 'string' },
      { match: /`[^`\n]*`/, token: 'string' },
      { match: /[a-z][A-Za-z]*/, token: (t) => (QUERIES.has(t) ? 'builtin' : PREDICATES.has(t) ? 'keyword' : FILTERS.has(t) ? 'function' : t === 'true' || t === 'false' || t === 'null' ? 'constant' : undefined) },
      { match: /-?\d+(?:\.\d+)?/, token: 'number' },
      { match: /==|!=|>=|<=|[<>:]/, token: 'operator' },
      { match: /[{}[\],]/, token: 'punctuation' },
      { match: /\S+/ },
    ],
    url: [
      { match: /$/, pop: true },
      { match: /\{\{/, token: 'escape', push: 'template' },
      { match: /[^{\s]+|\{/, token: 'string' },
      { match: /\s+/ },
    ],
    template: [
      { match: /\}\}/, token: 'escape', pop: true },
      { match: /[^}]+|\}/, token: 'variable' },
    ],
    string: [
      { match: /"/, token: 'string', pop: true },
      { match: /\{\{/, token: 'escape', push: 'template' },
      { match: /\\./, token: 'escape' },
      { match: /[^"{\\]+|\{/, token: 'string' },
    ],
    multiline: [
      { match: /```/, token: 'string', pop: true },
      { match: /\{\{/, token: 'escape', push: 'template' },
      { match: /[^`{]+|[`{]/, token: 'string' },
    ],
  },
}
