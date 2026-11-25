import { describe, expect, it } from 'vitest'
import * as c from '../src/core/index.js'
import { EditorSelection, EditorState, SelectionRange, type Command } from '../src/core/index.js'

/** A state from text where | marks cursors and [..] marks selections. */
function make(text: string, language = 'tsx'): EditorState {
  const ranges: SelectionRange[] = []
  let doc = ''
  let anchor = -1
  for (const ch of text) {
    if (ch === '|') ranges.push(SelectionRange.cursor(doc.length))
    else if (ch === '[') anchor = doc.length
    else if (ch === ']') ranges.push(new SelectionRange(anchor, doc.length))
    else doc += ch
  }
  return EditorState.create({ doc, language, selection: EditorSelection.create(ranges.length ? ranges : [SelectionRange.cursor(0)]) })
}

/** The state's text with | at cursors and [..] around selections. */
function show(state: EditorState): string {
  const marks: [number, string][] = []
  for (const r of state.selection.ranges) {
    if (r.empty) marks.push([r.head, '|'])
    else marks.push([r.from, '['], [r.to, ']'])
  }
  let text = state.doc.toString()
  for (const [pos, m] of marks.sort((a, b) => b[0] - a[0])) text = text.slice(0, pos) + m + text.slice(pos)
  return text
}

function run(state: EditorState, ...commands: Command[]): EditorState {
  for (const cmd of commands) {
    const spec = cmd(state)
    if (spec) state = state.apply(spec)
  }
  return state
}

const type = (text: string) => [...text].map((ch) => (ch === '\n' ? c.insertNewline : c.insertText(ch)))

describe('typing', () => {
  it('auto-closes, over-types and surrounds', () => {
    expect(show(run(make('|'), ...type('f(')))).toBe('f(|)')
    expect(show(run(make('|'), ...type('f()')))).toBe('f()|')
    expect(show(run(make('|'), ...type('"a"')))).toBe('"a"|')
    expect(show(run(make('|abc'), ...type('(')))).toBe('(|abc')
    expect(show(run(make("it|"), ...type("'")))).toBe("it'|")
    expect(show(run(make('[abc]'), ...type('(')))).toBe('([abc])')
    expect(show(run(make('const s = `|`'), ...type('${')))).toBe('const s = `${|}`')
  })

  it('indents on Enter by the language rules', () => {
    expect(show(run(make('function f() {|}'), ...type('\n')))).toBe('function f() {\n    |\n}')
    expect(show(run(make('  if (x) {|'), ...type('\n')))).toBe('  if (x) {\n    |')
    expect(show(run(make('  foo()|'), ...type('\n')))).toBe('  foo()\n  |')
    expect(show(run(make('/**|'), ...type('\n')))).toBe('/**\n * |')
    // A line holding only auto-indentation is left empty.
    expect(show(run(make('{\n    |\n}'), ...type('\n')))).toBe('{\n\n    |\n}')
  })

  it('closes JSX tags in .tsx', () => {
    expect(show(run(make('return <div className="a"|'), ...type('>')))).toBe('return <div className="a">|</div>')
    expect(show(run(make('const x = <Foo.Bar|'), ...type('>')))).toBe('const x = <Foo.Bar>|</Foo.Bar>')
    expect(show(run(make('useState<number|'), ...type('>')))).toBe('useState<number>|')
    expect(show(run(make('<br /|'), ...type('>')))).toBe('<br />|')
  })

  it('types at every cursor', () => {
    expect(show(run(make('a|\nb|\nc|'), ...type('!')))).toBe('a!|\nb!|\nc!|')
    expect(show(run(make('|one\n|two'), ...type('(')))).toBe('(|one\n(|two')
  })
})

describe('deleting', () => {
  it('removes pairs, tab stops and graphemes', () => {
    expect(show(run(make('f(|)'), c.deleteBackward))).toBe('f|')
    expect(show(run(make('        |x'), c.deleteBackward))).toBe('    |x')
    expect(show(run(make('ab😀|'), c.deleteBackward))).toBe('ab|')
    expect(show(run(make('a\n|b'), c.deleteBackward))).toBe('a|b')
    expect(show(run(make('foo.bar|'), c.deleteWordBackward))).toBe('foo.|')
    expect(show(run(make('one\ntw|o\nthree'), c.deleteLine))).toBe('one\nth|ree')
  })
})

describe('lines and comments', () => {
  it('moves and copies lines', () => {
    expect(show(run(make('a\nb|\nc'), c.moveLines(-1)))).toBe('b|\na\nc')
    expect(show(run(make('a|\nb\nc'), c.moveLines(1)))).toBe('b\na|\nc')
    expect(show(run(make('a|\nb'), c.copyLines(1)))).toBe('a\na|\nb')
  })

  it('toggles line comments at the smallest indentation', () => {
    const on = run(make('  [a\n    b]'), c.toggleLineComment)
    expect(on.doc.toString()).toBe('  // a\n  //   b')
    expect(run(on, c.toggleLineComment).doc.toString()).toBe('  a\n    b')
    expect(run(make('x = 1|', 'python'), c.toggleLineComment).doc.toString()).toBe('# x = 1')
  })

  it('indents with Tab and outdents with Shift+Tab', () => {
    expect(show(run(make('ab|'), c.indentMore))).toBe('ab  |')
    expect(run(make('[a\nb]'), c.indentMore).doc.toString()).toBe('    a\n    b')
    expect(run(make('      |a'), c.indentLess).doc.toString()).toBe('    a')
  })
})

describe('cursors', () => {
  it('moves by word, line and grapheme', () => {
    expect(show(run(make('|foo.bar baz'), c.cursorWordRight))).toBe('foo|.bar baz')
    expect(show(run(make('foo.bar baz|'), c.cursorWordLeft))).toBe('foo.bar |baz')
    expect(show(run(make('    ab|'), c.cursorLineStart))).toBe('    |ab')
    expect(show(run(make('    ab|'), c.cursorLineStart, c.cursorLineStart))).toBe('|    ab')
    expect(show(run(make('|😀x'), c.cursorRight))).toBe('😀|x')
    expect(show(run(make('long line|\nab\nlong line'), c.cursorDown, c.cursorDown))).toBe('long line\nab\nlong line|')
  })

  it('adds cursors and selects occurrences', () => {
    expect(show(run(make('ab|c\nabc'), c.addCursorVertical(1)))).toBe('ab|c\nab|c')
    expect(show(run(make('fo|o bar foo foo'), c.selectNextOccurrence, c.selectNextOccurrence))).toBe('[foo] bar [foo] foo')
    expect(show(run(make('fo|o bar foo'), c.selectAllOccurrences))).toBe('[foo] bar [foo]')
  })
})

describe('history', () => {
  it('undoes typing as one step, and redoes it', () => {
    let state = run(make('|'), ...type('hello'))
    expect(state.doc.toString()).toBe('hello')
    state = run(state, c.undo)
    expect(show(state)).toBe('|')
    state = run(state, c.redo)
    expect(show(state)).toBe('hello|')
  })

  it('starts a new step after the cursor moves', () => {
    let state = run(make('|'), ...type('ab'), c.cursorLeft, ...type('X'))
    expect(state.doc.toString()).toBe('aXb')
    state = run(state, c.undo)
    expect(state.doc.toString()).toBe('ab')
    state = run(state, c.undo)
    expect(state.doc.toString()).toBe('')
  })
})

describe('clipboard', () => {
  it('copies the line when nothing is selected, and pastes one line per cursor', () => {
    expect(c.copyText(make('ab|c\nd')).text).toBe('abc\n')
    expect(show(run(make('x|\ny|'), c.paste('1\n2')))).toBe('x1|\ny2|')
    expect(show(run(make('one\ntw|o'), c.paste('copied\n', true)))).toBe('one\ncopied\ntw|o')
  })
})

describe('JSX Enter', () => {
  it('indents between tags and after an open tag, but not after generics', () => {
    expect(show(run(make('<div>|</div>'), ...type('\n')))).toBe('<div>\n    |\n</div>')
    expect(show(run(make('  <main className="app">|'), ...type('\n')))).toBe('  <main className="app">\n    |')
    expect(show(run(make('const n = useState<number>(|'), ...type('\n')))).toBe('const n = useState<number>(\n    |')
    expect(show(run(make('<br>|'), ...type('\n')))).toBe('<br>\n|')
  })
})
