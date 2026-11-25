import { Text } from '@tensorai-workspace/text'
import { describe, expect, it } from 'vitest'
import { buildOverlay, innerChange, overlaysFor } from '../src/view/overlay.js'

describe('overlays', () => {
  it('lays out text drawn into a line, and maps columns both ways', () => {
    // "foo(|)" with ghost text around the bracket that's there.
    const o = buildOverlay(1, 'foo()', [{ col: 4, text: 'a, b', kind: 'ghost' }, { col: 5, text: ' + 1', kind: 'ghost' }], [])
    expect(o.rows).toEqual([{ text: 'foo(a, b) + 1', marks: [{ from: 4, to: 8, kind: 'ghost' }, { from: 9, to: 13, kind: 'ghost' }] }])
    // A column at an insertion is drawn before it.
    expect(o.map(4)).toEqual({ row: 0, col: 4 })
    expect(o.map(5)).toEqual({ row: 0, col: 9 })
    expect(o.unmap(0, 6)).toBe(4)
    expect(o.unmap(0, 9)).toBe(5)
  })

  it('moves the rest of the line below the rows drawn text adds', () => {
    const o = buildOverlay(3, 'if (x) {}', [{ col: 8, text: '\n  go()\n', kind: 'ghost' }], [])
    expect(o.rows.map((r) => r.text)).toEqual(['if (x) {', '  go()', '}'])
    expect(o.map(9)).toEqual({ row: 2, col: 1 })
    expect(o.unmap(2, 1)).toBe(9)
    expect(o.unmap(1, 3)).toBe(8)
  })

  it('draws an edit as an inline diff, with only the part that changes marked', () => {
    expect(innerChange(10, 'return count', 'return total')).toEqual({ from: 17, to: 22, insert: 'total' })
    expect(innerChange(0, 'ab', 'abc')).toEqual({ from: 2, to: 2, insert: 'c' })
    const doc = Text.of('let a\nreturn count\nx')
    const overlays = overlaysFor(doc, undefined, { from: 6, to: 18, insert: 'return total', removed: 'return count', action: 'jump' })
    expect([...overlays.keys()]).toEqual([2])
    expect(overlays.get(2)!.rows).toEqual([
      {
        text: 'return counttotal',
        marks: [
          { from: 7, to: 12, kind: 'removed' },
          { from: 12, to: 17, kind: 'inserted' },
        ],
      },
    ])
    // Over several lines, each gets its removed part; the added text goes after the last.
    const wide = overlaysFor(doc, undefined, { from: 4, to: 8, insert: 'X', removed: 'a\nre', action: 'jump' })
    expect(wide.get(1)!.rows[0]!.marks).toEqual([{ from: 4, to: 5, kind: 'removed' }])
    expect(wide.get(2)!.rows[0]).toEqual({ text: 'reXturn count', marks: [{ from: 0, to: 2, kind: 'removed' }, { from: 2, to: 3, kind: 'inserted' }] })
  })
})
