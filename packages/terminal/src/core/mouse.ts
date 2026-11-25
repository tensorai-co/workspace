import type { Modes } from './screen.js'

/** A mouse event over the screen. */
export interface TerminalMouse {
  action: 'press' | 'release' | 'move' | 'wheel'
  /** For the wheel: 0 up, 1 down, 2 left, 3 right. For a move with nothing held, -1. */
  button: number
  /** The cell, from 0. */
  x: number
  y: number
  /** The pixel, from the screen's corner. */
  px: number
  py: number
  shiftKey: boolean
  altKey: boolean
  ctrlKey: boolean
}

/** What a mouse event sends to a program that asked for the mouse, if it asked for this one. */
export function encodeMouse(e: TerminalMouse, modes: Pick<Modes, 'mouse' | 'mouseEncoding'>): string | undefined {
  const { mouse } = modes
  if (mouse === 'none') return undefined
  if (mouse === 'x10' && e.action !== 'press') return undefined
  if (e.action === 'move' && (mouse === 'press' || (mouse === 'drag' && e.button < 0))) return undefined

  let code = e.action === 'wheel' ? 64 + e.button : e.button < 0 ? 3 : e.button
  if (e.action === 'move') code += 32
  if (mouse !== 'x10') code += (e.shiftKey ? 4 : 0) + (e.altKey ? 8 : 0) + (e.ctrlKey ? 16 : 0)

  if (modes.mouseEncoding === 'default') {
    // One byte each, so there's a limit to how far out it can say.
    if (e.x > 222 || e.y > 222) return undefined
    const button = e.action === 'release' ? (code & ~3) | 3 : code
    return `\x1b[M${String.fromCharCode(button + 32, e.x + 33, e.y + 33)}`
  }
  const [x, y] = modes.mouseEncoding === 'pixels' ? [Math.max(0, Math.round(e.px)), Math.max(0, Math.round(e.py))] : [e.x + 1, e.y + 1]
  return `\x1b[<${code};${x};${y}${e.action === 'release' ? 'm' : 'M'}`
}
