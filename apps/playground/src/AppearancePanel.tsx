import type { Appearance } from '@tensorai-co/workspace/theme'

const CODE_FONTS: Record<string, string | undefined> = {
  Default: undefined,
  'SF Mono': "'SF Mono', Menlo, monospace",
  Courier: "'Courier New', monospace",
  'JetBrains Mono': "'JetBrains Mono', Menlo, monospace",
}
const UI_FONTS: Record<string, string | undefined> = {
  Default: undefined,
  Serif: "Georgia, 'Times New Roman', serif",
  Rounded: "ui-rounded, 'SF Pro Rounded', system-ui, sans-serif",
}
const ACCENTS = ['', '#0069cc', '#c2185b', '#2e7d32', '#e65100', '#6a1b9a']

/** The keys an accent color sets. */
function accentColors(accent: string): Record<string, string> {
  return accent ? { focusBorder: accent, 'button.background': accent, 'list.focusOutline': accent, 'activityBar.activeBorder': accent, 'textLink.foreground': accent, 'inputOption.activeBorder': accent } : {}
}

/** Every appearance option, to try them: the sidebar view the playground adds. */
export function AppearancePanel({ value, onChange }: { value: Appearance & { accent?: string }; onChange: (value: Appearance & { accent?: string }) => void }) {
  const set = (patch: Partial<Appearance & { accent?: string }>) => onChange({ ...value, ...patch })
  const fonts = value.fonts ?? {}
  const flat = value.layout === 'flat'
  const pick = (fontsOf: Record<string, string | undefined>, current: string | undefined) => Object.keys(fontsOf).find((k) => fontsOf[k] === current) ?? 'Default'
  return (
    <form className="appearance" onSubmit={(e) => e.preventDefault()}>
      <fieldset>
        <legend>Theme</legend>
        {(['light', 'dark'] as const).map((t) => (
          <label key={t}>
            <input type="radio" name="theme" checked={(value.theme ?? 'light') === t} onChange={() => set({ theme: t })} /> {t === 'light' ? 'Light' : 'Dark'}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Layout</legend>
        {(['rounded', 'flat'] as const).map((l) => (
          <label key={l}>
            <input type="radio" name="layout" checked={(value.layout ?? 'rounded') === l} onChange={() => set({ layout: l, radius: undefined, smallRadius: undefined, gap: undefined })} /> {l === 'rounded' ? 'Rounded cards' : 'Flat panes'}
          </label>
        ))}
      </fieldset>
      <label>
        Corners <output>{value.radius ?? (flat ? 0 : 8)}px</output>
        <input type="range" min={0} max={16} value={value.radius ?? (flat ? 0 : 8)} onChange={(e) => set({ radius: Number(e.target.value), smallRadius: Math.round(Number(e.target.value) / 2) })} />
      </label>
      <label>
        Gap <output>{flat ? 0 : (value.gap ?? 4)}px</output>
        <input type="range" min={0} max={12} disabled={flat} value={flat ? 0 : (value.gap ?? 4)} onChange={(e) => set({ gap: Number(e.target.value) })} />
      </label>
      <label className="appearance-check">
        <input type="checkbox" checked={value.shadows !== false} onChange={(e) => set({ shadows: e.target.checked ? undefined : false })} /> Shadows
      </label>
      <label>
        Accent
        <span className="appearance-swatches">
          {ACCENTS.map((a) => (
            <button key={a || 'none'} type="button" title={a || 'Theme’s own'} aria-pressed={(value.accent ?? '') === a} style={{ background: a || 'none' }} onClick={() => set({ accent: a || undefined, colors: accentColors(a) })} />
          ))}
        </span>
      </label>
      <label>
        Interface font
        <select value={pick(UI_FONTS, fonts.ui)} onChange={(e) => set({ fonts: { ...fonts, ui: UI_FONTS[e.target.value] } })}>
          {Object.keys(UI_FONTS).map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </label>
      <label>
        Code font
        <select value={pick(CODE_FONTS, fonts.code)} onChange={(e) => set({ fonts: { ...fonts, code: CODE_FONTS[e.target.value] } })}>
          {Object.keys(CODE_FONTS).map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </label>
      <label>
        Code size <output>{fonts.codeSize ?? 12}px</output>
        <input type="range" min={10} max={20} value={fonts.codeSize ?? 12} onChange={(e) => set({ fonts: { ...fonts, codeSize: Number(e.target.value), lineHeight: Math.round(Number(e.target.value) * 1.5) } })} />
      </label>
      <button type="button" className="appearance-reset" onClick={() => onChange({})}>
        Reset
      </button>
    </form>
  )
}
