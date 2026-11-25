import { codicons, type CodiconName } from './data/codicons.js'
import { setiDefinitions, setiGlyphs, setiMap } from './data/seti.js'

export { codicons, type CodiconName }

/** An icon ready to draw: an SVG viewBox, its inner markup (shapes only, from our own assets) and its color. */
export interface Icon {
  viewBox: string
  body: string
  /** The color to draw in, or undefined for currentColor. */
  color: string | undefined
}

export interface FileIconOptions {
  theme?: 'light' | 'dark'
  /** The file's language id ("typescriptreact"), when known: some icons go by language. */
  languageId?: string
}

/**
 * The Seti icon for a file: exact file name, then extensions from the longest
 * ("test.tsx", then "tsx"), then language, then the default file icon. Folders have no icon in Seti.
 */
export function fileIcon(name: string, options: FileIconOptions = {}): Icon | undefined {
  const table = setiMap[options.theme ?? 'light']
  const lower = (name.split(/[\\/]/).pop() ?? name).toLowerCase()
  let id: string | undefined = (table.fileNames as Record<string, string>)[lower]
  if (!id) {
    let dot = lower.indexOf('.')
    while (!id && dot >= 0) {
      id = (table.fileExtensions as Record<string, string>)[lower.slice(dot + 1)]
      dot = lower.indexOf('.', dot + 1)
    }
  }
  if (!id && options.languageId) id = (table.languageIds as Record<string, string>)[options.languageId]
  id ??= table.file
  const def = setiDefinitions[id]
  if (!def) return undefined
  const glyph = setiGlyphs[def[0]]
  return glyph ? { viewBox: '0 0 1000 1000', body: `<path d="${glyph}"/>`, color: def[1] ?? undefined } : undefined
}

/** A UI icon from Codicons, drawn in currentColor. */
export function codicon(name: CodiconName): Icon {
  return { viewBox: '0 0 16 16', body: codicons[name], color: undefined }
}

/** An icon as an `<svg>` string. The markup comes from this package's own assets, never from input. */
export function iconSvg(icon: Icon, size: number, className = ''): string {
  const fill = icon.color ?? 'currentColor'
  return `<svg class="${className}" width="${size}" height="${size}" viewBox="${icon.viewBox}" fill="${fill}" aria-hidden="true">${icon.body}</svg>`
}
