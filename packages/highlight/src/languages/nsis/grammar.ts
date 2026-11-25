import type { Grammar } from '../../engine/grammar.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  Section SectionEnd SectionGroup SectionGroupEnd Function FunctionEnd PageEx PageExEnd Page UninstPage
  Name OutFile InstallDir InstallDirRegKey RequestExecutionLevel Unicode SetCompressor ShowInstDetails
  ShowUnInstDetails BrandingText Icon UninstallIcon LicenseData Caption Var Return Abort Quit Goto
  If ElseIf Else EndIf IfThen For Next Do Loop While EndWhile Switch Case Default EndSwitch
  IfFileExists IfErrors StrCmp IntCmp IntOp StrCpy Call Exch Push Pop
`)

// NSIS installer scripts: Sections and Functions, !directives, $variables,
// ${macros} and instructions with their arguments.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /[;#].*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'comment' },
      { match: /![a-z]+/, token: 'meta' }, // !define, !include, !insertmacro
      { match: /(Function|Section|SectionGroup|PageEx)(\s+)(\/o\s+)?("[^"]*"|[\w.-]+)/, groups: ['keyword', undefined, 'keyword', 'function'] },
      { match: /"/, token: 'string', push: 'double' },
      { match: /'/, token: 'string', push: 'single' },
      { match: /`/, token: 'string', push: 'backquote' },
      { match: /\$\{[\w.:]+\}/, token: 'builtin' }, // ${If}, ${FileExists}
      { match: /\$\([\w.]+\)/, token: 'variable' }, // $(LangString)
      { match: /\$[\w]+/, token: 'variable' }, // $INSTDIR, $0
      { match: /\/[A-Za-z]+(?:=)?/, token: 'constant' }, // /r, /ONAME=
      { match: /[A-Z][A-Za-z]*(?:\.\w+)?/, token: (t) => (KEYWORDS.has(t) ? 'keyword' : 'function'), after: (p) => p === undefined || p.text === '}' },
      { match: /[A-Za-z_][\w.]*/, token: (t) => (KEYWORDS.has(t) ? 'keyword' : /^(?:HK(?:LM|CU|CR|U|CC|DD|PD)|MB_\w+|ID\w+|SW_\w+|FILE_\w+)$/.test(t) ? 'constant' : undefined) },
      { match: /[-+]?(?:0x[\da-fA-F]+|\d+)/, token: 'number' },
      { match: /==|!=|<=|>=|[<>=|&]/, token: 'operator' },
      { match: /[(){}:,]/, token: 'punctuation' },
    ],
    double: [
      { match: /"/, token: 'string', pop: true },
      { include: 'interpolated' },
      { match: /[^"$]+/, token: 'string' },
    ],
    single: [
      { match: /'/, token: 'string', pop: true },
      { include: 'interpolated' },
      { match: /[^'$]+/, token: 'string' },
    ],
    backquote: [
      { match: /`/, token: 'string', pop: true },
      { include: 'interpolated' },
      { match: /[^`$]+/, token: 'string' },
    ],
    interpolated: [
      { match: /\$\\[nrt"'`]|\$\$/, token: 'escape' },
      { match: /\$\{[\w.:]+\}|\$\([\w.]+\)|\$\w+/, token: 'variable' },
      { match: /\$/, token: 'string' },
    ],
    comment: [
      { match: /\*\//, token: 'comment', pop: true },
      { match: /[^*]+|\*/, token: 'comment' },
    ],
  },
}
