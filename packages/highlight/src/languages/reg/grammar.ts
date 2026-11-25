import type { Grammar } from '../../engine/grammar.js'

// Windows registry files (.reg): [HKEY_…\keys], "name"=values typed as
// dword:, hex: and strings, @ for the default value, and ; comments.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /;.*/, token: 'comment' },
      { match: /(?:Windows Registry Editor Version [\d.]+|REGEDIT4)/, token: 'meta', after: (p) => p === undefined },
      { match: /(\[)(-?)(HKEY_[A-Z_]+|HK(?:LM|CU|CR|U|CC))([^\]\n]*)(\])/, groups: ['punctuation', 'operator', 'constant', 'type', 'punctuation'] },
      { match: /"(?:[^"\\\n]|\\.)*"(?=\s*=)|@(?=\s*=)/, token: 'property' },
      { match: /=/, token: 'operator' },
      { match: /"/, token: 'string', push: 'string' },
      { match: /(dword|qword|hex(?:\([\da-fA-F]+\))?)(:)/, groups: ['builtin', 'punctuation'] },
      { match: /[\da-fA-F]{2}(?=[,\s\\]|$)|[\da-fA-F]{8}/, token: 'number' },
      { match: /-(?=\s*$)/, token: 'operator' }, // "name"=- deletes it
      { match: /[,\\]/, token: 'punctuation' },
    ],
    string: [
      { match: /"/, token: 'string', pop: true },
      { match: /\\./, token: 'escape' },
      { match: /%\w+%/, token: 'variable' },
      { match: /[^"\\%]+|%/, token: 'string' },
    ],
  },
}
