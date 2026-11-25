import { describe, expect, it } from 'vitest'
import { ChangeSet, Text } from '../src/index.js'

/** A small deterministic random generator, so failures reproduce. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 2 ** 32
  }
}

const sample = (random: () => number) => {
  const pieces = ['a', 'bc', '\n', 'def\n', '\n\n', 'xyz', '', '日本', '😀', '\r\n']
  let s = ''
  const n = Math.floor(random() * 6)
  for (let i = 0; i < n; i++) s += pieces[Math.floor(random() * pieces.length)]
  return s
}

describe('Text', () => {
  it('reads lines and positions', () => {
    const doc = Text.of('one\ntwo\n\nfour')
    expect(doc.lines).toBe(4)
    expect(doc.length).toBe(13)
    expect(doc.line(2)).toEqual({ number: 2, from: 4, to: 7, text: 'two' })
    expect(doc.lineAt(7)).toMatchObject({ number: 2 })
    expect(doc.lineAt(8)).toMatchObject({ number: 3, from: 8, to: 8 })
    expect(doc.lineAt(13)).toMatchObject({ number: 4, text: 'four' })
    expect(doc.slice(2, 10)).toBe('e\ntwo\n\nf')
    expect(Text.of('a\r\nb\rc').toString()).toBe('a\nb\nc')
    expect(Text.empty.lines).toBe(1)
  })

  it('matches a plain string after thousands of random edits', () => {
    const random = rng(7)
    let doc = Text.of('')
    let str = ''
    for (let i = 0; i < 4000; i++) {
      const from = Math.floor(random() * (str.length + 1))
      const to = Math.min(str.length, from + Math.floor(random() * 8))
      const insert = sample(random).replace(/\r\n?/g, '\n')
      doc = doc.replace(from, to, insert)
      str = str.slice(0, from) + insert + str.slice(to)
      if (i % 250 === 0) {
        expect(doc.toString()).toBe(str)
        expect(doc.length).toBe(str.length)
        expect(doc.lines).toBe(str.split('\n').length)
      }
    }
    expect(doc.toString()).toBe(str)
    // Every line lookup agrees with the string.
    const lines = str.split('\n')
    let pos = 0
    for (let n = 1; n <= lines.length; n++) {
      const line = doc.line(n)
      expect(line.from).toBe(pos)
      expect(line.text).toBe(lines[n - 1])
      expect(doc.lineAt(pos).number).toBe(n)
      pos += lines[n - 1]!.length + 1
    }
  })

  it('stays shallow and shares old versions on big documents', () => {
    const big = Text.of(Array.from({ length: 200_000 }, (_, i) => `line ${i}`))
    expect(big.lines).toBe(200_000)
    expect(big.depth).toBeLessThanOrEqual(4)
    const edited = big.replace(big.line(100_000).from, big.line(100_000).from, 'X')
    expect(edited.line(100_000).text).toBe('Xline 99999')
    expect(big.line(100_000).text).toBe('line 99999')
    const cut = big.replace(big.line(10).from, big.line(190_000).to, 'joined')
    expect(cut.lines).toBe(10_010)
    expect(cut.line(10).text).toBe('joined')
    expect(cut.line(11).text).toBe('line 190000')
  })
})

describe('ChangeSet', () => {
  it('applies, inverts and maps', () => {
    const doc = Text.of('hello world')
    const changes = ChangeSet.of([{ from: 6, to: 11, insert: 'there' }, { from: 0, insert: '> ' }], doc.length)
    const next = changes.apply(doc)
    expect(next.toString()).toBe('> hello there')
    expect(changes.invert(doc).apply(next).toString()).toBe('hello world')
    expect(changes.mapPos(0, -1)).toBe(0)
    expect(changes.mapPos(0, 1)).toBe(2)
    expect(changes.mapPos(5)).toBe(7)
    expect(changes.mapPos(8, -1)).toBe(8)
    expect(changes.mapPos(8, 1)).toBe(13)
    expect(changes.mapPos(11)).toBe(13)
  })

  it('round-trips random multi-edit change sets', () => {
    const random = rng(42)
    let doc = Text.of('the quick brown fox\njumps over\nthe lazy dog')
    for (let round = 0; round < 500; round++) {
      const specs = Array.from({ length: 1 + Math.floor(random() * 4) }, () => {
        const from = Math.floor(random() * (doc.length + 1))
        return { from, to: Math.min(doc.length, from + Math.floor(random() * 4)), insert: sample(random).replace(/\r\n?/g, '\n') }
      })
      const changes = ChangeSet.of(specs, doc.length)
      const next = changes.apply(doc)
      expect(next.length).toBe(changes.newLength)
      expect(changes.invert(doc).apply(next).toString()).toBe(doc.toString())
      doc = next
    }
  })
})

describe('ChangeSet.compose', () => {
  it('equals applying both, over random edits', () => {
    let seed = 11
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0), seed / 2 ** 32)
    const edit = (doc: Text) =>
      ChangeSet.of(
        Array.from({ length: 1 + Math.floor(random() * 3) }, () => {
          const from = Math.floor(random() * (doc.length + 1))
          return { from, to: Math.min(doc.length, from + Math.floor(random() * 5)), insert: ['', 'ab', '\n', 'xyz\nq'][Math.floor(random() * 4)] }
        }),
        doc.length,
      )
    for (let round = 0; round < 1000; round++) {
      const doc = Text.of('hello world\nsecond line\nthird')
      const a = edit(doc)
      const mid = a.apply(doc)
      const b = edit(mid)
      const both = a.compose(b)
      expect(both.apply(doc).toString()).toBe(b.apply(mid).toString())
      expect(both.invert(doc).apply(both.apply(doc)).toString()).toBe(doc.toString())
    }
  })
})
