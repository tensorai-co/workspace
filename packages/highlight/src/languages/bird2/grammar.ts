import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  router id protocol template from table filter function define if then else case accept reject
  return import export all none where local neighbor as multihop next hop self password interface
  area ipv4 ipv6 vpn4 vpn6 flow4 flow6 static device direct kernel bgp ospf babel rip bfd rpki radv
  pipe peer description debug log syslog stderr bfd graceful restart learn persist scan time
  preference via blackhole unreachable prohibit print printn and or not in include attribute
`)
const TYPES = words(`
  int bool ip prefix pair quad ec lc string bgpmask bgppath clist eclist lclist set
`)
const CONSTANTS = words('true false yes no on off')
const BUILTINS = words(`
  net bgp_path bgp_community bgp_large_community bgp_local_pref proto source dest gw from defined
  roa_check
`)

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (TYPES.has(text)) return 'builtin'
  if (CONSTANTS.has(text)) return 'constant'
  return undefined
}

const IDENT = /[A-Za-z_]\w*/.source

// BIRD 2 routing daemon config: protocols, channels, filters and functions, with addresses and prefixes.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2}(?:[+-]|\{\d+,\d+\})?)?|[\da-fA-F]*:[\da-fA-F:]+(?:\/\d{1,3})?/, token: 'constant' }, // 10.0.0.0/8+, 2001:db8::/32
      { match: /\#.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /"/, token: 'string', push: 'string0' },
      { match: new RegExp(`(protocol|template|table)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'type'] },
      { match: new RegExp(`(function|filter)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'function'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})(?=\\s*\\()`), groups: ['punctuation', 'function'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})`), groups: ['punctuation', 'property'] },
      { match: new RegExp(`${IDENT}(?=\\s*\\()`), token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : 'function') },
      { match: new RegExp(IDENT), token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : undefined) },
      { match: /0[xX][\da-fA-F_]+\w*|0[bB][01_]+\w*|0[oO][0-7_]+\w*|(?:\d[\d_]*(?:\.(?![.A-Za-z_])[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?\w*/, token: 'number' },
      { match: /~|!~|==|!=|<=|>=|&&|\|\||[-+*/<>=!]/, token: 'operator' },
      { match: /[()[\]{},;.]/, token: 'punctuation' },
    ],
    string0: [
      { match: /"/, token: 'string', pop: true },
      { match: /\\(?:x[\da-fA-F]{2}|u\{[\da-fA-F]+\}|u[\da-fA-F]{4}|.?)/, token: 'escape' },
      { match: /[^"\\]+/, token: 'string' },
      { match: /./, token: 'string' },
      { match: /$/, pop: true },
    ],
    blockComment: [
      { match: /[^*\/]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /[*\/]/, token: 'comment' },
    ],
  },
}
