/** The themes the tokens cover. */
export type ThemeName = 'light' | 'dark'

/**
 * Applies a theme to an element and everything in it, by setting `data-theme`. The tokens themselves come from
 * `@tensorai-workspace/theme/styles.css`; without a `data-theme`, the light theme applies.
 */
export function applyTheme(element: HTMLElement, theme: ThemeName): void {
  element.dataset.theme = theme
}

/** A theme color as a CSS value, by its key: `color('editor.background')` → `var(--ws-color-editor-background)`. */
export function color(key: string): string {
  return `var(--ws-color-${key.replace(/\./g, '-')})`
}

export { appearanceAttributes, appearanceKey, appearanceStyle, applyAppearance, SYNTAX_COLORS, type Appearance, type SyntaxColor } from './appearance.js'
