import type { Grammar } from '../../engine/grammar.js'

// APL (Dyalog): glyphs for functions and operators, ← assignment, ⍝
// comments, ⍺ and ⍵ in dfns, ⎕system names and :Control structures.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /⍝.*/, token: 'comment' },
      { match: /'/, token: 'string', push: 'string' },
      { match: /:[A-Za-z]+/, token: 'keyword' }, // :If :For :EndIf
      { match: /[⎕⍞][A-Za-z]*/, token: 'builtin' }, // ⎕IO ⎕← ⎕NL
      { match: /]\w+/, token: 'meta', after: (p) => p === undefined }, // ]box on
      { match: /∇\s*[A-Za-z_∆⍙][\w∆⍙]*/, token: 'function' }, // ∇ name: a traditional function
      { match: /[⍺⍵∇]{1,2}|⍺⍺|⍵⍵/, token: 'variable' },
      { match: /([A-Za-z_∆⍙][\w∆⍙]*)(\s*)(←)(\s*)(?=\{)/, groups: ['function', undefined, 'operator', undefined] }, // name ← {…}: a dfn
      { match: /[A-Za-z_∆⍙][\w∆⍙]*/ },
      { match: /¯?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE]¯?\d+)?(?:[jJ]¯?(?:\d+(?:\.\d*)?|\.\d+))?/, token: 'number' },
      { match: /[←→]/, token: 'operator' },
      { match: /[¨⍨⍣.∘⍤⍥@⌸⌺⌶⍠/⌿\\⍀&]/, token: 'keyword' }, // operators: each, commute, power, reduce
      { match: /[+\-×÷*⍟○!?|⌈⌊⊥⊤⊣⊢=≠≤<>≥≡≢∨∧⍱⍲↑↓⊂⊃⊆⌷⍋⍒⍳⍸∊⍷∪∩~,⍪⍴⌽⊖⍉⍎⍕⌹≡]/, token: 'function' }, // primitive functions
      { match: /[()[\]{};:◇⋄]/, token: 'punctuation' },
    ],
    string: [
      { match: /''/, token: 'escape' },
      { match: /'/, token: 'string', pop: true },
      { match: /[^']+/, token: 'string' },
    ],
  },
}
