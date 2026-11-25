/** A stretch of a label that matched what was typed: [start, end). */
export type MatchRange = [start: number, end: number]

export interface FuzzyMatch {
  /** Higher is better. */
  score: number
  matches: MatchRange[]
}

/** Text longer than this is matched on its start only. Long enough for file paths. */
const MAX_WORD = 512

function isSeparator(ch: string): boolean {
  return ch === '_' || ch === '-' || ch === '.' || ch === ' ' || ch === '/' || ch === '\\' || ch === '$' || ch === ':' || ch === '(' || ch === '<'
}

function isUpper(ch: string): boolean {
  return ch !== ch.toLowerCase() && ch === ch.toUpperCase()
}

/** Where a word part starts: the label's start, after a separator, or a capital after a small letter. */
function startsPart(word: string, j: number): boolean {
  if (j === 0) return true
  const prev = word[j - 1]!
  return isSeparator(prev) || (isUpper(word[j]!) && !isUpper(prev))
}

/**
 * How well a typed pattern matches a label suggest list filters: the pattern's characters in order,
 * any case, best at the label's start, at word parts ("gEBI" in "getElementById") and in runs. Matches inside a
 * word count for less. Undefined when the characters aren't all there in order.
 */
export function fuzzyScore(pattern: string, word: string): FuzzyMatch | undefined {
  if (!pattern) return { score: 0, matches: [] }
  const w = word.slice(0, MAX_WORD)
  const p = pattern
  const n = p.length
  const m = w.length
  if (n > m) return undefined
  const lp = p.toLowerCase()
  const lw = w.toLowerCase()

  // best[i][j]: the best score with p[0..i] matched and p[i] at w[j]; -Infinity when impossible.
  const best: Float64Array[] = []
  const from: Int32Array[] = []
  // gapBest[j]: the best of the previous row before j - 1, and where it is, so each cell is one step.
  const gapBest = new Float64Array(m)
  const gapAt = new Int32Array(m)
  for (let i = 0; i < n; i++) {
    const row = new Float64Array(m).fill(-Infinity)
    const back = new Int32Array(m).fill(-1)
    if (i > 0) {
      const prev = best[i - 1]!
      let top = -Infinity
      let at = -1
      for (let j = 0; j < m; j++) {
        gapBest[j] = top
        gapAt[j] = at
        // What j + 1 sees: the best up to j - 1.
        const k = j - 1
        if (k >= 0 && prev[k]! > top) (top = prev[k]!), (at = k)
      }
    }
    for (let j = i; j < m; j++) {
      if (lp[i] !== lw[j]) continue
      let gain = 1
      if (p[i] === w[j]) gain += 1
      if (j === 0) gain += 8
      else if (startsPart(w, j)) gain += 7
      if (i === 0) {
        // A first match inside a word is weak.
        row[j] = gain - (j && !startsPart(w, j) ? 4 : 0) - Math.min(j, 3) * 0.1
        continue
      }
      // Right after the previous match is a run; anywhere before it is a gap.
      const prev = best[i - 1]!
      const run = prev[j - 1]! + gain + 5
      const gap = gapBest[j]! - 0.5 + gain
      if (run >= gap && prev[j - 1] !== -Infinity) (row[j] = run), (back[j] = j - 1)
      else if (gapAt[j]! >= 0) (row[j] = gap), (back[j] = gapAt[j]!)
    }
    best.push(row)
    from.push(back)
  }
  const last = best[n - 1]!
  let end = -1
  for (let j = 0; j < m; j++) if (last[j] !== -Infinity && (end < 0 || last[j]! > last[end]!)) end = j
  if (end < 0) return undefined

  const at: number[] = []
  for (let i = n - 1, j = end; i >= 0; j = from[i]![j]!, i--) at.unshift(j)
  const matches: MatchRange[] = []
  for (const j of at) {
    const run = matches[matches.length - 1]
    if (run && run[1] === j) run[1] = j + 1
    else matches.push([j, j + 1])
  }
  // A label that is exactly what was typed comes first.
  const exact = lw === lp ? 4 : 0
  return { score: last[end]! + exact, matches }
}

/**
 * the "graceful" filtering: when the pattern doesn't match, two neighboring characters swapped may, as in a
 * typo. Such matches score lower.
 */
export function fuzzyScoreGraceful(pattern: string, word: string): FuzzyMatch | undefined {
  const exact = fuzzyScore(pattern, word)
  if (exact || pattern.length < 2) return exact
  let found: FuzzyMatch | undefined
  for (let i = 0; i < pattern.length - 1; i++) {
    const swapped = pattern.slice(0, i) + pattern[i + 1] + pattern[i] + pattern.slice(i + 2)
    const r = fuzzyScore(swapped, word)
    if (r && (!found || r.score > found.score)) found = r
  }
  return found && { score: found.score - 6, matches: found.matches }
}
