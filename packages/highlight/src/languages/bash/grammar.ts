import type { Grammar } from '../../engine/grammar.js'
import type { Token, TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words('if then else elif fi case esac for select while until do done in function time coproc')
const BUILTINS = words(`
  alias bg bind break builtin caller cd command compgen complete continue declare dirs disown echo
  enable eval exec exit export false fc fg getopts hash help history jobs kill let local logout
  mapfile popd printf pushd pwd read readarray readonly return set shift shopt source suspend test
  times trap true type typeset ulimit umask unalias unset wait
`)
/** Builtins whose arguments can be assignments: export NAME=value. */
const DECLARERS = words('export local readonly declare typeset')
/** What a command can follow. */
const COMMAND_AFTER = new Set([';', '&', '&&', '||', '|', '|&', '!', '(', '{', '$(', 'then', 'do', 'else', 'elif', 'if', 'while', 'until', 'time', 'coproc'])

/**
 * A word is a command where a command starts: at the start of a line, and
 * after ; | & && || ( { $( or a keyword like then or do.
 */
function commandStarts(prev: Token | undefined): boolean {
  return !prev || (prev.type !== 'string' && COMMAND_AFTER.has(prev.text))
}

function command(text: string): TokenType {
  if (KEYWORDS.has(text)) return 'keyword'
  if (BUILTINS.has(text)) return 'builtin'
  return 'function'
}

/** The word a heredoc ends at, from its opening: <<EOF, <<-'EOF', << "END". */
function heredocWord(text: string): string {
  return text.replace(/^<<-?\s*/, '').replace(/^(['"])(.*)\1$/, '$2')
}

const COMMAND = /(?:\.{0,2}\/)?[\w.+][\w./+@%-]*/
const ARITHMETIC_OPEN = { match: /\(\(/, token: 'punctuation', push: 'arithmetic' } as const

export const grammar: Grammar = {
  states: {
    root: [
      { match: /#!.*/, token: 'meta', after: (p) => p === undefined },
      { include: 'commands' },
      { include: 'code' },
    ],
    // What can start a command: an assignment, case, (( )), or a command word.
    commands: [
      { match: /([A-Za-z_]\w*)(\+?=)/, groups: ['variable', 'operator'], after: (p) => commandStarts(p) || (!!p && DECLARERS.has(p.text)) },
      { match: /case(?![\w-])/, token: 'keyword', push: 'caseBody', after: commandStarts },
      { ...ARITHMETIC_OPEN, after: commandStarts },
      { match: COMMAND, token: command, after: commandStarts },
    ],
    code: [
      { match: /\s+/ },
      // A comment starts a word: "a#b" isn't one.
      { match: /(?<![^\s;|&(])#.*/, token: 'comment' },
      { match: /<<-?\s*(?:'[A-Za-z_]\w*'|"[A-Za-z_]\w*"|[A-Za-z_]\w*)/, token: 'operator', push: (t) => 'heredocStart/' + heredocWord(t) },
      { match: /'/, token: 'string', push: 'single' },
      { match: /\$'/, token: 'string', push: 'ansi' },
      { match: /"/, token: 'string', push: 'double' },
      { match: /`/, token: 'punctuation', push: 'backtick' },
      { include: 'expansions' },
      { match: /(?:if|then|else|elif|fi|for|select|while|until|do|done|in|function)(?![\w-])/, token: 'keyword' },
      { match: /\d+(?![\w.-])/, token: 'number' },
      { match: /&&|\|\||;;&?|;&|\|&|<<<|>>|<&|>&|&>>?|[|&;<>!]|=~|[!=]=|=/, token: 'operator' },
      // A line ending in \ continues the command: the next line holds its arguments.
      { match: /\\$/, token: 'escape', push: 'continued' },
      { match: /\\./, token: 'escape' },
      { match: /[()[\]{}]/, token: 'punctuation' },
      { match: /[^\s'"`$\\;|&<>()[\]{}#=]+/ },
    ],
    continued: [
      { match: /\\$/, token: 'escape' },
      { match: (line, pos) => (pos === line.length && !line.endsWith('\\') ? 0 : -1), pop: true },
      // Its first word is an argument; a command can still follow a pipe.
      { match: COMMAND, token: command, after: (p) => p !== undefined && commandStarts(p) },
      { include: 'code' },
    ],
    // $VAR, ${...}, $(...), $((...)).
    expansions: [
      { match: /\$\(\(/, token: 'punctuation', push: 'arithmetic' },
      { match: /\$\(/, token: 'punctuation', push: 'subshell' },
      { match: /\$\{/, token: 'variable', push: 'parameter' },
      { match: /\$(?:[A-Za-z_]\w*|[0-9@*#?$!-])/, token: 'variable' },
    ],
    subshell: [
      { match: /\)/, token: 'punctuation', pop: true },
      { include: 'commands' },
      { include: 'code' },
    ],
    arithmetic: [
      { match: /\)\)/, token: 'punctuation', pop: true },
      { match: /\(/, token: 'punctuation', push: 'parens' },
      { match: /[A-Za-z_]\w*/, token: 'variable' },
      { match: /\+\+|--|\*\*|[-+*/%<>=!&|^~?:]=?|,/, token: 'operator' },
      { include: 'code' },
    ],
    parens: [
      { match: /\)/, token: 'punctuation', pop: true },
      { include: 'arithmetic' },
    ],
    parameter: [
      { match: /\}/, token: 'variable', pop: true },
      { match: /"/, token: 'string', push: 'double' },
      { match: /'/, token: 'string', push: 'single' },
      { include: 'expansions' },
      { match: /[^}$"']+/, token: 'variable' },
      { match: /\$/, token: 'variable' },
    ],
    // case WORD in PATTERN) commands ;; ... esac
    caseBody: [
      { match: /esac(?![\w-])/, token: 'keyword', pop: true },
      { match: /(?:[^\s()|;]+|\|)+(?=\s*\))/, token: 'string', after: (p) => !p || p.text === ';;' || p.text === ';&' || p.text === ';;&' || p.text === '(' },
      { match: COMMAND, token: command, after: (p) => p?.text === ')' },
      { include: 'commands' },
      { include: 'code' },
    ],
    single: [
      { match: /[^']+/, token: 'string' },
      { match: /'/, token: 'string', pop: true },
    ],
    ansi: [
      { match: /[^'\\]+/, token: 'string' },
      { match: /\\(?:x[\da-fA-F]{1,2}|u[\da-fA-F]{1,4}|U[\da-fA-F]{1,8}|[0-7]{1,3}|c.|.?)/, token: 'escape' },
      { match: /'/, token: 'string', pop: true },
    ],
    double: [
      { match: /[^"\\$`]+/, token: 'string' },
      { match: /\\[$`"\\\n]?/, token: 'escape' },
      { match: /`/, token: 'punctuation', push: 'backtick' },
      { include: 'expansions' },
      { match: /\$/, token: 'string' },
      { match: /"/, token: 'string', pop: true },
    ],
    backtick: [
      { match: /`/, token: 'punctuation', pop: true },
      { match: COMMAND, token: command, after: (p) => p?.text === '`' },
      { include: 'commands' },
      { include: 'code' },
    ],
    // The rest of the line with "<<EOF" on it is still code; the body starts below.
    heredocStart: [
      { match: (line, pos) => (pos === line.length ? 0 : -1), next: (_t, word) => 'heredoc/' + word },
      { include: 'commands' },
      { include: 'code' },
    ],
    heredoc: [
      { match: (line, pos, word) => (pos === 0 && line.replace(/^\t+/, '') === word ? line.length : -1), token: 'operator', pop: true },
      { match: /.+/, token: 'string' },
    ],
  },
}
