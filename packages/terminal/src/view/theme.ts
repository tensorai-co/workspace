import { blend, hex, palette, type Theme } from '../core/colors.js'
import type { ColorRequest, ColorSlot } from '../core/screen.js'

const NAMES = ['Black', 'Red', 'Green', 'Yellow', 'Blue', 'Magenta', 'Cyan', 'White']
/** Where there are no styles to read, as in tests: the light theme. */
const FALLBACK: Theme = {
  foreground: 0x3b3b3b,
  background: 0xfafafd,
  cursor: 0x202020,
  cursorText: 0xffffff,
  selection: 0xd5e4f6,
  selectionInactive: 0xe5ebf1,
  ansi: [0x000000, 0xcd3131, 0x107c10, 0x949800, 0x0451a5, 0xbc05bc, 0x0598bc, 0x555555, 0x666666, 0xf14c4c, 0x14ce14, 0xb5ba00, 0x3b8eea, 0xd670d6, 0x29b8db, 0xa5a5a5],
}

/** The colors a terminal is drawn with: the theme's, and those programs set over them. */
export class Colors {
  theme = FALLBACK
  /** The theme's own, before programs changed any. */
  private base = FALLBACK
  /** All 256. */
  all = palette(FALLBACK.ansi)
  /** Changes with the colors. */
  version = 0
  private readonly set = new Map<ColorSlot, number>()

  /** Reads the theme's colors from the styles on an element. */
  read(element: HTMLElement): void {
    const probe = document.createElement('span')
    probe.style.cssText = 'position:absolute;visibility:hidden'
    element.appendChild(probe)
    const get = (css: string): { rgb: number; alpha: number } | undefined => {
      probe.style.color = ''
      probe.style.color = css
      return parse(getComputedStyle(probe).color)
    }
    const rgb = (css: string, fallback: number) => get(css)?.rgb ?? fallback
    const background = rgb('var(--ws-color-terminal-background, var(--ws-color-panel-background))', FALLBACK.background)
    const foreground = rgb('var(--ws-color-terminal-foreground)', FALLBACK.foreground)
    const over = (css: string, fallback: number) => {
      const color = get(css)
      return color ? blend(background, color.rgb, color.alpha) : fallback
    }
    this.base = {
      background,
      foreground,
      cursor: rgb(`var(--ws-color-terminalCursor-foreground, ${hex(foreground)})`, FALLBACK.cursor),
      cursorText: rgb(`var(--ws-color-terminalCursor-background, ${hex(background)})`, FALLBACK.cursorText),
      selection: over('var(--ws-color-terminal-selectionBackground)', FALLBACK.selection),
      selectionInactive: over('var(--ws-color-terminal-inactiveSelectionBackground, var(--ws-color-terminal-selectionBackground))', FALLBACK.selectionInactive),
      ansi: FALLBACK.ansi.map((fallback, i) => rgb(`var(--ws-color-terminal-ansi${i < 8 ? '' : 'Bright'}${NAMES[i % 8]})`, fallback)),
    }
    probe.remove()
    this.apply()
  }

  /** Follows a program's request. Returns the color when it asked for one. */
  request(request: ColorRequest): number | undefined {
    const { slot } = request
    if (request.type === 'get') return this.get(slot as ColorSlot)
    if (request.type === 'set') this.set.set(request.slot, request.rgb)
    else if (slot === 'palette') {
      for (const key of [...this.set.keys()]) if (typeof key === 'number') this.set.delete(key)
    } else this.set.delete(slot)
    this.apply()
    return undefined
  }

  get(slot: ColorSlot): number {
    if (typeof slot === 'number') return this.all[slot] ?? 0
    return this.theme[slot]
  }

  private apply() {
    const { base, set } = this
    const at = (slot: 'foreground' | 'background' | 'cursor') => set.get(slot) ?? base[slot]
    this.theme = { ...base, foreground: at('foreground'), background: at('background'), cursor: at('cursor') }
    this.all = palette(base.ansi).map((color, i) => set.get(i) ?? color)
    this.version++
  }
}

/** A computed color: rgb(), rgba(), or the color() that mixing makes. */
function parse(color: string): { rgb: number; alpha: number } | undefined {
  const plain = /^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/.exec(color)
  if (plain) return { rgb: (Number(plain[1]) << 16) | (Number(plain[2]) << 8) | Number(plain[3]), alpha: plain[4] === undefined ? 1 : Number(plain[4]) }
  const mixed = /^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)$/.exec(color)
  if (!mixed) return undefined
  const [r, g, b] = mixed.slice(1, 4).map((v) => Math.round(Number(v) * 255))
  return { rgb: (r! << 16) | (g! << 8) | b!, alpha: mixed[4] === undefined ? 1 : Number(mixed[4]) }
}
