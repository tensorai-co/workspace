import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  if else loop while for in until break continue return goto gosub switch case default try catch
  finally throw class extends static global local new and or not is isset super this
  ifwinactive ifwinexist ifequal ifnotequal ifexist
`)
const CONSTANTS = words('true false a_index a_loopfield a_scriptdir a_workingdir a_now a_tickcount a_space a_tab a_clipboard clipboard errorlevel')
const BUILTINS = words(`
  msgbox inputbox send sendinput sendraw sendtext sleep run runwait winactivate winwait winwaitactive
  winclose winexist winactive winget wingettitle winmove controlclick controlsend click mousemove
  mouseclick tooltip traytip settimer hotkey sound soundplay fileread fileappend filedelete filecopy
  fileexist dircreate regread regwrite strlen substr instr strreplace strsplit format round abs
  floor ceil mod min max array map object gui guicontrol exitapp reload suspend pause keywait
  getkeystate setworkingdir settitlematchmode sendmode coordmode iniread iniwrite clipwait
`)

function name(text: string): TokenType | undefined {
  const w = text.toLowerCase()
  if (KEYWORDS.has(w)) return 'keyword'
  if (CONSTANTS.has(w)) return 'constant'
  if (BUILTINS.has(w)) return 'builtin'
  return undefined
}

// AutoHotkey, v1 and v2: hotkeys (^!s::), hotstrings (::btw::), #directives,
// commands and functions, %variables% and `escapes.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      // ; starts a comment at the start of a line or after a space.
      { match: (line, pos) => (line[pos] === ';' && (pos === 0 || line[pos - 1] === ' ' || line[pos - 1] === '\t') ? line.length - pos : -1), token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'comment', after: (p) => p === undefined },
      { match: /#\w+/, token: 'meta', after: (p) => p === undefined }, // #Requires, #Include, #HotIf
      // ::btw::by the way, a hotstring; :*:@@::me@example.com
      { match: /(:[*?BbCcKkOoPpRrSsTtXxZz0-9]*:)(.+?)(::)(.*)/, groups: ['keyword', 'string', 'keyword', undefined], after: (p) => p === undefined },
      // ^!s::, F1::, ~LButton & RButton::, a hotkey
      { match: /[~*$!^+#<>]*[\w]+(?:\s+&\s+[~*$!^+#<>]*\w+)?(?:\s+up)?::/i, token: 'keyword', after: (p) => p === undefined },
      { match: /[A-Za-z_]\w*:(?=\s*$)/, token: 'function', after: (p) => p === undefined }, // a label
      { match: /"/, token: 'string', push: 'double' },
      { match: /'/, token: 'string', push: 'single' },
      { match: /%[A-Za-z_]\w*%/, token: 'variable' },
      { match: /(class)(\s+)([A-Za-z_]\w*)/i, groups: ['keyword', undefined, 'type'] },
      { match: /([A-Za-z_]\w*)(?=\([^)]*\)\s*(?:\{|=>|$))/, token: (t) => name(t) ?? 'function', after: (p) => p === undefined }, // a definition: Name(args) {
      { match: /(\.)([A-Za-z_]\w*)(?=\()/, groups: ['punctuation', 'function'] },
      { match: /(\.)([A-Za-z_]\w*)/, groups: ['punctuation', 'property'] },
      { match: /[A-Za-z_]\w*(?=\()/, token: (t) => name(t) ?? 'function' },
      // A v1 command at the start of a line: MsgBox, Hello
      { match: /[A-Za-z_]\w*(?=\s*,|\s+[^\s=:.(+\-*/<>!&|?]|\s*$)/, token: (t) => name(t) ?? undefined, after: (p) => p === undefined || p.text === '{' },
      { match: /[A-Za-z_]\w*/, token: name },
      { match: /0[xX][\da-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, token: 'number' },
      { match: /:=|\.=|\+=|-=|\*=|\/=|=>|==|!=|<>|<=|>=|&&|\|\||\*\*|\/\/|[-+*/<>=!~&|^?:.]/, token: 'operator' },
      { match: /[()[\]{},]/, token: 'punctuation' },
    ],
    double: [
      { match: /"/, token: 'string', pop: true },
      { include: 'stringBody' },
      { match: /[^"`%{]+|[%{]/, token: 'string' },
    ],
    single: [
      { match: /'/, token: 'string', pop: true },
      { include: 'stringBody' },
      { match: /[^'`%{]+|[%{]/, token: 'string' },
    ],
    stringBody: [
      { match: /`./, token: 'escape' },
      { match: /%[A-Za-z_]\w*%/, token: 'variable' },
      { match: /\{(?:[!^+#]?\w+(?:\s+(?:down|up|\d+))?|[!^+#{}])\}/i, token: 'escape' }, // Send keys: {Enter}, {Tab 3}
      { match: /$/, pop: true },
    ],
    comment: [
      { match: /\*\//, token: 'comment', pop: true },
      { match: /[^*]+|\*/, token: 'comment' },
    ],
  },
}
