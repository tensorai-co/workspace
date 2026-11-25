import { languageById } from '@tensorai-co/workspace/languages'
import { ChangeSet, Text } from '@tensorai-co/workspace/text'
import { describe, expect, it } from 'vitest'
import { foldRanges, Folds, rowsOf, wrapLine } from '../src/core/index.js'

const rows = (text: string, columns: number) => {
  const { breaks, indent } = wrapLine(text, columns)
  const starts = [0, ...breaks]
  return starts.map((s, i) => (i ? ' '.repeat(indent) : '') + text.slice(s, starts[i + 1] ?? text.length))
}

describe('word wrap', () => {
  it('breaks after spaces and before brackets', () => {
    expect(rows('const total = items.reduce((sum, item) => sum + item.price, 0)', 24)).toEqual(['const total = items.', 'reduce((sum, item) => ', 'sum + item.price, 0)'])
  })

  it('keeps the indent on rows after the first, unless there’s no room for it', () => {
    expect(rows('    return someFunction(argumentOne, argumentTwo)', 24)).toEqual(['    return someFunction', '    (argumentOne, ', '    argumentTwo)'])
    expect(wrapLine('          x y z a b c', 11).indent).toBe(0)
  })

  it('breaks inside a word that is too long for a row', () => {
    expect(rows('aaaaaaaaaaaaaaaaaaaa', 8)).toEqual(['aaaaaaaa', 'aaaaaaaa', 'aaaa'])
  })

  it('counts wide characters as two columns, and breaks between CJK characters', () => {
    expect(rows('漢字漢字漢字', 6)).toEqual(['漢字漢', '字漢字'])
    expect(rowsOf('short', 80)).toBe(1)
    expect(rowsOf('anything', 0)).toBe(1)
  })
})

describe('folding', () => {
  const ts = languageById('typescript').rules
  const lines = (r: { start: number; end: number }[]) => r.map((x) => `${x.start}-${x.end}`)

  it('finds regions by indentation, leaving the closing line out', () => {
    const doc = Text.of(['function f() {', '    if (x) {', '        y()', '    }', '', '    z()', '}', 'done'].join('\n'))
    expect(lines(foldRanges(doc, ts))).toEqual(['1-6', '2-3'])
  })

  it('pairs region markers, and ends off-side regions before blank lines', () => {
    const doc = Text.of(['// #region setup', 'a', 'b', '// #endregion', 'c'].join('\n'))
    expect(lines(foldRanges(doc, ts))).toEqual(['1-4'])
    const py = languageById('python').rules
    expect(py.folding.offSide).toBe(true)
    const code = Text.of(['def f():', '    a', '    b', '', 'g()'].join('\n'))
    expect(lines(foldRanges(code, py))).toEqual(['1-3'])
  })

  it('keeps folds through edits around them, and unfolds on edits inside or the cursor going in', () => {
    let doc = Text.of('a {\n  b\n  c\n}\nd')
    const folds = new Folds()
    folds.fold(doc, { start: 1, end: 3 })
    expect(folds.hidden(doc)(2)).toBe(true)
    expect(folds.hidden(doc)(4)).toBe(false)
    // Typing above moves it.
    let changes = ChangeSet.of({ from: 0, insert: 'x\n' }, doc.length)
    doc = changes.apply(doc)
    folds.map(changes)
    expect(folds.ranges(doc)).toEqual([{ start: 2, end: 4 }])
    // Typing at the end of its first line keeps it.
    changes = ChangeSet.of({ from: doc.line(2).to, insert: ' // ok' }, doc.length)
    doc = changes.apply(doc)
    expect(folds.map(changes)).toBe(false)
    expect(folds.isFolded(doc, 2)).toBe(true)
    // A change inside unfolds it.
    changes = ChangeSet.of({ from: doc.line(3).from, insert: 'z' }, doc.length)
    doc = changes.apply(doc)
    expect(folds.map(changes)).toBe(true)
    expect(folds.size).toBe(0)
    folds.fold(doc, { start: 2, end: 4 })
    expect(folds.reveal(doc, [doc.line(2).to])).toBe(false)
    expect(folds.reveal(doc, [doc.line(3).from + 1])).toBe(true)
  })
})
