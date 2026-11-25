import type { Grammar } from '../../engine/grammar.js'
import type { Token } from '../../tokens.js'

// RISC-V assembly: labels, .directives, instructions, ABI and numbered
// registers, %hi/%lo relocations and immediates.
const REGISTER = /(?:zero|ra|sp|gp|tp|fp|pc|t[0-6]|s(?:1[01]|\d)|a[0-7]|x(?:3[01]|[12]?\d)|f(?:3[01]|[12]?\d)|f[tsa]\d{1,2}|v(?:3[01]|[12]?\d))(?![\w.])/

/** An instruction is the first word on a line, or after a label. */
const instructionStarts = (p: Token | undefined) => !p || p.type === 'function'

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /(?:#|\/\/).*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /\.[A-Za-z_][\w.]*/, token: 'meta', after: instructionStarts }, // .section .text, .globl
      { match: /[A-Za-z_.$\d][\w.$]*:/, token: 'function', after: (p) => p === undefined }, // _start:, 1:
      { match: /[A-Za-z][\w.]*/, token: 'keyword', after: instructionStarts }, // li, addi, ecall, fadd.d
      { match: /"(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?/, token: 'string' },
      { match: REGISTER, token: 'variable' },
      { match: /%(?:hi|lo|pcrel_hi|pcrel_lo|tprel_hi|tprel_lo|tprel_add|got_pcrel_hi)\b/, token: 'builtin' },
      { match: /-?(?:0[xX][\da-fA-F]+|0[bB][01]+|\d+)[fb]?/, token: 'number' },
      { match: /[A-Za-z_.$][\w.$]*/ },
      { match: /[-+*/!^:=<>|&~%]/, token: 'operator' },
      { match: /[()[\]{},]/, token: 'punctuation' },
    ],
    blockComment: [
      { match: /[^*]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /\*/, token: 'comment' },
    ],
  },
}
