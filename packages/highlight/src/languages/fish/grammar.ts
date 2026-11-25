import type { Grammar } from '../../engine/grammar.js'
import type { Token, TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words('function end if else switch case for in while begin and or not return break continue')
const BUILTINS = words(`
  set echo printf test string math status contains count argparse read source eval exec cd pwd
  type command builtin functions abbr alias bind complete emit fish_add_path set_color exit
`)

/** A command starts a line, or follows ; | & ( and or not. */
const commandStarts = (p: Token | undefined) => !p || /^(?:[;|&(]|&&|\|\||and|or|not|begin|else|if|while|case)$/.test(p.text)

function command(text: string): TokenType {
  if (KEYWORDS.has(text)) return 'keyword'
  if (BUILTINS.has(text)) return 'builtin'
  return 'function'
}

export const grammar: Grammar = {
  states: {
    root: [
      { match: /#!.*/, token: 'meta', after: (p) => p === undefined },
      { match: /\s+/ },
      { match: /#.*/, token: 'comment' },
      { match: /(function)(\s+)([\w-]+)/, groups: ['keyword', undefined, 'function'] },
      { match: /[\w./+-]+/, token: command, after: commandStarts },
      { match: /'/, token: 'string', push: 'single' },
      { match: /"/, token: 'string', push: 'double' },
      { match: /\$\(|\(/, token: 'punctuation', push: 'substitution' },
      { match: /\$[A-Za-z_]\w*(?:\[[^\]\n]*\])?/, token: 'variable' },
      { match: /--?[\w-]+(?:=)?/, token: 'property' }, // --flag, -l
      { match: /\d+(?![\w.-])/, token: 'number' },
      { match: /&&|\|\||[|&;<>]|>>|\^/, token: 'operator' },
      { match: /[{},]/, token: 'punctuation' },
      { match: /[^\s'"$()|&;<>{},#]+/ },
    ],
    substitution: [
      { match: /\)/, token: 'punctuation', pop: true },
      { match: /[\w./+-]+/, token: command, after: (p) => !!p && (p.text.endsWith('(') || commandStarts(p)) },
      { include: 'root' },
    ],
    single: [
      { match: /[^'\\]+/, token: 'string' },
      { match: /\\['\\]/, token: 'escape' },
      { match: /\\/, token: 'string' },
      { match: /'/, token: 'string', pop: true },
    ],
    double: [
      { match: /[^"\\$]+/, token: 'string' },
      { match: /\\./, token: 'escape' },
      { match: /\$\(/, token: 'punctuation', push: 'substitution' },
      { match: /\$[A-Za-z_]\w*(?:\[[^\]\n]*\])?/, token: 'variable' },
      { match: /\$/, token: 'string' },
      { match: /"/, token: 'string', pop: true },
    ],
  },
}
