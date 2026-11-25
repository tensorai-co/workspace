import type { Grammar } from '../../engine/grammar.js'
import type { Token, TokenType } from '../../tokens.js'
import { words } from '../../language.js'

// Windows batch files (.bat, .cmd). Commands are any case.
const KEYWORDS = words('if else for in do goto call exit not exist defined errorlevel equ neq lss leq gtr geq setlocal endlocal shift')
const COMMANDS = words(`
  echo set cd chdir pushd popd copy xcopy robocopy move del erase ren rename md mkdir rd rmdir dir type
  start title cls pause choice timeout where find findstr sort more attrib assoc ver vol path
  prompt color mklink tasklist taskkill
`)

/** A command starts a line, or follows ( & && || or do. */
const commandStarts = (p: Token | undefined) => !p || /^(?:\(|&&?|\|\||do|else)$/i.test(p.text) || p.text === '@'

function word(text: string): TokenType | undefined {
  const lower = text.toLowerCase()
  if (KEYWORDS.has(lower)) return 'keyword'
  return undefined
}

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /(?:rem\b|::).*/i, token: 'comment', after: commandStarts },
      { match: /:[A-Za-z_][\w.-]*/, token: 'function', after: (p) => p === undefined }, // :label
      { match: /@/, token: 'operator', after: (p) => p === undefined },
      { match: /(goto|call)(\s+)(:?[A-Za-z_][\w.-]*)/i, groups: ['keyword', undefined, 'function'] },
      { match: /[A-Za-z][\w.-]*/, token: (t) => word(t) ?? (COMMANDS.has(t.toLowerCase()) ? 'builtin' : 'function'), after: commandStarts },
      { match: /"/, token: 'string', push: 'string' },
      // %VAR%, %~dp0, %1, %%i in for loops, !VAR! with delayed expansion.
      { match: /%%(?:~[a-zA-Z]*)?[a-zA-Z]|%~[a-zA-Z]*\d|%\d|%[^%\s"]+%|![^!\s"]+!/, token: 'variable' },
      { match: /\/[A-Za-z?]\b/, token: 'property' }, // /b, /q, /?
      { match: /[A-Za-z_][\w.-]*/, token: word },
      { match: /\d+/, token: 'number' },
      { match: /&&|\|\||>>|2>&1|[|&<>]|==|=/, token: 'operator' },
      { match: /[()]/, token: 'punctuation' },
      { match: /\^./, token: 'escape' },
      { match: /[^\s"%!()&|<>=^]+|[%!^]/ },
    ],
    string: [
      { match: /[^"%!]+/, token: 'string' },
      { match: /%%(?:~[a-zA-Z]*)?[a-zA-Z]|%~[a-zA-Z]*\d|%\d|%[^%\s"]+%|![^!\s"]+!/, token: 'variable' },
      { match: /[%!]/, token: 'string' },
      { match: /"/, token: 'string', pop: true },
      { match: /$/, pop: true },
    ],
  },
}
