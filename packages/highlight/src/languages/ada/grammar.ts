import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  abort abs abstract accept access aliased all and array at begin body case constant declare delay
  delta digits do else elsif end entry exception exit for function generic goto if in interface is
  limited loop mod new not null of or others out overriding package pragma private procedure
  protected raise range record rem renames requeue return reverse select separate some subtype
  synchronized tagged task terminate then type until use when while with xor
`)
const TYPES = words('integer natural positive float long_float boolean character string wide_string duration')
const CONSTANTS = words('true false')

function name(text: string): TokenType | undefined {
  const w = text.toLowerCase()
  if (KEYWORDS.has(w)) return 'keyword'
  if (TYPES.has(w)) return 'builtin'
  if (CONSTANTS.has(w)) return 'constant'
  return undefined
}

// Ada: packages, procedures and functions, strong types, 'Attributes and
// -- comments. Its words are any case.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /--.*/, token: 'comment' },
      { match: /"(?:[^"\n]|"")*"?/, token: 'string' },
      { match: /'.'(?!\w)/, token: 'string', after: (p) => !p || p.type !== undefined || p.text.endsWith(' ') }, // 'a'
      { match: /(')([A-Za-z_]\w*)/, groups: ['punctuation', 'builtin'] }, // X'First, Integer'Image
      { match: /(procedure|function|entry|task|protected)(\s+)(body\s+)?([A-Za-z_][\w.]*)/i, groups: ['keyword', undefined, 'keyword', 'function'] },
      { match: /(package)(\s+)(body\s+)?([A-Za-z_][\w.]*)/i, groups: ['keyword', undefined, 'keyword', 'type'] },
      { match: /(type|subtype)(\s+)([A-Za-z_]\w*)/i, groups: ['keyword', undefined, 'type'] },
      { match: /(end)(\s+)([A-Za-z_][\w.]*)(?=\s*;)/i, groups: ['keyword', undefined, 'function'] },
      { match: /[A-Za-z_][\w.]*(?=\s*\()/, token: (t) => name(t) ?? 'function' },
      { match: /[A-Za-z_]\w*/, token: name },
      { match: /\d[\d_]*#[\da-fA-F_.]+#(?:[eE][-+]?\d+)?|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][-+]?\d+)?/, token: 'number' },
      { match: /:=|=>|\.\.|\*\*|\/=|<=|>=|<>|[-+*/&<>=|]/, token: 'operator' },
      { match: /[()[\],;:.]/, token: 'punctuation' },
    ],
  },
}
