import type { Grammar } from '../../engine/grammar.js'
import { words } from '../../language.js'

const DIRECTIVES = words(`
  include -include sinclude ifeq ifneq ifdef ifndef else endif define endef export unexport override
  undefine private vpath
`)
const FUNCTIONS = words(`
  subst patsubst strip findstring filter filter-out sort word wordlist words firstword lastword dir
  notdir suffix basename addsuffix addprefix join wildcard realpath abspath error warning info shell
  origin flavor foreach if or and call eval file value let intcmp
`)

export const grammar: Grammar = {
  states: {
    root: [
      // A recipe line starts with a tab: shell commands.
      { match: /\t/, push: 'recipe', after: (p) => p === undefined },
      { match: /\s+/ },
      { match: /#.*/, token: 'comment' },
      { match: /-?[a-z]+(?=\s|$)/, token: (t) => (DIRECTIVES.has(t) ? 'keyword' : undefined), after: (p) => p === undefined || p.text === 'override' || p.text === 'export' },
      { match: /\.[A-Z_]+(?=\s*:(?!=))/, token: 'meta', after: (p) => p === undefined }, // .PHONY:
      // A variable: NAME = value, NAME := value, NAME ?= value, NAME += value.
      { match: /([\w.-]+)(\s*)(::?=|\?=|\+=|!=|=)/, groups: ['variable', undefined, 'operator'], push: 'value' },
      // A rule: targets: prerequisites
      { match: /[^\s:#=$]+(?:\s+[^\s:#=$]+)*(?=\s*::?(?!=))/, token: 'function', after: (p) => p === undefined },
      { match: /::?|\|/, token: 'operator' },
      { include: 'expansions' },
      { match: /[^\s#$:|]+/ },
    ],
    // $(VAR), ${VAR}, $@ and the other automatic variables, $(func args).
    expansions: [
      { match: /\$\$/, token: 'escape' },
      { match: /\$[@<^?*%+|]/, token: 'variable' },
      { match: /\$[({][^()${}\s]*[)}]/, token: 'variable' },
      { match: /\$[({]/, token: 'variable', push: 'call' },
      { match: /\$\w/, token: 'variable' },
    ],
    // Inside $( ): a function and its arguments, or a computed variable name.
    call: [
      { match: /(?<=\$[({])[\w-]+(?=\s)/, token: (t) => (FUNCTIONS.has(t) ? 'builtin' : 'variable') },
      { match: /[)}]/, token: 'variable', pop: true },
      { match: /\(/, push: 'parens' },
      { include: 'expansions' },
      { match: /,/, token: 'punctuation' },
      { match: /[^$(){},]+/ },
    ],
    parens: [
      { match: /\)/, pop: true },
      { include: 'call' },
    ],
    value: [
      { match: /\\$/, token: 'escape' },
      { match: (line, pos) => (pos === line.length && !line.endsWith('\\') ? 0 : -1), pop: true },
      { match: /(?<=\s)#.*/, token: 'comment' },
      { include: 'expansions' },
      { match: /[^$\\#]+|[\\#]/ },
    ],
    recipe: [
      { match: /\\$/, token: 'escape' },
      { match: (line, pos) => (pos === line.length && !line.endsWith('\\') ? 0 : -1), pop: true },
      { match: /[@+-]+(?=\S)/, token: 'operator', after: (p) => p === undefined },
      { include: 'expansions' },
      { match: /"/, token: 'string', push: 'double' },
      { match: /'[^'\n]*'?/, token: 'string' },
      { match: /(?<=^\t|\s)#.*/, token: 'comment' },
      { match: /&&|\|\||[|;><]/, token: 'operator' },
      { match: /[^$\\"'&|;<>\s]+|[\\"'&]|\s+/ },
    ],
    // A recipe's "string", with make's expansions inside.
    double: [
      { match: /[^"\\$]+/, token: 'string' },
      { match: /\\./, token: 'escape' },
      { include: 'expansions' },
      { match: /\$|\\/, token: 'string' },
      { match: /"/, token: 'string', pop: true },
      { match: /$/, pop: true },
    ],
  },
}

