import type { Grammar } from '../../engine/grammar.js'
import type { Token } from '../../tokens.js'

// Assembly as people write it for x86 and ARM: labels, directives,
// instructions, registers and immediates, in Intel, AT&T or ARM syntax.
const REGISTER = new RegExp(
  [
    /%?(?:[re]?[abcd]x|[abcd][lh]|[re]?[sd]il?|[re]?[sb]pl?|[re]?ip|r(?:[89]|1[0-5])[dwb]?)/.source, // x86
    /%?(?:[xyz]mm\d{1,2}|[cdefgs]s|cr\d|dr\d|k[0-7]|st\(?\d?\)?)/.source,
    /(?:[xw](?:[12]?\d|30)|[xw]zr|sp|lr|pc|fp|r(?:1[0-5]|\d)|[sdqv]\d{1,2}(?:\.\d*[bhsd])?)/.source, // ARM
  ].join('|'),
)

/** An instruction is the first word on a line, or after a label. */
const instructionStarts = (p: Token | undefined) => !p || p.type === 'function'

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /(?:;|\/\/).*/, token: 'comment' },
      { match: /#(?![\d-]).*/, token: 'comment', after: (p) => p === undefined },
      { match: /@.*/, token: 'comment', after: (p) => !!p }, // ARM's end-of-line comments
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /%(?:define|macro|endmacro|include|ifdef|ifndef|endif|else|assign)\b.*/, token: 'meta' }, // NASM
      { match: /\.[A-Za-z_][\w.]*/, token: 'meta', after: instructionStarts }, // .section .text, .globl
      { match: /[A-Za-z_.$\d][\w.$]*:/, token: 'function', after: (p) => p === undefined }, // a label: start:, 1:
      { match: /[A-Za-z][\w.]*/, token: 'keyword', after: instructionStarts }, // mov, add, ldr
      { match: /"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?/, token: 'string' },
      { match: new RegExp(`(?:${REGISTER.source})(?![\\w.])`, 'i'), token: 'variable' },
      { match: /[#$]?-?(?:0[xX][\da-fA-F]+|0[bB][01]+|[\da-fA-F]+h\b|\d+)/, token: 'number' },
      { match: /(?:byte|word|dword|qword|xmmword|ptr|offset|rel)\b/i, token: 'builtin' },
      { match: /[A-Za-z_.$][\w.$@]*/ },
      { match: /[-+*/!^:=<>|&~]/, token: 'operator' },
      { match: /[()[\]{},]/, token: 'punctuation' },
    ],
    blockComment: [
      { match: /[^*]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /\*/, token: 'comment' },
    ],
  },
}
