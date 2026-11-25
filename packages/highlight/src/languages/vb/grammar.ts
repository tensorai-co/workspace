import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

// Visual Basic .NET. Its words are any case.
const KEYWORDS = words(`
  addhandler addressof alias and andalso as by byref byval call case catch class const continue
  declare default delegate dim do each else elseif end enum erase error event exit finally for
  friend function get global gosub goto handles if implements imports in inherits interface is
  isnot let lib like loop me mod module mustinherit mustoverride mybase myclass namespace narrowing
  new next not notinheritable notoverridable of on operator option optional or orelse overloads
  overridable overrides paramarray partial private property protected public raiseevent readonly
  redim removehandler resume return select set shadows shared static step stop structure sub
  synclock then throw to try trycast typeof using when while widening with withevents writeonly xor
  async await iterator yield key from aggregate distinct group into join order skip take where
`)
const TYPES = words('boolean byte char date decimal double integer long object sbyte short single string uinteger ulong ushort')
const CONSTANTS = words('true false nothing')

function name(text: string): TokenType | undefined {
  const lower = text.toLowerCase()
  if (CONSTANTS.has(lower)) return 'constant'
  if (TYPES.has(lower)) return 'builtin'
  if (KEYWORDS.has(lower)) return 'keyword'
  return undefined
}

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /(?:'|‘|’|\brem\b).*/i, token: 'comment' },
      { match: /#(?:if|elseif|else|end if|region|end region|const|externalsource|end externalsource|disable|enable)\b.*/i, token: 'meta', after: (p) => p === undefined },
      { match: /<[A-Za-z][\w.]*(?:\([^)\n]*\))?>(?=\s|$)/, token: 'meta', after: (p) => p === undefined }, // <Serializable>
      { match: /\$"/, token: 'string', push: 'interpolated' },
      { match: /"(?:[^"\n]|"")*"c?/i, token: 'string' },
      { match: /#\d{1,2}\/\d{1,2}\/\d{2,4}(?: [\d:]+(?: ?[AP]M)?)?#/i, token: 'number' }, // a date
      { match: /(sub|function|property|operator|event)(\s+)([A-Za-z_]\w*)/i, groups: ['keyword', undefined, 'function'] },
      { match: /(class|module|structure|interface|enum|namespace|inherits|implements|as|new|of)(\s+)(?!new\b)([A-Za-z_][\w.]*)/i, groups: ['keyword', undefined, 'type'] },
      { match: /(\.)([A-Za-z_]\w*)(?=\s*\()/, groups: ['punctuation', 'function'] },
      { match: /(\.)([A-Za-z_]\w*)/, groups: ['punctuation', 'property'] },
      { match: /[A-Za-z_]\w*(?=\s*\()/, token: (t) => name(t) ?? 'function' },
      { match: /[A-Za-z_]\w*/, token: name },
      { match: /&H[\da-fA-F_]+|&O[0-7_]+|&B[01_]+|(?:\d[\d_]*(?:\.\d[\d_]*)?(?:E[-+]?\d+)?)[SILDFRC%&@!#]?/i, token: 'number' },
      { match: /<>|<=|>=|:=|\^=|\*=|\/=|\\=|\+=|-=|&=|<<=?|>>=?|[-+*/\\^&=<>]/, token: 'operator' },
      { match: /[()[\]{},.:!?_]/, token: 'punctuation' },
    ],
    interpolated: [
      { match: /""/, token: 'escape' },
      { match: /"/, token: 'string', pop: true },
      { match: /\{\{|\}\}/, token: 'escape' },
      { match: /\{/, token: 'escape', push: 'interpolation' },
      { match: /[^"{}]+|\}/, token: 'string' },
    ],
    interpolation: [
      { match: /\}/, token: 'escape', pop: true },
      { match: /:[^}"]*(?=\})/, token: 'escape' },
      { include: 'root' },
    ],
  },
}
