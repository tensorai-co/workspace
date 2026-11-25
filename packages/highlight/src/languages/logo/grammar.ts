import type { Grammar } from '../../engine/grammar.js'
import { words } from '../../language.js'

const PRIMITIVES = words(`
  forward fd back bk left lt right rt penup pu pendown pd hideturtle ht showturtle st home clearscreen
  cs clean setxy setx sety setheading seth setpencolor setpc setpensize setbackground setbg arc circle
  print pr show type make name local localmake thing repeat repcount for foreach while until if ifelse
  test iftrue iff iffalse iff stop output op run wait random sum difference product quotient remainder
  minus sqrt power first last butfirst bf butlast bl item fput lput list sentence se word count
  emptyp memberp numberp wordp listp and or not label filled towards pos heading xcor ycor
`)

// Logo: turtle graphics. to … end procedures, :variables, "words,
// [lists] and ; comments.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /;.*/, token: 'comment' },
      { match: /(to)(\s+)([\w.?!]+)/i, groups: ['keyword', undefined, 'function'] },
      { match: /end\b/i, token: 'keyword', after: (p) => p === undefined },
      { match: /:[\w.?]+/, token: 'variable' }, // :size
      { match: /"[^\s\[\]()]*/, token: 'string' }, // "word
      { match: /-?\d+(?:\.\d+)?/, token: 'number' },
      { match: /[A-Za-z][\w.?!]*/, token: (t) => (PRIMITIVES.has(t.toLowerCase()) ? 'builtin' : t.toLowerCase() === 'true' || t.toLowerCase() === 'false' ? 'constant' : 'function') },
      { match: /<=|>=|<>|[-+*/=<>]/, token: 'operator' },
      { match: /[[\]()]/, token: 'punctuation' },
    ],
  },
}
