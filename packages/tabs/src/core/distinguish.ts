/**
 * Short descriptions that tell apart tabs with the same name: the fewest folders, from the file up, that no other one
 * shares. "…/" marks folders left out above. Paths use "/". Undefined where the name alone is enough.
 */
export function distinguish(paths: readonly string[]): (string | undefined)[] {
  const split = paths.map((p) => p.split('/').filter(Boolean))
  const nameOf = (parts: string[]) => parts[parts.length - 1] ?? ''
  return split.map((parts, i) => {
    const same = split.filter((other, j) => j !== i && nameOf(other) === nameOf(parts) && other.join('/') !== parts.join('/'))
    if (!same.length) return undefined
    const dirs = parts.slice(0, -1)
    if (!dirs.length) return undefined
    const tail = (p: string[], n: number) => p.slice(0, -1).slice(-n).join('/')
    for (let n = 1; n < dirs.length; n++) if (same.every((other) => tail(other, n) !== tail(parts, n))) return `…/${tail(parts, n)}`
    return dirs.join('/')
  })
}
