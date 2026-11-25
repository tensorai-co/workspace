import { describe, expect, it } from 'vitest'
import { Screen } from '../src/core/index.js'

const make = (cols: number, rows: number, text = '') => {
  const s = new Screen({ cols, rows, scrollback: 5000 })
  if (text) s.write(text)
  return s
}
const rows = (s: Screen) => s.buffer.lines.map((l) => l.text(true))
/** The text as it was printed: wrapped rows joined. */
const logical = (s: Screen) => {
  const out: string[] = []
  s.buffer.lines.forEach((line, i) => {
    const next = s.buffer.lines[i + 1]
    // The gap a wide character leaves at the end of a row isn't text.
    const gap = next?.wrapped && !line.has(line.cols - 1) && line.width(line.cols - 1) === 1 && next.width(0) === 2
    const text = next?.wrapped ? line.text(false, 0, gap ? line.cols - 1 : line.cols) : line.text(true)
    if (line.wrapped && out.length) out[out.length - 1] += text
    else out.push(text)
  })
  while (out.length && out[out.length - 1] === '') out.pop()
  return out
}

describe('reflow', () => {
  it('wraps long lines again, narrower and wider', () => {
    const s = make(10, 4, 'abcdefghijklmnopqrstuvwxyz\r\nend')
    expect(rows(s)).toEqual(['abcdefghij', 'klmnopqrst', 'uvwxyz', 'end'])
    s.resize(20, 4)
    expect(rows(s)).toEqual(['abcdefghijklmnopqrst', 'uvwxyz', 'end', ''])
    s.resize(6, 4)
    expect(rows(s)).toEqual(['abcdef', 'ghijkl', 'mnopqr', 'stuvwx', 'yz', 'end'])
    expect(s.cursor).toEqual({ x: 3, y: 3 })
    s.resize(40, 4)
    expect(rows(s)).toEqual(['abcdefghijklmnopqrstuvwxyz', 'end', '', ''])
    expect(s.cursor).toEqual({ x: 3, y: 1 })
  })

  it('never cuts a wide character in two', () => {
    const s = make(10, 3, '你好世界你好世界')
    expect(rows(s)).toEqual(['你好世界你', '好世界', ''])
    s.resize(7, 3)
    expect(rows(s)).toEqual(['你好世', '界你好', '世界'])
    s.resize(4, 3)
    expect(rows(s)).toEqual(['你好', '世界', '你好', '世界'])
    s.resize(16, 3)
    expect(rows(s)).toEqual(['你好世界你好世界', '', ''])
  })

  it('keeps a prompt where it was', () => {
    const s = make(20, 5, 'one\r\ntwo\r\n$ ')
    s.resize(10, 5)
    expect(rows(s)).toEqual(['one', 'two', '$ ', '', ''])
    expect(s.cursor).toEqual({ x: 2, y: 2 })
    s.resize(20, 3)
    expect(rows(s)).toEqual(['one', 'two', '$ '])
    s.resize(20, 2)
    expect(s.view.map((l) => l.text(true))).toEqual(['two', '$ '])
    s.resize(20, 6)
    expect(rows(s)).toEqual(['one', 'two', '$ ', '', '', ''])
    expect(s.cursor).toEqual({ x: 2, y: 2 })
  })

  it('leaves the alternate screen unwrapped', () => {
    const s = make(10, 3, '\x1b[?1049habcdefghij')
    s.resize(5, 3)
    expect(rows(s)).toEqual(['abcde', '', ''])
  })

  it('keeps every character and the cursor’s place, at any size', () => {
    let seed = 11
    const random = (n: number) => {
      seed = (seed + 0x6d2b79f5) | 0
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n)
    }
    for (let round = 0; round < 400; round++) {
      const s = make(4 + random(30), 2 + random(8))
      for (let i = random(12); i >= 0; i--) {
        s.write(Array.from({ length: random(60) }, () => ['a', 'b', 'c', '你', 'é', ' x', '😀'][random(7)]!).join(''))
        if (random(3)) s.write('\r\n')
      }
      // The cursor somewhere on the text.
      s.write('§')
      // At the last column the cursor is waiting to wrap, still on it.
      s.write(s.buffer.x >= s.cols ? '\x1b[C' : '\x1b[D')
      const before = logical(s)
      for (let step = 0; step < 6; step++) {
        s.resize(2 + random(40), 1 + random(10))
        const b = s.buffer
        expect(b.lines.length, 'lines').toBe(b.base + b.rows)
        for (const line of b.lines) expect(line.cols).toBe(b.cols)
        expect(b.row(b.y).char(Math.min(b.x, b.cols - 1)), JSON.stringify(rows(s))).toBe('§')
        expect(logical(s)).toEqual(before)
      }
    }
  })
})
