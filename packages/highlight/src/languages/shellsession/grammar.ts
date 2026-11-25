import type { Grammar } from '../../engine/grammar.js'

// A terminal transcript: commands after a prompt are Bash, the rest is output.
// Prompts: $, %, ❯, and user@host:~/dir$ or # (with an optional (venv) first).
// A bare > or # isn't one: npm prints "> app@1.0 test", and output has comments.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /(?:\([^)\n]*\)\s*)?(?:[\w.-]+@[\w.-]+(?::[^\s$#]*)?\s?[$#]|[$%❯➜])(?=\s)/, token: 'meta', push: '@command', after: (p) => p === undefined },
      { match: /.+/ },
    ],
  },
  embeds: {
    // To the end of the line, or past it while the line ends in \.
    command: { language: 'bash', end: (line) => (line.endsWith('\\') ? -1 : line.length) },
  },
}
