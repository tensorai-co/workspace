import type { Grammar } from '../../engine/grammar.js'
import { words } from '../../language.js'

const COMMANDS = words(`
  talk think choice jump run return set var add if else elseif text log notify wait play stop pause
  resume set_button set_screen empty_layer add_item remove_item enable_interaction disable_interaction
  start_quest complete_quest start_objective complete_objective add_xp add_level roll clear_dialog
  random random_float random_from_args concat join neg abs min max clamp floor round sqrt pow
  && || ! == != > < >= <= + - * /
`)

// Narrat: scripts for narrative games. label: blocks, talk and choice
// commands, $variables, (expressions) and %{interpolation} in strings.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /([A-Za-z_]\w*)(\s*[\w\s]*)(:)\s*$/, groups: ['function', 'variable', 'punctuation'], after: (p) => p === undefined }, // main:, greet name:
      { match: /"/, token: 'string', push: 'string' },
      { match: /\$[\w.]+/, token: 'variable' },
      { match: /(?:data|config|items|quests|skills|stats)\.[\w.]+/, token: 'variable' },
      { match: /[A-Za-z_][\w-]*/, token: (t) => (COMMANDS.has(t) ? 'keyword' : t === 'true' || t === 'false' || t === 'null' ? 'constant' : undefined) },
      { match: /&&|\|\||==|!=|>=|<=|[!<>+*/-]/, token: 'operator' },
      { match: /-?\d+(?:\.\d+)?/, token: 'number' },
      { match: /[():]/, token: 'punctuation' },
    ],
    string: [
      { match: /"/, token: 'string', pop: true },
      { match: /%\{/, token: 'escape', push: 'interpolation' },
      { match: /\\./, token: 'escape' },
      { match: /[^"%\\]+|%/, token: 'string' },
    ],
    interpolation: [
      { match: /\}/, token: 'escape', pop: true },
      { include: 'root' },
    ],
  },
}
