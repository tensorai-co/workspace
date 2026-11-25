import type { Link } from './line.js'
import type { Screen } from './screen.js'

/** A link on the screen: where it goes, and the cells it's on, by their line's index in the buffer. */
export interface FoundLink {
  uri: string
  /** Whether a program marked it, rather than its text looking like one. */
  marked: boolean
  cells: { index: number; from: number; to: number }[]
}

const URL = /\b(?:https?|ftp|file):\/\/[^\s"'<>`{}|\\^\u0000-\u001f─-▟]+/gi
/** The longest line looked through for links. */
const MAX_ROWS = 50

/** The link at a cell, if there is one: one a program marked with OSC 8, or a URL in the text. */
export function linkAt(screen: Screen, x: number, index: number): FoundLink | undefined {
  const { buffer } = screen
  const line = buffer.lines[index]
  if (!line || x < 0 || x >= buffer.cols) return undefined
  const link = line.ext(x)?.link
  if (link) return marked(screen, link, x, index)

  // The whole logical line, with where each character is.
  let top = index
  let bottom = index
  while (top > 0 && buffer.lines[top]!.wrapped && index - top < MAX_ROWS) top--
  while (buffer.lines[bottom + 1]?.wrapped && bottom - index < MAX_ROWS) bottom++
  let text = ''
  const places: { index: number; x: number; width: number }[] = []
  for (let i = top; i <= bottom; i++) {
    const row = buffer.lines[i]!
    for (let at = 0; at < buffer.cols; at++) {
      const width = row.width(at)
      if (width === 0) continue
      const char = row.char(at) || ' '
      for (let n = 0; n < char.length; n++) places.push({ index: i, x: at, width })
      text += char
    }
  }
  for (const match of text.matchAll(URL)) {
    const uri = trimUrl(match[0])
    const cells: FoundLink['cells'] = []
    for (const place of places.slice(match.index, match.index + uri.length)) {
      const last = cells[cells.length - 1]
      if (last?.index === place.index) last.to = place.x + place.width
      else cells.push({ index: place.index, from: place.x, to: place.x + place.width })
    }
    if (cells.some((c) => c.index === index && x >= c.from && x < c.to)) return { uri, marked: false, cells }
  }
  return undefined
}

/** What follows a URL in a sentence isn't part of it, and neither is a bracket it didn't open. */
function trimUrl(url: string): string {
  for (;;) {
    const last = url[url.length - 1]
    if (last && '.,;:!?'.includes(last)) url = url.slice(0, -1)
    else if ((last === ')' && count(url, '(') < count(url, ')')) || (last === ']' && count(url, '[') < count(url, ']'))) url = url.slice(0, -1)
    else return url
  }
}

const count = (text: string, char: string) => text.split(char).length - 1

/** Every cell of a marked link: those beside this one, and others with the same id in the rows around. */
function marked(screen: Screen, link: Link, x: number, index: number): FoundLink {
  const { buffer, viewTop, rows } = screen
  const same = (i: number, at: number) => buffer.lines[i]?.ext(at)?.link === link
  const cells: FoundLink['cells'] = []
  const addRow = (i: number) => {
    for (let at = 0; at < buffer.cols; at++) {
      if (!same(i, at)) continue
      const from = at
      while (at + 1 < buffer.cols && same(i, at + 1)) at++
      cells.push({ index: i, from, to: at + 1 })
    }
  }
  if (link.id) for (let i = viewTop; i < viewTop + rows; i++) addRow(i)
  else {
    let top = index
    let bottom = index
    while (top > 0 && buffer.lines[top]!.wrapped && same(top - 1, buffer.cols - 1)) top--
    while (buffer.lines[bottom + 1]?.wrapped && same(bottom + 1, 0)) bottom++
    for (let i = top; i <= bottom; i++) addRow(i)
  }
  return { uri: link.uri, marked: true, cells: cells.length ? cells : [{ index, from: x, to: x + 1 }] }
}
