import { describe, expect, it } from 'vitest'
import { appearanceKey, appearanceStyle, applyAppearance, color } from '../src/index.js'

describe('appearance', () => {
  it('turns options into custom properties, and leaves out what isn’t set', () => {
    expect(appearanceStyle({})).toEqual({})
    expect(
      appearanceStyle({
        radius: 12,
        smallRadius: 6,
        gap: 8,
        shadows: false,
        fonts: { ui: 'Georgia, serif', code: "'SF Mono', monospace", codeSize: 14, lineHeight: 21 },
        colors: { 'editor.background': '#fffdf5', focusBorder: '#c2185b', 'list-hoverBackground': '#eee' },
        syntax: { keyword: '#af00db', string: '#a31515' },
        brackets: ['#111', '#222', '#333', '#444'],
      }),
    ).toEqual({
      '--ws-radius': '12px',
      '--ws-radius-small': '6px',
      '--ws-gap': '8px',
      '--ws-shadow': 'none',
      '--ws-shadow-dialog': 'none',
      '--ws-font-ui': 'Georgia, serif',
      '--ws-font-code': "'SF Mono', monospace",
      '--ws-font-code-size': '14px',
      '--ws-line-height': '21px',
      '--ws-color-editor-background': '#fffdf5',
      '--ws-color-focusBorder': '#c2185b',
      '--ws-color-list-hoverBackground': '#eee',
      '--ws-token-keyword': '#af00db',
      '--ws-token-string': '#a31515',
      '--ws-bracket-1': '#111',
      '--ws-bracket-2': '#222',
      '--ws-bracket-3': '#333',
    })
  })

  it('applies to an element, and a new one takes back what the last set', () => {
    const el = document.createElement('div')
    applyAppearance(el, { theme: 'dark', layout: 'flat', radius: 2, colors: { focusBorder: 'red' } })
    expect(el.dataset).toMatchObject({ theme: 'dark', layout: 'flat' })
    expect(el.style.getPropertyValue('--ws-radius')).toBe('2px')
    expect(el.style.getPropertyValue('--ws-color-focusBorder')).toBe('red')
    applyAppearance(el, { gap: 6 })
    expect(el.dataset.theme).toBeUndefined()
    expect(el.dataset.layout).toBeUndefined()
    expect(el.style.getPropertyValue('--ws-radius')).toBe('')
    expect(el.style.getPropertyValue('--ws-color-focusBorder')).toBe('')
    expect(el.style.getPropertyValue('--ws-gap')).toBe('6px')
    expect(el.dataset.appearance).toBe(appearanceKey({ gap: 6 }))
  })

  it('names theme colors by key', () => {
    expect(color('editor.background')).toBe('var(--ws-color-editor-background)')
  })
})
