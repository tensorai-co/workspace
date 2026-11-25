import type { ThemeName } from './index.js'

/** The syntax colors `paintLine`'s classes take, by token type. */
export const SYNTAX_COLORS = ['keyword', 'storage', 'modifier', 'string', 'escape', 'number', 'comment', 'function', 'type', 'variable', 'property', 'constant', 'builtin', 'tag', 'operator', 'punctuation', 'regexp', 'meta', 'inserted', 'deleted'] as const
export type SyntaxColor = (typeof SYNTAX_COLORS)[number]

/**
 * How the components look. Everything is optional: what's left out keeps the theme's own value. It applies to an
 * element and everything in it, so two parts of a page can look different.
 */
export interface Appearance {
  /** The color theme. Light by default. */
  theme?: ThemeName
  /**
   * "rounded" (the default): the parts are cards with rounded corners and gaps between them. "flat": the parts meet
   * edge to edge with a line between them, and corners are square.
   */
  layout?: 'rounded' | 'flat'
  /** The corners of cards, menus, dialogs and widgets, in pixels. 8 when rounded, 0 when flat. */
  radius?: number
  /** The corners of buttons, list rows and other small things, in pixels. 4 when rounded, 0 when flat. */
  smallRadius?: number
  /** The space between cards, in pixels, when rounded. 4 by default. */
  gap?: number
  /** Whether menus, dialogs and widgets cast shadows. On by default. */
  shadows?: boolean
  fonts?: {
    /** The interface's font family, as CSS writes it. */
    ui?: string
    /** The font family of code: the editor, the terminal, code in Markdown. */
    code?: string
    /** The size of code, in pixels. 12 by default. */
    codeSize?: number
    /** The height of a line of code, in pixels. 18 by default. */
    lineHeight?: number
  }
  /**
   * Any theme color, by its key: `{ 'editor.background': '#fffdf5', focusBorder: '#c2185b' }`. The keys are the
   * tokens' names in `styles.css`, without the `--ws-color-` in front; dots and dashes are the same.
   */
  colors?: Record<string, string>
  /** Syntax colors by token type: `{ keyword: '#af00db', string: '#a31515' }`. */
  syntax?: Partial<Record<SyntaxColor, string>>
  /** The colors of brackets by how deep they are nested, in turn. */
  brackets?: readonly string[]
}

/** The CSS custom properties an appearance sets, beyond what its theme and layout bring. */
export function appearanceStyle(appearance: Appearance = {}): Record<string, string> {
  const out: Record<string, string> = {}
  const px = (n: number) => `${n}px`
  if (appearance.radius !== undefined) out['--ws-radius'] = px(appearance.radius)
  if (appearance.smallRadius !== undefined) out['--ws-radius-small'] = px(appearance.smallRadius)
  if (appearance.gap !== undefined) out['--ws-gap'] = px(appearance.gap)
  if (appearance.shadows === false) {
    out['--ws-shadow'] = 'none'
    out['--ws-shadow-dialog'] = 'none'
  }
  const fonts = appearance.fonts ?? {}
  if (fonts.ui) out['--ws-font-ui'] = fonts.ui
  if (fonts.code) out['--ws-font-code'] = fonts.code
  if (fonts.codeSize !== undefined) out['--ws-font-code-size'] = px(fonts.codeSize)
  if (fonts.lineHeight !== undefined) out['--ws-line-height'] = px(fonts.lineHeight)
  for (const [key, value] of Object.entries(appearance.colors ?? {})) out[`--ws-color-${key.replace(/\./g, '-')}`] = value
  for (const [type, value] of Object.entries(appearance.syntax ?? {})) if (value) out[`--ws-token-${type}`] = value
  appearance.brackets?.slice(0, 3).forEach((value, i) => (out[`--ws-bracket-${i + 1}`] = value))
  return out
}

/** The attributes an appearance sets: its theme and its layout. */
export function appearanceAttributes(appearance: Appearance = {}): { 'data-theme'?: ThemeName; 'data-layout'?: 'rounded' | 'flat' } {
  return { 'data-theme': appearance.theme, 'data-layout': appearance.layout }
}

const applied = new WeakMap<HTMLElement, string[]>()

/** A short name for an appearance, set as `data-appearance`, so views that read colors know when to read them again. */
export function appearanceKey(appearance: Appearance = {}): string {
  const text = JSON.stringify(appearance)
  let hash = 0
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0
  return (hash >>> 0).toString(36)
}

/**
 * Applies an appearance to an element and everything in it. Applying another replaces it, so what the last one set
 * and the new one doesn't goes back to the theme's.
 */
export function applyAppearance(element: HTMLElement, appearance: Appearance): void {
  for (const name of applied.get(element) ?? []) element.style.removeProperty(name)
  const style = appearanceStyle(appearance)
  for (const [name, value] of Object.entries(style)) element.style.setProperty(name, value)
  applied.set(element, Object.keys(style))
  for (const [name, value] of Object.entries(appearanceAttributes(appearance))) {
    if (value) element.setAttribute(name, value)
    else element.removeAttribute(name)
  }
  element.setAttribute('data-appearance', appearanceKey(appearance))
}
