import * as c from './commands.js'
import type { Command } from './commands.js'

/** A key binding: a key ("Mod-d", "Shift-Alt-ArrowUp"), and its command. Mod is Cmd on macOS, Ctrl elsewhere. */
export interface KeyBinding {
  key: string
  /** Overrides key on macOS. */
  mac?: string
  run: Command
}

/** The default editing keys. */
export const defaultKeymap: KeyBinding[] = [
  { key: 'ArrowLeft', run: c.cursorLeft },
  { key: 'ArrowRight', run: c.cursorRight },
  { key: 'ArrowUp', run: c.cursorUp },
  { key: 'ArrowDown', run: c.cursorDown },
  { key: 'Shift-ArrowLeft', run: c.selectLeft },
  { key: 'Shift-ArrowRight', run: c.selectRight },
  { key: 'Shift-ArrowUp', run: c.selectUp },
  { key: 'Shift-ArrowDown', run: c.selectDown },
  { key: 'Ctrl-ArrowLeft', mac: 'Alt-ArrowLeft', run: c.cursorWordLeft },
  { key: 'Ctrl-ArrowRight', mac: 'Alt-ArrowRight', run: c.cursorWordRight },
  { key: 'Shift-Ctrl-ArrowLeft', mac: 'Shift-Alt-ArrowLeft', run: c.selectWordLeft },
  { key: 'Shift-Ctrl-ArrowRight', mac: 'Shift-Alt-ArrowRight', run: c.selectWordRight },
  { key: 'Home', mac: 'Mod-ArrowLeft', run: c.cursorLineStart },
  { key: 'End', mac: 'Mod-ArrowRight', run: c.cursorLineEnd },
  { key: 'Shift-Home', mac: 'Shift-Mod-ArrowLeft', run: c.selectLineStart },
  { key: 'Shift-End', mac: 'Shift-Mod-ArrowRight', run: c.selectLineEnd },
  { key: 'Ctrl-Home', mac: 'Mod-ArrowUp', run: c.cursorDocStart },
  { key: 'Ctrl-End', mac: 'Mod-ArrowDown', run: c.cursorDocEnd },
  { key: 'Shift-Ctrl-Home', mac: 'Shift-Mod-ArrowUp', run: c.selectDocStart },
  { key: 'Shift-Ctrl-End', mac: 'Shift-Mod-ArrowDown', run: c.selectDocEnd },
  { key: 'PageUp', run: c.cursorPageUp },
  { key: 'PageDown', run: c.cursorPageDown },
  { key: 'Shift-PageUp', run: c.selectPageUp },
  { key: 'Shift-PageDown', run: c.selectPageDown },
  { key: 'Mod-a', run: c.selectAll },
  { key: 'Mod-l', run: c.selectLine },
  { key: 'Escape', run: c.collapseSelections },
  { key: 'Enter', run: c.insertNewline },
  { key: 'Shift-Enter', run: c.insertNewline },
  { key: 'Mod-Enter', run: c.insertBlankLine(1) },
  { key: 'Shift-Mod-Enter', run: c.insertBlankLine(-1) },
  { key: 'Tab', run: c.indentMore },
  { key: 'Shift-Tab', run: c.indentLess },
  { key: 'Mod-]', run: c.indentSelectedLines },
  { key: 'Mod-[', run: c.indentLess },
  { key: 'Backspace', run: c.deleteBackward },
  { key: 'Shift-Backspace', run: c.deleteBackward },
  { key: 'Delete', run: c.deleteForward },
  { key: 'Ctrl-Backspace', mac: 'Alt-Backspace', run: c.deleteWordBackward },
  { key: 'Ctrl-Delete', mac: 'Alt-Delete', run: c.deleteWordForward },
  { key: 'Mod-Backspace', run: c.deleteToLineStart },
  { key: 'Shift-Mod-k', run: c.deleteLine },
  { key: 'Alt-ArrowUp', run: c.moveLines(-1) },
  { key: 'Alt-ArrowDown', run: c.moveLines(1) },
  { key: 'Shift-Alt-ArrowUp', run: c.copyLines(-1) },
  { key: 'Shift-Alt-ArrowDown', run: c.copyLines(1) },
  { key: 'Ctrl-Alt-ArrowUp', mac: 'Alt-Mod-ArrowUp', run: c.addCursorVertical(-1) },
  { key: 'Ctrl-Alt-ArrowDown', mac: 'Alt-Mod-ArrowDown', run: c.addCursorVertical(1) },
  { key: 'Mod-d', run: c.selectNextOccurrence },
  { key: 'Shift-Mod-l', run: c.selectAllOccurrences },
  { key: 'Mod-/', run: c.toggleLineComment },
  { key: 'Shift-Alt-a', run: c.toggleBlockComment },
  { key: 'Mod-z', run: c.undo },
  { key: 'Shift-Mod-z', run: c.redo },
  { key: 'Mod-y', mac: 'Shift-Mod-z', run: c.redo },
]

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

/** The key string for a keyboard event: modifiers in a fixed order, then the key. */
export function keyName(e: KeyboardEvent, mac = isMac): string {
  const parts: string[] = []
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')
  if (mac ? e.ctrlKey : false) parts.push('Ctrl')
  if (mac ? e.metaKey : e.ctrlKey) parts.push('Mod')
  if (!mac && e.metaKey) parts.push('Meta')
  // With Alt on macOS, e.key is the composed character (Alt-a → "å"); use the physical key instead.
  let key = e.key
  if (e.altKey && /^Key[A-Z]$/.test(e.code)) key = e.code.slice(3).toLowerCase()
  else if (key.length === 1) key = key.toLowerCase()
  parts.push(key)
  return parts.join('-')
}

/** Normalizes a binding's key to keyName's form, for the current platform. */
function normalize(binding: KeyBinding, mac: boolean): string {
  const raw = (mac && binding.mac) || binding.key
  const parts = raw.split('-')
  const key = parts.pop()!
  const mods = new Set(parts.map((p) => (p === 'Cmd' || p === 'Meta' ? (mac ? 'Mod' : 'Meta') : p === 'Ctrl' && !mac ? 'Mod' : p)))
  const ordered = ['Shift', 'Alt', 'Ctrl', 'Mod', 'Meta'].filter((m) => mods.has(m))
  return [...ordered, key.length === 1 ? key.toLowerCase() : key].join('-')
}

/** A lookup from key names to commands. Later bindings for the same key win. */
export function buildKeymap(bindings: KeyBinding[], mac = isMac): Map<string, Command> {
  const map = new Map<string, Command>()
  for (const b of bindings) map.set(normalize(b, mac), b.run)
  return map
}
