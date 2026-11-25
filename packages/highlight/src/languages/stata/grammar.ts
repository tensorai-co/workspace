import type { Grammar } from '../../engine/grammar.js'
import { words } from '../../language.js'

const COMMANDS = words(`
  use save clear set gen generate egen replace drop keep rename label sort gsort by bysort merge append
  reshape collapse summarize sum su tabulate tab describe list browse count display di regress reg
  logit probit xtreg ivregress predict test margins estimates esttab graph twoway scatter line histogram
  local global tempvar tempfile foreach forvalues while if else program end capture quietly noisily
  preserve restore import export insheet outsheet encode decode destring tostring format assert exit
  return ereturn matrix scalar include do run log cd mkdir version args syntax
`)
const FUNCTIONS = words('mean sd sum min max abs ln log exp sqrt round floor ceil int missing inlist inrange cond strlen substr strtrim upper lower regexm real string date mdy year month day')

// Stata: commands with varlists and options after a comma, `locals' and
// $globals, * and // comments, and /* */.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\*/, token: 'comment', push: 'comment' },
      { match: /\*.*/, token: 'comment', after: (p) => p === undefined },
      { match: /\/\/\/?.*/, token: 'comment' },
      { match: /`"/, token: 'string', push: 'compound' }, // `"compound "quoted" string"'
      { match: /`/, token: 'variable', push: 'local' },
      { match: /\$\{?\w+\}?/, token: 'variable' }, // $global
      { match: /"/, token: 'string', push: 'double' },
      { match: /(program)(\s+)(?:(define)(\s+))?(\w+)/, groups: ['keyword', undefined, 'keyword', undefined, 'function'] },
      { match: /[A-Za-z_]\w*(?=\()/, token: (t) => (FUNCTIONS.has(t) ? 'builtin' : 'function') },
      { match: /[a-z]\w*/, token: (t) => (COMMANDS.has(t) ? 'keyword' : undefined), after: (p) => p === undefined || p.text === ':' || p.text === '{' || p.type === 'keyword' && /^(?:quietly|noisily|capture|by|bysort)$/.test(p.text) },
      { match: /(?:if|in|using|of|varlist|numlist|newlist)\b/, token: 'keyword' },
      { match: /[A-Za-z_]\w*/ },
      { match: /\d+(?:\.\d+)?(?:[eE][-+]?\d+)?|\.[a-z]?(?![\w])/, token: 'number' }, // . is missing
      { match: /==|!=|~=|<=|>=|&|\||[-+*/^<>=!~#]/, token: 'operator' },
      { match: /[(),:[\]{}]/, token: 'punctuation' },
    ],
    local: [
      { match: /'/, token: 'variable', pop: true },
      { match: /`/, token: 'variable', push: 'local' },
      { match: /[^`']+/, token: 'variable' },
    ],
    double: [
      { match: /"/, token: 'string', pop: true },
      { match: /`/, token: 'variable', push: 'local' },
      { match: /\$\{?\w+\}?/, token: 'variable' },
      { match: /[^"`$]+|\$/, token: 'string' },
    ],
    compound: [
      { match: /"'/, token: 'string', pop: true },
      { match: /[^"]+|"/, token: 'string' },
    ],
    comment: [
      { match: /\*\//, token: 'comment', pop: true },
      { match: /[^*]+|\*/, token: 'comment' },
    ],
  },
}
