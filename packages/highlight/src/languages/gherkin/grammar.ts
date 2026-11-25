import type { Grammar } from '../../engine/grammar.js'

// Gherkin (Cucumber): features, scenarios and their Given/When/Then steps.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /#.*/, token: 'comment', after: (p) => p === undefined },
      { match: /@[\w-]+/, token: 'meta' }, // @smoke
      { match: /(Feature|Rule|Background|Scenario Outline|Scenario Template|Scenario|Example|Examples|Scenarios)(:)(.*)/, groups: ['keyword', 'keyword', 'property'], after: (p) => p === undefined },
      { match: /(?:Given|When|Then|And|But|\*)(?=\s)/, token: 'keyword', after: (p) => p === undefined },
      { match: /"""|```/, token: 'string', push: (t) => `docString/${t}` },
      { match: /\|/, token: 'punctuation' },
      { match: /"(?:[^"\\\n]|\\.)*"/, token: 'string' },
      { match: /<[^>\n]+>/, token: 'variable' }, // <placeholder>
      { match: /-?\d+(?:\.\d+)?(?![\w.])/, token: 'number' },
      { match: /[^\s|"<#@\d]+|[#@\d<]/ },
    ],
    docString: [
      { match: (line, pos, fence) => (line.trim() === fence && line.slice(0, pos).trim() === '' ? line.length - pos : -1), token: 'string', pop: true },
      { match: /.+/, token: 'string' },
    ],
  },
}
