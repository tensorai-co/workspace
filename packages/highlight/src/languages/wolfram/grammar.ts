import type { Grammar } from '../../engine/grammar.js'
import { words } from '../../language.js'

const CONSTANTS = words('True False Null None All Automatic Infinity Pi E I Indeterminate ComplexInfinity Degree GoldenRatio')

// The Wolfram Language (Mathematica): f[x_] := …, [[parts]], #& pure
// functions, -> rules and /. replacements, (* nested comments *).
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\(\*/, token: 'comment', push: 'comment' },
      { match: /"/, token: 'string', push: 'string' },
      // A definition: f[x_, y_:1] := …
      { match: /([A-Za-z$][\w$`]*)(?=\[[^\]\n]*_[^\]\n]*\]\s*:?=)/, token: 'function', after: (p) => p === undefined },
      { match: /([A-Za-z$][\w$]*)(_{1,3}\.?)([A-Z][\w`]*)?/, groups: ['variable', 'operator', 'type'] }, // x_, xs__, n_Integer
      { match: /_{1,3}[A-Z]\w*|_{1,3}\.?/, token: 'operator' },
      { match: /#\d*|##\d*|#[A-Za-z]\w*/, token: 'variable' }, // slots
      { match: /\\\[[A-Za-z]+\]/, token: 'escape' }, // \[Alpha]
      { match: /[A-Z][\w$`]*(?=\[)/, token: (t) => (CONSTANTS.has(t) ? 'constant' : 'builtin') }, // Plot[, Table[
      { match: /[a-z$][\w$`]*(?=\[)/, token: 'function' },
      { match: /[A-Z][\w$`]*/, token: (t) => (CONSTANTS.has(t) ? 'constant' : 'builtin') }, // system symbols are capitalized: Red, Keys
      { match: /[a-z$][\w$`]*/ },
      { match: /\d+\^\^[\da-zA-Z.]+|(?:\d+\.?\d*|\.\d+)(?:`\d*\.?\d*)?(?:\*\^-?\d+)?/, token: 'number' },
      { match: /:=|:>|->|\/\.|\/\/\.?|\/@|@@@?|@|\/;|&&|\|\||==|=!=|===|!=|<=|>=|<>|\.\.\.?|\+\+|--|[-+*/^=<>!&|.;~?']|\\\\/, token: 'operator' },
      { match: /\[\[|\]\]|[[\](){},]|<\||\|>/, token: 'punctuation' },
    ],
    string: [
      { match: /"/, token: 'string', pop: true },
      { match: /\\(?:\[[A-Za-z]+\]|.)/, token: 'escape' },
      { match: /[^"\\]+/, token: 'string' },
    ],
    comment: [
      { match: /\(\*/, token: 'comment', push: 'comment' }, // they nest
      { match: /\*\)/, token: 'comment', pop: true },
      { match: /[^(*]+|[(*]/, token: 'comment' },
    ],
  },
}
