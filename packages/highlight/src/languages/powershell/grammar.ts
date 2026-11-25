import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

// PowerShell. Keywords, cmdlets and operators are any case.
const KEYWORDS = words(`
  begin break catch class clean continue data define do dynamicparam else elseif end enum exit
  filter finally for foreach from function hidden if in param process return static switch throw
  trap try until using var while workflow parallel sequence inlinescript
`)
const CONSTANTS = words('$true $false $null')
const VARIABLES = words('$_ $this $psitem $args $input $pscmdlet $psboundparameters $myinvocation $error $host $home $pwd $lastexitcode')

function name(text: string): TokenType | undefined {
  const lower = text.toLowerCase()
  if (KEYWORDS.has(lower)) return 'keyword'
  return undefined
}

const VARIABLE = /\$(?:\{[^}\n]*\}|(?:[A-Za-z_][\w]*:)?[A-Za-z_]\w*|[?^$_])/.source

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /<#/, token: 'comment', push: 'blockComment' },
      { match: /#.*/, token: 'comment' },
      { match: /@"\s*$/, token: 'string', push: 'hereDouble' },
      { match: /@'\s*$/, token: 'string', push: 'hereSingle' },
      { match: /"/, token: 'string', push: 'double' },
      { match: /'/, token: 'string', push: 'single' },
      { match: new RegExp(VARIABLE), token: (t) => (CONSTANTS.has(t.toLowerCase()) ? 'constant' : 'variable') },
      { match: /(\[)([A-Za-z_][\w.]*)(?=\()/, groups: ['punctuation', 'meta'] }, // [CmdletBinding()], [Parameter(Mandatory)]
      { match: /\[[A-Za-z_][\w.`[\], ]*\](?!\s*=)/, token: 'type' }, // [string], [System.IO.File]
      { match: /(function|filter|workflow)(\s+)([\w-]+)/i, groups: ['keyword', undefined, 'function'] },
      { match: /(class|enum)(\s+)(\w+)/i, groups: ['keyword', undefined, 'type'] },
      // -eq, -like, -and, -replace…; and a cmdlet's -Parameter.
      { match: /-(?:eq|ne|gt|ge|lt|le|like|notlike|match|notmatch|contains|notcontains|in|notin|replace|split|join|and|or|xor|not|band|bor|bxor|bnot|shl|shr|is|isnot|as|f|c?eq|i?eq)\b/i, token: 'operator' },
      { match: /-[A-Za-z_][\w-]*/, token: 'property' },
      { match: /[A-Za-z]+-[A-Za-z][\w]*/, token: 'function' }, // Get-ChildItem, Invoke-RestMethod
      { match: /(::|\.)([A-Za-z_]\w*)(?=\()/, groups: ['operator', 'function'] },
      { match: /(::|\.)([A-Za-z_]\w*)/, groups: ['operator', 'property'] },
      { match: /[A-Za-z_][\w]*/, token: name },
      { match: /0x[\da-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?(?:[kKmMgGtTpP][bB])?/, token: 'number' },
      { match: /\$\(/, token: 'punctuation', push: 'subexpression' },
      { match: /@\(|@\{/, token: 'punctuation' },
      { match: /\+\+|--|[-+*/%]?=|\|\||&&|[|&!<>+*/%-]|\.\.|::/, token: 'operator' },
      { match: /[()[\]{},;.`]/, token: 'punctuation' },
    ],
    subexpression: [
      { match: /\)/, token: 'punctuation', pop: true },
      { match: /\(/, token: 'punctuation', push: 'subexpression' },
      { include: 'root' },
    ],
    // "…$var…$(expr)…", with `n escapes.
    double: [
      { match: /[^"`$]+/, token: 'string' },
      { match: /`./, token: 'escape' },
      { match: /""/, token: 'escape' },
      { match: /\$\(/, token: 'escape', push: 'interpolation' },
      { match: new RegExp(VARIABLE), token: 'variable' },
      { match: /[$`]/, token: 'string' },
      { match: /"/, token: 'string', pop: true },
    ],
    single: [
      { match: /[^']+/, token: 'string' },
      { match: /''/, token: 'escape' },
      { match: /'/, token: 'string', pop: true },
    ],
    interpolation: [
      { match: /\)/, token: 'escape', pop: true },
      { match: /\(/, token: 'punctuation', push: 'subexpression' },
      { include: 'root' },
    ],
    // @" … "@: the closing "@ starts a line.
    hereDouble: [
      { match: /^"@/, token: 'string', pop: true },
      { match: /[^`$]+/, token: 'string' },
      { match: /`./, token: 'escape' },
      { match: /\$\(/, token: 'escape', push: 'interpolation' },
      { match: new RegExp(VARIABLE), token: 'variable' },
      { match: /[$`]/, token: 'string' },
    ],
    hereSingle: [
      { match: /^'@/, token: 'string', pop: true },
      { match: /.+/, token: 'string' },
    ],
    blockComment: [
      { match: /#>/, token: 'comment', pop: true },
      { match: /[^#]+|#/, token: 'comment' },
    ],
  },
}
