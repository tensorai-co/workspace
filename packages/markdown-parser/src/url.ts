/** The only URL schemes a rendered link may use. */
const SCHEMES = new Set(['http:', 'https:', 'mailto:'])

/**
 * safeUrl returns the URL to link to, or undefined when it mustn't be a link:
 * anything that isn't absolute http, https or mailto (javascript:, data:,
 * relative paths), and web URLs with a user name or password in them, which
 * can disguise where a link goes (https://bank.example@evil.example).
 */
export function safeUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    return undefined
  }
  if (!SCHEMES.has(parsed.protocol)) return undefined
  if (parsed.protocol !== 'mailto:' && (parsed.username || parsed.password)) return undefined
  return parsed.href
}

/** Characters a link destination keeps as they are. */
const KEEP = /[A-Za-z0-9;/?:@&=+$,\-_.!~*'()#]/

/**
 * encodeUrl percent-encodes a link destination the way CommonMark's reference
 * renderer does: spaces and non-ASCII characters are encoded, and %XX escapes
 * already there are kept.
 */
export function encodeUrl(url: string): string {
  let out = ''
  for (let i = 0; i < url.length; i++) {
    const ch = url[i]!
    if (ch === '%' && /^[0-9a-fA-F]{2}$/.test(url.slice(i + 1, i + 3))) {
      out += url.slice(i, i + 3)
      i += 2
    } else if (KEEP.test(ch)) {
      out += ch
    } else {
      const code = url.charCodeAt(i)
      if (code >= 0xd800 && code <= 0xdbff && i + 1 < url.length) {
        const next = url.charCodeAt(i + 1)
        if (next >= 0xdc00 && next <= 0xdfff) {
          out += encodeURIComponent(url.slice(i, i + 2))
          i++
          continue
        }
      }
      out += code >= 0xd800 && code <= 0xdfff ? '%EF%BF%BD' : encodeURIComponent(ch)
    }
  }
  return out
}
