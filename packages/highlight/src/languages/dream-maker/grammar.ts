import type { Grammar } from '../../engine/grammar.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  var proc verb new del return if else for while do switch in to step break continue goto spawn sleep
  as tmp const static global set src usr world args range view oview orange istype locate
  get_dist get_step walk walk_to step_to
`)
const BUILTINS = words(`
  world usr src args contents loc vars type parent_type name desc icon icon_state dir density opacity
  layer x y z text overlays underlays verbs ckey key client mob obj turf area atom datum list
  output input alert browse sound image icon view range orange oview hearers locate pick prob rand
  round min max abs sqrt length copytext findtext replacetext lowertext uppertext num2text text2num
  istype isnull isnum istext islist ismob isobj isturf isarea
`)

// DM (BYOND's Dream Maker): object paths like /mob/player, var/ and proc/
// declarations by indentation, #defines, and "strings with [expressions]".
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'comment' },
      { match: /#\s*\w+.*/, token: 'meta', after: (p) => p === undefined }, // #define, #include
      { match: /\{"/, token: 'string', push: 'document' },
      { match: /"/, token: 'string', push: 'string' },
      { match: /'[^'\n]*'/, token: 'constant' }, // a resource: 'icons/mob.dmi'
      // /mob/player/proc/attack(), proc/attack()
      { match: /((?:\/?\w+)(?:\/\w+)*\/)?(proc|verb)(\/)([A-Za-z_]\w*)/, groups: ['type', 'keyword', 'punctuation', 'function'] },
      { match: /(var)((?:\/[\w]+)*)(\/)([A-Za-z_]\w*)/, groups: ['keyword', 'type', 'punctuation', 'variable'] }, // var/list/items
      { match: /(?:\/[A-Za-z_]\w*)+/, token: 'type', after: (p) => p === undefined || p.type === 'keyword' || p.type === 'operator' || p.text === '(' || p.text === ',' },
      { match: /[A-Za-z_]\w*(?=\()/, token: (t) => (KEYWORDS.has(t) ? 'keyword' : BUILTINS.has(t) ? 'builtin' : 'function') },
      { match: /[A-Za-z_]\w*/, token: (t) => (KEYWORDS.has(t) ? 'keyword' : t === 'null' || t === 'TRUE' || t === 'FALSE' ? 'constant' : BUILTINS.has(t) ? 'variable' : /^[A-Z][A-Z\d_]+$/.test(t) ? 'constant' : undefined) },
      { match: /0x[\da-fA-F]+|\d+(?:\.\d+)?(?:e[-+]?\d+)?/, token: 'number' },
      { match: /\?\.|<<|>>|==|!=|<=|>=|&&|\|\||\+\+|--|\*\*|[-+*/%&|^~<>!=?:]=?/, token: 'operator' },
      { match: /[()[\]{},;.]/, token: 'punctuation' },
    ],
    string: [
      { match: /"/, token: 'string', pop: true },
      { match: /\\(?:improper|proper|the|The|a|an|he|she|his|her|him|icon|ref|roman|Roman|n|t|"|\\|\[|\])/, token: 'escape' },
      { match: /\[/, token: 'escape', push: 'embedded' },
      { match: /[^"\\[]+|\\/, token: 'string' },
      { match: /$/, pop: true },
    ],
    document: [
      { match: /"\}/, token: 'string', pop: true },
      { match: /\[/, token: 'escape', push: 'embedded' },
      { match: /[^"[]+|"/, token: 'string' },
    ],
    embedded: [
      { match: /\]/, token: 'escape', pop: true },
      { include: 'root' },
    ],
    comment: [
      { match: /\/\*/, token: 'comment', push: 'comment' }, // they nest
      { match: /\*\//, token: 'comment', pop: true },
      { match: /[^/*]+|[/*]/, token: 'comment' },
    ],
  },
}
