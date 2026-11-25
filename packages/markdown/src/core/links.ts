import { safeUrl } from '@tensorai-co/workspace/markdown-parser'

/** Where the document is, for what it links to. Without a path, relative links lead nowhere. */
export interface Place {
  /** The document's path. */
  path?: string
  /** The folder that "/links" start from, and that links don't lead out of. */
  root?: string
}

export type LinkTarget =
  | { kind: 'web'; url: string }
  | { kind: 'anchor'; anchor: string }
  /** A file, and where in it: a heading's slug, or a line (`#L12`). */
  | { kind: 'file'; path: string; anchor?: string; line?: number }

const decode = (text: string) => {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

/** Joins a path to a folder, taking out "." and "..". */
export function resolvePath(dir: string, path: string): string {
  const out: string[] = []
  for (const part of `${dir}/${path}`.split('/')) {
    if (part === '..') out.pop()
    else if (part && part !== '.') out.push(part)
  }
  return '/' + out.join('/')
}

const isInside = (path: string, dir: string) => dir === '/' || path === dir || path.startsWith(`${dir}/`)

/** Where a link leads, or undefined when it mustn't lead anywhere (`javascript:`, a path out of the root). */
export function resolveLink(href: string, { path, root }: Place = {}): LinkTarget | undefined {
  const link = href.trim()
  if (!link) return undefined
  if (link.startsWith('#')) return { kind: 'anchor', anchor: decode(link.slice(1)) }
  const web = link.startsWith('//') ? `https:${link}` : link
  if (/^[a-z][a-z\d+.-]*:/i.test(web)) {
    const url = safeUrl(web)
    return url ? { kind: 'web', url } : undefined
  }
  const [, file, hash] = /^([^?#]*)(?:\?[^#]*)?(?:#(.*))?$/s.exec(link)!
  const named = decode(file!)
  const base = named.startsWith('/') ? (root ?? '/') : path === undefined ? undefined : path.slice(0, path.lastIndexOf('/'))
  if (!named || base === undefined) return undefined
  const full = resolvePath(base, named)
  if (root !== undefined && !isInside(full, resolvePath(root, ''))) return undefined
  const target: LinkTarget = { kind: 'file', path: full }
  if (hash) {
    const line = /^L?(\d+)(?:,\d+)?(?:-L?\d+(?:,\d+)?)?$/i.exec(hash)
    if (line) target.line = Math.max(1, Number(line[1]))
    else target.anchor = decode(hash)
  }
  return target
}

export type ImageTarget = { kind: 'web'; url: string } | { kind: 'file'; path: string }

/** Where an image is: on the web, in the file (`data:`), or in another file. */
export function resolveImage(src: string, place: Place = {}): ImageTarget | undefined {
  if (/^data:image\/(?:png|jpe?g|gif|webp|avif|bmp|svg\+xml)[;,]/i.test(src.trim())) return { kind: 'web', url: src.trim() }
  const target = resolveLink(src, place)
  if (target?.kind === 'web') return /^https?:/.test(target.url) ? { kind: 'web', url: target.url } : undefined
  return target?.kind === 'file' ? { kind: 'file', path: target.path } : undefined
}

const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', ico: 'image/x-icon', svg: 'image/svg+xml',
}

/** An image file's type, by its extension. */
export function imageType(path: string): string | undefined {
  return IMAGE_TYPES[/\.([^./]+)$/.exec(path)?.[1]?.toLowerCase() ?? '']
}
