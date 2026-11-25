import type { Modes } from './screen.js'

/** A key press, as a DOM KeyboardEvent has it. */
export interface TerminalKey {
  key: string
  code: string
  shiftKey: boolean
  ctrlKey: boolean
  altKey: boolean
  metaKey: boolean
}

export interface KeyOptions {
  mac: boolean
  /** On a Mac, Option makes Meta sequences in place of special characters. Off by default. */
  optionIsMeta?: boolean
}

const CURSOR: Record<string, string> = { ArrowUp: 'A', ArrowDown: 'B', ArrowRight: 'C', ArrowLeft: 'D', Home: 'H', End: 'F' }
const FUNCTION_LETTERS: Record<string, string> = { F1: 'P', F2: 'Q', F3: 'R', F4: 'S' }
const TILDE: Record<string, number> = { Insert: 2, Delete: 3, PageUp: 5, PageDown: 6, F5: 15, F6: 17, F7: 18, F8: 19, F9: 20, F10: 21, F11: 23, F12: 24 }

/** What goes to the shell for editing keys on a Mac, where shells know other ones. */
function macEditing(e: TerminalKey): string | undefined {
  if (e.shiftKey || e.ctrlKey) return undefined
  if (e.metaKey && !e.altKey) return { ArrowLeft: '\x01', ArrowRight: '\x05', Backspace: '\x15' }[e.key]
  if (e.altKey && !e.metaKey) return { ArrowLeft: '\x1bb', ArrowRight: '\x1bf', ArrowUp: '\x1b[1;5A', ArrowDown: '\x1b[1;5B', Backspace: '\x17', Delete: '\x1bd' }[e.key]
  return undefined
}

/**
 * What a key sends to the program, as xterm's keyboard does it. Undefined for keys that type text, which comes from the
 * input element instead, and for those that mean nothing here.
 */
export function encodeKey(e: TerminalKey, modes: Pick<Modes, 'applicationCursor'>, { mac, optionIsMeta = false }: KeyOptions): string | undefined {
  if (mac) {
    const edit = macEditing(e)
    if (edit) return edit
  }
  if (e.metaKey) return undefined

  const modifier = (e.shiftKey ? 1 : 0) + (e.altKey ? 2 : 0) + (e.ctrlKey ? 4 : 0)
  const meta = e.altKey && (!mac || optionIsMeta)

  const cursor = CURSOR[e.key]
  if (cursor) {
    if (modifier) return `\x1b[1;${modifier + 1}${cursor}`
    return modes.applicationCursor ? `\x1bO${cursor}` : `\x1b[${cursor}`
  }
  const letter = FUNCTION_LETTERS[e.key]
  if (letter) return modifier ? `\x1b[1;${modifier + 1}${letter}` : `\x1bO${letter}`
  const tilde = TILDE[e.key]
  if (tilde) return modifier ? `\x1b[${tilde};${modifier + 1}~` : `\x1b[${tilde}~`

  switch (e.key) {
    case 'Enter':
      return e.altKey ? '\x1b\r' : '\r'
    case 'Tab':
      return e.shiftKey ? '\x1b[Z' : '\t'
    case 'Escape':
      return e.altKey ? '\x1b\x1b' : '\x1b'
    case 'Backspace': {
      const back = e.ctrlKey ? '\b' : '\x7f'
      return e.altKey ? `\x1b${back}` : back
    }
  }

  if (e.ctrlKey) {
    const control = controlOf(e)
    if (control !== undefined) return meta ? `\x1b${control}` : control
    return undefined
  }
  if (meta) {
    // Option types another character on a Mac: take the key itself.
    const plain = mac ? keyOf(e.code, e.shiftKey) : e.key.length === 1 ? e.key : undefined
    return plain === undefined ? undefined : `\x1b${plain}`
  }
  return undefined
}

/** The control character of Ctrl and a key. */
function controlOf(e: TerminalKey): string | undefined {
  const letter = /^Key([A-Z])$/.exec(e.code)?.[1] ?? (/^[a-z]$/i.test(e.key) ? e.key.toUpperCase() : undefined)
  if (letter) return String.fromCharCode(letter.charCodeAt(0) - 64)
  switch (e.key) {
    case ' ':
    case '@':
    case '2':
      return '\x00'
    case '[':
    case '3':
      return '\x1b'
    case '\\':
    case '4':
      return '\x1c'
    case ']':
    case '5':
      return '\x1d'
    case '^':
    case '6':
      return '\x1e'
    case '_':
    case '-':
    case '/':
    case '7':
      return '\x1f'
    case '8':
    case '?':
      return '\x7f'
  }
  return undefined
}

function keyOf(code: string, shift: boolean): string | undefined {
  const letter = /^Key([A-Z])$/.exec(code)?.[1]
  if (letter) return shift ? letter : letter.toLowerCase()
  const digit = /^Digit(\d)$/.exec(code)?.[1]
  if (digit) return shift ? ')!@#$%^&*('[Number(digit)] : digit
  const marks: Record<string, string> = { Minus: '-_', Equal: '=+', BracketLeft: '[{', BracketRight: ']}', Backslash: '\\|', Semicolon: ';:', Quote: '\'"', Comma: ',<', Period: '.>', Slash: '/?', Backquote: '`~', Space: '  ' }
  return marks[code]?.[shift ? 1 : 0]
}

/**
 * Pasted text, ready to send: line breaks as the Return key sends them, and marked as a paste for programs that asked.
 * An escape character in it can't end the marking early, or run anything.
 */
export function encodePaste(text: string, modes: Pick<Modes, 'bracketedPaste'>): string {
  const lines = text.replace(/\r?\n/g, '\r')
  return modes.bracketedPaste ? `\x1b[200~${lines.replace(/\x1b/g, '␛')}\x1b[201~` : lines
}
