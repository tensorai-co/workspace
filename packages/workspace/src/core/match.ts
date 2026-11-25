import { fuzzyScore } from '@tensorai-workspace/editor/core'

/** A matched stretch of a label: [start, end). */
export interface Match {
  start: number
  end: number
}

/** Lower case, without accents, so "Café" matches "cafe". */
const base = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const SEPARATORS = new Set('()[]{}<>`\'"-/;:,.?!'.split('').map((c) => c.charCodeAt(0)))
const isSeparator = (code: number) => code === 32 || code === 9 || SEPARATORS.has(code)
const same = (a: number, b: number) => a === b || (isSeparator(a) && isSeparator(b))

/** The query as one stretch of the label, anywhere in it. */
export function matchesSubstring(query: string, label: string): Match[] | null {
  if (!query) return []
  const at = base(label).indexOf(base(query))
  return at < 0 ? null : [{ start: at, end: at + query.length }]
}

function nextWord(text: string, start: number): number {
  for (let i = start; i < text.length; i++) if (isSeparator(text.charCodeAt(i)) || (i > 0 && isSeparator(text.charCodeAt(i - 1)))) return i
  return text.length
}

/**
 * Word starts: each character of the query matches in order, a run of them may continue a word, and a
 * new run starts at the start of a word. "tog side" matches "Toggle Primary Side Bar".
 */
export function matchesWords(query: string, label: string): Match[] | null {
  if (!label) return null
  const q = base(query)
  const t = base(label)
  const memo = new Map<number, Match[] | null>()
  const at = (qi: number, ti: number): Match[] | null => {
    if (qi === q.length) return []
    if (ti === t.length) return null
    const key = qi * (t.length + 1) + ti
    if (memo.has(key)) return memo.get(key)!
    let result: Match[] | null = null
    if (same(q.charCodeAt(qi), t.charCodeAt(ti))) {
      let next = ti + 1
      let rest = at(qi + 1, next)
      while (!rest && (next = nextWord(t, next)) < t.length) {
        rest = at(qi + 1, next)
        next++
      }
      if (rest) result = join({ start: ti, end: ti + 1 }, rest)
    }
    memo.set(key, result)
    return result
  }
  for (let ti = 0; ti < t.length; ti = nextWord(t, ti + 1)) {
    const result = at(0, ti)
    if (result) return result
  }
  return null
}

function join(head: Match, tail: Match[]): Match[] {
  if (tail.length && tail[0]!.start === head.end) return [{ start: head.start, end: tail[0]!.end }, ...tail.slice(1)]
  return [head, ...tail]
}

/** How the command palette filters: a contiguous stretch, or else word starts. */
export function matchesCommand(query: string, label: string): Match[] | null {
  return matchesSubstring(query, label) ?? matchesWords(query, label)
}

/** A fuzzy match of a file: how good it is, and where in its name and folder it matched. */
export interface FileScore {
  score: number
  name: Match[]
  folder: Match[]
}

/**
 * Scores a path against a query whose characters must appear in it in order, by the same fuzzy match as the suggest
 * list: matches in the file name beat matches in the folders, runs of characters and the starts of words count for
 * more, and so does a short path. Spaces in the query separate parts that may match anywhere. Null when it doesn't
 * match.
 */
export function scoreFile(query: string, name: string, folder: string): FileScore | null {
  const parts = query.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return { score: 0, name: [], folder: [] }
  const full = folder ? `${folder}/${name}` : name
  const nameStart = full.length - name.length
  let total = 0
  const matches: Match[] = []
  for (const part of parts) {
    // The name alone first; then the whole path.
    const inName = fuzzyScore(part, name)
    const found = inName ? { score: inName.score * 2 + (base(name).startsWith(base(part)) ? 20 : 0), matches: inName.matches.map(([a, b]): [number, number] => [a + nameStart, b + nameStart]) } : fuzzyScore(part, full)
    if (!found) return null
    total += found.score
    for (const [start, end] of found.matches) matches.push({ start, end })
  }
  total -= full.length / 100
  const merged = mergeMatches(matches)
  return {
    score: total,
    name: merged.filter((m) => m.start >= nameStart).map((m) => ({ start: m.start - nameStart, end: m.end - nameStart })),
    folder: merged.filter((m) => m.end <= nameStart - 1).map((m) => m),
  }
}

function mergeMatches(matches: Match[]): Match[] {
  const sorted = [...matches].sort((a, b) => a.start - b.start)
  const out: Match[] = []
  for (const m of sorted) {
    const last = out[out.length - 1]
    if (last && m.start <= last.end) last.end = Math.max(last.end, m.end)
    else out.push({ ...m })
  }
  return out
}
