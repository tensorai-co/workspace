import type { Grammar } from '../../engine/grammar.js'
import type { Token } from '../../tokens.js'
import { words } from '../../language.js'

/** The names a reference starts with: var.region, module.vpc.id, each.key. */
const REFERENCES = words('var local module data each count path self terraform')
const FUNCTIONS = words(`
  abs ceil floor log max min parseint pow signum chomp endswith format formatlist indent join lower
  regex regexall replace split startswith strcontains strrev substr templatestring title trim
  trimprefix trimspace trimsuffix upper alltrue anytrue chunklist coalesce coalescelist compact
  concat contains distinct element flatten index keys length list lookup map matchkeys merge one
  range reverse setintersection setproduct setsubtract setunion slice sort sum transpose values
  zipmap base64decode base64encode base64gzip csvdecode jsondecode jsonencode textdecodebase64
  textencodebase64 urlencode yamldecode yamlencode abspath dirname pathexpand basename file
  fileexists fileset filebase64 templatefile formatdate plantimestamp timeadd timecmp timestamp
  base64sha256 base64sha512 bcrypt filebase64sha256 filemd5 filesha1 filesha256 md5 sha1 sha256
  sha512 uuid uuidv5 cidrhost cidrnetmask cidrsubnet cidrsubnets can ephemeralasnull issensitive
  nonsensitive sensitive tobool tolist tomap tonumber toset tostring try type
`)

/** A block's type starts a line: service "web" {, locals {. */
const blockStart = (prev: Token | undefined) => prev === undefined

/** An object's key starts a line, or follows { or ,: not cond ? "a" : "b". */
const keyAllowed = (prev: Token | undefined) => !prev || prev.text === '{' || prev.text === ','

/** The word a heredoc ends at, from its opening: <<EOF, <<-EOT. */
function heredoc(text: string): string {
  return (text.startsWith('<<-') ? 'heredoc/-' : 'heredoc/') + text.replace(/^<<-?/, '')
}

export const grammar: Grammar = {
  states: {
    root: [
      { match: /[A-Za-z_][\w-]*(?=(?:\s+(?:"[^"\n]*"|[A-Za-z_][\w-]*))*\s*\{)/, token: 'keyword', after: blockStart },
      { include: 'expression' },
    ],
    expression: [
      { match: /\s+/ },
      { match: /(?:#|\/\/).*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /<<-?[A-Za-z_]\w*/, token: 'string', push: heredoc },
      { match: /"/, token: 'string', push: 'string' },
      { match: /[A-Za-z_][\w-]*(?=\s*=(?!=))/, token: 'property' },
      { match: /(?:for|in|if)(?![\w-])/, token: 'keyword' },
      { match: /(?:true|false|null)(?![\w-])/, token: 'constant' },
      { match: /[A-Za-z_][\w-]*(?=\s*\()/, token: (t) => (FUNCTIONS.has(t) ? 'builtin' : 'function') },
      { match: /(\.)([A-Za-z_][\w-]*)/, groups: ['punctuation', 'property'] },
      { match: /[A-Za-z_][\w-]*(?=\.)/, token: (t) => (REFERENCES.has(t) ? 'variable' : undefined) },
      { match: /(?:string|number|bool|any)(?![\w-])/, token: 'builtin' },
      { match: /[A-Za-z_][\w-]*/ },
      { match: /\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, token: 'number' },
      { match: /\{/, token: 'punctuation', push: 'braces' },
      { match: /=>|==|!=|<=|>=|&&|\|\||\.\.\.|[-+*/%<>!?:=]/, token: 'operator' },
      { match: /[()[\],.]/, token: 'punctuation' },
    ],
    // A block body or an object: attributes, nested blocks, to the closing }.
    braces: [
      { match: /\}/, token: 'punctuation', pop: true },
      { match: /[A-Za-z_][\w-]*(?=(?:\s+(?:"[^"\n]*"|[A-Za-z_][\w-]*))*\s*\{)/, token: 'keyword', after: blockStart },
      { match: /(?:"[^"\n]*"|[A-Za-z_][\w-]*)(?=\s*:(?!:))/, token: 'property', after: keyAllowed },
      { include: 'expression' },
    ],
    // "…${expr}…%{ if x }…%{ endif }"
    template: [
      { match: /\$\$\{|%%\{/, token: 'escape' },
      { match: /\$\{~?/, token: 'escape', push: 'interpolation' },
      { match: /%\{~?/, token: 'escape', push: 'directive' },
    ],
    string: [
      { match: /[^"\\$%]+/, token: 'string' },
      { match: /\\(?:u[\da-fA-F]{4}|U[\da-fA-F]{8}|.?)/, token: 'escape' },
      { include: 'template' },
      { match: /[$%]/, token: 'string' },
      { match: /"/, token: 'string', pop: true },
      { match: /$/, pop: true },
    ],
    interpolation: [
      { match: /~?\}/, token: 'escape', pop: true },
      { include: 'expression' },
    ],
    directive: [
      { match: /~?\}/, token: 'escape', pop: true },
      { match: /(?:if|else|endif|for|in|endfor)(?![\w-])/, token: 'keyword' },
      { include: 'expression' },
    ],
    // Lines up to the closing word, alone on its line (indented, with <<-).
    heredoc: [
      {
        match: (line, pos, arg) => {
          const word = arg.replace(/^-/, '')
          const text = arg.startsWith('-') ? line.trim() : line
          return pos === 0 && text === word ? line.length : -1
        },
        token: 'string',
        pop: true,
      },
      { include: 'template' },
      { match: /[^$%]+|[$%]/, token: 'string' },
    ],
    blockComment: [
      { match: /[^*]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /\*/, token: 'comment' },
    ],
  },
}
