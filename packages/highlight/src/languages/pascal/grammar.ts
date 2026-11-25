import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  and array as asm begin case class const constructor destructor div do downto else end except exports
  file finalization finally for function goto if implementation in inherited initialization inline
  interface is label library mod nil not object of on or out packed procedure program property raise
  record repeat resourcestring set shl shr string then threadvar to try type unit until uses var while
  with xor private protected public published strict override virtual abstract overload reintroduce
  forward external specialize generic
`)
const TYPES = words('integer cardinal shortint smallint longint int64 byte word longword qword real single double extended currency boolean char widechar ansistring unicodestring pchar pointer variant tobject')
const CONSTANTS = words('true false nil self result')
const BUILTINS = words('writeln write readln read inc dec length setlength low high ord chr succ pred assigned freeandnil inttostr strtoint format copy pos delete insert trim uppercase lowercase exit halt new dispose')

function name(text: string): TokenType | undefined {
  const w = text.toLowerCase()
  if (KEYWORDS.has(w)) return 'keyword'
  if (TYPES.has(w)) return 'builtin'
  if (CONSTANTS.has(w)) return w === 'self' || w === 'result' ? 'variable' : 'constant'
  if (/^T[A-Z]\w*$/.test(text)) return 'type' // TItem, by convention
  return undefined
}

// Pascal and Delphi: program and unit structure, begin … end, { } and
// (* *) comments, {$directives}, 'strings' with #13 characters and $FF hex.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\{\$[^}]*\}|\(\*\$[\s\S]*?\*\)/, token: 'meta' }, // {$mode objfpc}
      { match: /\/\/.*/, token: 'comment' },
      { match: /\{/, token: 'comment', push: 'braceComment' },
      { match: /\(\*/, token: 'comment', push: 'parenComment' },
      { match: /'(?:[^'\n]|'')*'?/, token: 'string' },
      { match: /#(?:\$[\da-fA-F]+|\d+)/, token: 'string' }, // #13: a character
      { match: /(procedure|function|constructor|destructor)(\s+)([A-Za-z_][\w.]*)/i, groups: ['keyword', undefined, 'function'] },
      { match: /(program|unit|library)(\s+)([A-Za-z_][\w.]*)/i, groups: ['keyword', undefined, 'type'] },
      { match: /([A-Za-z_]\w*)(\s*)(=)(\s*)(?=(?:packed\s+)?(?:class|record|object|interface)\b)/i, groups: ['type', undefined, 'operator', undefined] },
      { match: /&?[A-Za-z_]\w*(?=\s*\()/, token: (t) => name(t) ?? (BUILTINS.has(t.toLowerCase()) ? 'builtin' : 'function') },
      { match: /&?[A-Za-z_]\w*/, token: (t) => name(t) ?? (BUILTINS.has(t.toLowerCase()) ? 'builtin' : undefined) },
      { match: /\$[\da-fA-F]+|%[01]+|&[0-7]+|\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/, token: 'number' },
      { match: /:=|\.\.|<>|<=|>=|\+=|-=|[-+*/=<>@^]/, token: 'operator' },
      { match: /[()[\],;:.]/, token: 'punctuation' },
    ],
    braceComment: [
      { match: /\}/, token: 'comment', pop: true },
      { match: /[^}]+/, token: 'comment' },
    ],
    parenComment: [
      { match: /\*\)/, token: 'comment', pop: true },
      { match: /[^*]+|\*/, token: 'comment' },
    ],
  },
}
