import type { Grammar } from '../../engine/grammar.js'
import type { Token } from '../../tokens.js'

// MIPS assembly: labels, .directives, instructions, $registers and
// immediates, as in SPIM and MARS.
const REGISTER = /\$(?:zero|at|v[01]|a[0-3]|t\d|s[0-8]|k[01]|gp|sp|fp|ra|f\d{1,2}|\d{1,2})(?![\w])/

/** An instruction is the first word on a line, or after a label. */
const instructionStarts = (p: Token | undefined) => !p || p.type === 'function'

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /#.*/, token: 'comment' },
      { match: /\.[A-Za-z_][\w.]*/, token: 'meta', after: instructionStarts }, // .data, .text, .word
      { match: /[A-Za-z_.$\d][\w.$]*:/, token: 'function', after: (p) => p === undefined }, // main:
      { match: /[A-Za-z][\w.]*/, token: 'keyword', after: instructionStarts }, // li, addi, lw
      { match: /"(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?/, token: 'string' },
      { match: REGISTER, token: 'variable' },
      { match: /-?(?:0[xX][\da-fA-F]+|0[bB][01]+|\d+)/, token: 'number' },
      { match: /%(?:hi|lo)\b/, token: 'builtin' },
      { match: /[A-Za-z_.$][\w.$]*/ },
      { match: /[-+*/!^:=<>|&~]/, token: 'operator' },
      { match: /[()[\]{},]/, token: 'punctuation' },
    ],
  },
}
