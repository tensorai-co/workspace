import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  import as public private function returns return if else foreach while break continue match in
  from where select let order by limit join on equals group collect check checkpanic panic trap fail
  service resource remote isolated final const var type record object client listener worker fork
  wait transaction retry commit rollback lock new typeof is error distinct readonly enum class
  configurable transactional do on fail
`)
const TYPES = words(`
  int float decimal string boolean byte json xml anydata any never future map table stream handle
`)
const CONSTANTS = words('true false null')
const VARIABLES = words('self')

function name(text: string): TokenType | undefined {
  if (VARIABLES.has(text)) return 'variable'
  if (KEYWORDS.has(text)) return 'keyword'
  if (TYPES.has(text)) return 'builtin'
  if (CONSTANTS.has(text)) return 'constant'
  if (/^[A-Z][A-Z\d_]+$/.test(text) && text.length > 1) return 'constant'
  if (/^[A-Z]/.test(text)) return 'type'
  return undefined
}

const IDENT = /[A-Za-z_]\w*/.source

// Ballerina: services, resources, records and string templates for network code.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /(resource)(\s+)(function)(\s+)([a-z]+)(\s+)([A-Za-z_]\w*|\.)/, groups: ['keyword', undefined, 'keyword', undefined, 'keyword', undefined, 'function'] },
      { match: /(string|xml|re)(?=\s*`)/, token: 'keyword' },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /"/, token: 'string', push: 'string0' },
      { match: /`/, token: 'string', push: 'string1' },
      { match: /@[A-Za-z_][\w:]*/, token: 'meta' },
      { match: new RegExp(`(class|enum|type|service|record|object)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'type'] },
      { match: new RegExp(`(function)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'function'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})(?=\\s*(?:<[\\w\\s,.<>?\\[\\]*&]*>)?\\()`), groups: ['punctuation', 'function'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})`), groups: ['punctuation', 'property'] },
      { match: new RegExp(`${IDENT}(?=\\s*(?:<[\\w\\s,.<>?\\[\\]*&]*>)?\\()`), token: (t) => name(t) ?? 'function' },
      { match: new RegExp(IDENT), token: name },
      { match: /0[xX][\da-fA-F_]+\w*|0[bB][01_]+\w*|0[oO][0-7_]+\w*|(?:\d[\d_]*(?:\.(?![.A-Za-z_])[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?\w*/, token: 'number' },
      { match: /=>|->|::|\.\.\.?|&&|\|\||<<=?|>>=?|[-+*/%&|^<>!=]=?|[~?:@#$]/, token: 'operator' },
      { match: /[()[\]{},;.]/, token: 'punctuation' },
    ],
    string0: [
      { match: /"/, token: 'string', pop: true },
      { match: /\\(?:x[\da-fA-F]{2}|u\{[\da-fA-F]+\}|u[\da-fA-F]{4}|.?)/, token: 'escape' },
      { match: /[^"\\]+/, token: 'string' },
      { match: /./, token: 'string' },
      { match: /$/, pop: true },
    ],
    string1: [
      { match: /`/, token: 'string', pop: true },
      { match: /\$\{/, token: 'escape', push: 'interpolation' },
      { match: /\\(?:x[\da-fA-F]{2}|u\{[\da-fA-F]+\}|u[\da-fA-F]{4}|.?)/, token: 'escape' },
      { match: /[^$\\`]+/, token: 'string' },
      { match: /./, token: 'string' },
    ],
    interpolation: [
      { match: /\}/, token: 'escape', pop: true },
      { match: /\{/, token: 'punctuation', push: 'braces' },
      { include: 'root' },
    ],
    braces: [
      { match: /\}/, token: 'punctuation', pop: true },
      { match: /\{/, token: 'punctuation', push: 'braces' },
      { include: 'root' },
    ],
    blockComment: [
      { match: /[^*\/]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /[*\/]/, token: 'comment' },
    ],
  },
}
