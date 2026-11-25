import type { Grammar } from '../../engine/grammar.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  about above after against and apart around as aside at back before beginning behind below beneath
  beside between but by considering contain contains continue copy div does eighth else end equal
  equals error every exit fifth first for fourth from front get given global if ignoring in instead
  into is it its last local me middle mod my ninth not of on onto or out over prop property put ref
  reference repeat return returning script second set seventh since sixth some tell tenth that the
  then third through thru timeout times to transaction try until where while whose with without
  using application
`)
const CONSTANTS = words('true false missing value null pi tab return linefeed quote space yes no ask')
const BUILTINS = words(`
  display dialog alert notification log say beep delay activate quit launch open close count make
  delete duplicate exists move select run load store do shell script choose file folder from list
  read write current date path text string number integer real list record item items character
  characters word words paragraph paragraphs offset round random
`)

// AppleScript: English-like commands, tell blocks, on handlers, -- and #
// comments and (* nested comments *).
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /(?:--|#).*/, token: 'comment' },
      { match: /\(\*/, token: 'comment', push: 'comment' },
      { match: /"/, token: 'string', push: 'string' },
      { match: /«[^»]*»/, token: 'constant' }, // «class pnam»
      { match: /(on|to)(\s+)([A-Za-z_]\w*)(?=\s*\(|\s*$|\s+\w)/, groups: ['keyword', undefined, 'function'], after: (p) => p === undefined },
      { match: /(end)(\s+)(\w+)/, groups: ['keyword', undefined, 'keyword'], after: (p) => p === undefined },
      { match: /\|[^|]*\|/, token: 'variable' }, // |a name with spaces|
      { match: /[A-Za-z_]\w*(?=\()/, token: (t) => (BUILTINS.has(t.toLowerCase()) ? 'builtin' : 'function') },
      { match: /[A-Za-z_]\w*/, token: (t) => { const w = t.toLowerCase(); return KEYWORDS.has(w) ? 'keyword' : CONSTANTS.has(w) ? 'constant' : BUILTINS.has(w) ? 'builtin' : undefined } },
      { match: /\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, token: 'number' },
      { match: /[-+*/^&=≠≤≥<>¬]|[<>]=|\/=/, token: 'operator' },
      { match: /[()[\]{},:¬]/, token: 'punctuation' },
    ],
    string: [
      { match: /"/, token: 'string', pop: true },
      { match: /\\./, token: 'escape' },
      { match: /[^"\\]+/, token: 'string' },
    ],
    comment: [
      { match: /\(\*/, token: 'comment', push: 'comment' }, // they nest
      { match: /\*\)/, token: 'comment', pop: true },
      { match: /[^(*]+|[(*]/, token: 'comment' },
    ],
  },
}
