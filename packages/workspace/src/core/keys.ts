/**
 * Keybindings: `cmd+k v`, `ctrl+\``, `shift+cmd+e`. A space separates the keys of a chord.
 * `mod` is ⌘ on macOS and Ctrl elsewhere.
 */

/** One key with its modifiers. `key` is lower case: a letter, a digit, a symbol, or a name such as `enter`. */
export interface Stroke {
  ctrl: boolean
  shift: boolean
  alt: boolean
  meta: boolean
  key: string
}

/** What a stroke is read from: a keyboard event, or anything with the same fields. */
export interface KeyEventLike {
  key: string
  code?: string
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  metaKey: boolean
}

const MODIFIERS: Record<string, keyof Omit<Stroke, 'key'> | 'mod'> = {
  ctrl: 'ctrl',
  control: 'ctrl',
  shift: 'shift',
  alt: 'alt',
  option: 'alt',
  opt: 'alt',
  cmd: 'meta',
  command: 'meta',
  meta: 'meta',
  win: 'meta',
  super: 'meta',
  mod: 'mod',
}

/** Other spellings of the same key. */
const ALIASES: Record<string, string> = {
  esc: 'escape',
  return: 'enter',
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
  del: 'delete',
  ins: 'insert',
  spacebar: 'space',
  ' ': 'space',
  plus: '+',
  minus: '-',
  backtick: '`',
}

const normalKey = (key: string) => ALIASES[key.toLowerCase()] ?? key.toLowerCase()

/** Reads one key of a binding, such as `shift+cmd+e`. */
export function parseStroke(text: string, mac: boolean): Stroke {
  const stroke: Stroke = { ctrl: false, shift: false, alt: false, meta: false, key: '' }
  // A trailing "+" is the plus key itself: "ctrl++".
  const parts = text.endsWith('++') ? [...text.slice(0, -2).split('+'), '+'] : text.split('+')
  parts.forEach((raw, i) => {
    const part = raw.trim().toLowerCase()
    const modifier = MODIFIERS[part]
    if (modifier && i < parts.length - 1) {
      stroke[modifier === 'mod' ? (mac ? 'meta' : 'ctrl') : modifier] = true
    } else if (i === parts.length - 1 && part) {
      stroke.key = normalKey(part)
    } else {
      throw new SyntaxError(`Can't read the key "${text}"`)
    }
  })
  if (!stroke.key) throw new SyntaxError(`No key in "${text}"`)
  return stroke
}

/** Reads a whole binding: one stroke, or the strokes of a chord. */
export function parseKeybinding(text: string, mac: boolean): Stroke[] {
  return text.trim().split(/\s+/).map((part) => parseStroke(part, mac))
}

/** Keys whose `code` names them better than `key`, which changes with Shift and Option. */
const CODES: Record<string, string> = {
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Space: 'space',
}

/**
 * The stroke of a key event, or undefined for a modifier pressed alone. Letters, digits and symbols are read by the
 * key's place on a US keyboard, as `⌥⌘B` gives "∫" on a Mac and Shift turns "-" into "_".
 */
export function strokeOf(e: KeyEventLike): Stroke | undefined {
  if (['Shift', 'Control', 'Alt', 'Meta', 'OS', 'CapsLock', 'Dead', 'Process', 'Unidentified'].includes(e.key)) return undefined
  const code = e.code ?? ''
  let key: string
  if (/^Key[A-Z]$/.test(code)) key = code.slice(3).toLowerCase()
  else if (/^Digit\d$/.test(code)) key = code.slice(5)
  else if (CODES[code]) key = CODES[code]!
  else key = normalKey(e.key)
  return { ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, meta: e.metaKey, key }
}

export const sameStroke = (a: Stroke, b: Stroke) => a.key === b.key && a.ctrl === b.ctrl && a.shift === b.shift && a.alt === b.alt && a.meta === b.meta

const MAC_KEYS: Record<string, string> = {
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  enter: 'Enter',
  escape: 'Escape',
  backspace: '⌫',
  delete: 'Delete',
  tab: 'Tab',
  space: 'Space',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  home: 'Home',
  end: 'End',
}
const OTHER_KEYS: Record<string, string> = {
  arrowup: 'UpArrow',
  arrowdown: 'DownArrow',
  arrowleft: 'LeftArrow',
  arrowright: 'RightArrow',
  enter: 'Enter',
  escape: 'Escape',
  backspace: 'Backspace',
  delete: 'Delete',
  tab: 'Tab',
  space: 'Space',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  home: 'Home',
  end: 'End',
}

const keyLabel = (key: string, mac: boolean) => (mac ? MAC_KEYS : OTHER_KEYS)[key] ?? (key.length === 1 ? key.toUpperCase() : key[0]!.toUpperCase() + key.slice(1))

/** A stroke: `⇧⌘E` on macOS, `Ctrl+Shift+E` elsewhere. */
export function strokeLabel(stroke: Stroke, mac: boolean): string {
  const key = keyLabel(stroke.key, mac)
  if (mac) return `${stroke.ctrl ? '⌃' : ''}${stroke.alt ? '⌥' : ''}${stroke.shift ? '⇧' : ''}${stroke.meta ? '⌘' : ''}${key}`
  return [stroke.ctrl && 'Ctrl', stroke.shift && 'Shift', stroke.alt && 'Alt', stroke.meta && 'Win', key].filter(Boolean).join('+')
}

/** A binding, with a space between the keys of a chord: `⌘K V`. */
export function keybindingLabel(strokes: readonly Stroke[], mac: boolean): string {
  return strokes.map((s) => strokeLabel(s, mac)).join(' ')
}

/** Whether this is a Mac, from the browser. False where there's no browser. */
export const isMacPlatform = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
