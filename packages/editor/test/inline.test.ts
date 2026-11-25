import { ScriptedCompletionProvider, type ScriptedCompletionOptions } from '@tensorai-workspace/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EditorState, InlineCompletions, insertText, nextLineLength, nextWordLength, redo, undo, type Command, type TransactionSpec } from '../src/core/index.js'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

/** An editor with no view: a state, and a controller that follows it. */
function setup(doc: string, cursor: number, options: Partial<ScriptedCompletionOptions> & Pick<ScriptedCompletionOptions, 'suggest'>, delay = 150) {
  const provider = new ScriptedCompletionProvider(options)
  let state = EditorState.create({ doc, selection: cursor, language: 'typescript' })
  const inline = new InlineCompletions({ provider, delay, path: '/a.ts' }, () => state)
  const dispatch = (spec: TransactionSpec | null) => {
    if (!spec) return false
    const tr = state.update(spec)
    state = tr.state
    inline.handleTransaction(tr)
    return true
  }
  const run = (command: Command) => dispatch(command(state))
  const type = (text: string) => {
    for (const ch of text) run(insertText(ch))
  }
  /** Lets timers and the provider's stream run. */
  const settle = async (ms = 200) => {
    await vi.advanceTimersByTimeAsync(ms)
  }
  return { provider, inline, dispatch, run, type, settle, state: () => state }
}

describe('inline completions', () => {
  it('asks after a pause in typing, and shows what comes back after the cursor', async () => {
    const t = setup('const a = ', 10, { suggest: () => '42' })
    t.type('1')
    await t.settle(100)
    expect(t.provider.requests).toHaveLength(0)
    t.type(' +')
    await t.settle(149)
    expect(t.provider.requests).toHaveLength(0)
    t.type(' ')
    await t.settle()
    expect(t.provider.requests).toHaveLength(1)
    const request = t.provider.requests[0]!
    expect(request).toMatchObject({ position: 14, language: 'typescript', path: '/a.ts', trigger: 'automatic' })
    expect(request.doc.toString()).toBe('const a = 1 + ')
    expect(t.inline.ghost).toMatchObject({ pos: 14, text: '42', index: 0, count: 1 })
    expect(t.provider.shown).toHaveLength(1)
  })

  it('doesn’t ask in the middle of a word, with a selection, or with several cursors', async () => {
    const t = setup('ab', 1, { suggest: () => 'x' })
    t.type('c')
    await t.settle()
    expect(t.provider.requests).toHaveLength(0)
    t.dispatch({ selection: { anchor: 0, head: 3 } })
    t.inline.trigger()
    await t.settle()
    expect(t.provider.requests).toHaveLength(0)
    // Asked for, the middle of a word is fine.
    t.dispatch({ selection: { anchor: 1 } })
    t.inline.trigger()
    await t.settle()
    expect(t.provider.requests[0]!.trigger).toBe('explicit')
  })

  it('grows as the provider streams, and never makes typing wait', async () => {
    const t = setup('', 0, { suggest: () => 'console.log(x)', chunk: 4, delay: 10 })
    t.inline.trigger()
    await vi.advanceTimersByTimeAsync(10)
    expect(t.inline.ghost?.text).toBe('cons')
    await vi.advanceTimersByTimeAsync(10)
    expect(t.inline.ghost?.text).toBe('console.')
    await t.settle()
    expect(t.inline.ghost?.text).toBe('console.log(x)')
    expect(t.provider.shown).toHaveLength(1)
  })

  it('keeps the suggestion while typing matches it, and drops it otherwise', async () => {
    const t = setup('', 0, { suggest: (r) => (r.position === 0 ? 'return value' : undefined) })
    t.inline.trigger()
    await t.settle()
    t.type('ret')
    expect(t.inline.ghost?.text).toBe('urn value')
    expect(t.provider.requests).toHaveLength(1)
    t.type('x')
    expect(t.inline.ghost).toBeUndefined()
    expect(t.provider.dismissed).toHaveLength(1)
    // The next pause asks again.
    await t.settle()
    expect(t.provider.requests).toHaveLength(2)
  })

  it('aborts a stream that no longer fits, and moves a late answer through edits since', async () => {
    const t = setup('', 0, { suggest: () => 'hello world', chunk: 2, delay: 50 })
    t.inline.trigger()
    await vi.advanceTimersByTimeAsync(50)
    expect(t.inline.ghost?.text).toBe('he')
    t.type('z')
    await vi.advanceTimersByTimeAsync(1)
    expect(t.provider.aborted).toHaveLength(1)

    // An answer that comes after typing that agrees with it still shows, after the typed part.
    const late = setup('', 0, { suggest: () => 'hello', delay: 100 })
    late.inline.trigger()
    late.type('he')
    await late.settle(120)
    expect(late.inline.ghost?.text).toBe('llo')
    expect(late.provider.requests).toHaveLength(1)
  })

  it('hides on a cursor move, Esc, undo and an outside change', async () => {
    const t = setup('x = ', 4, { suggest: () => '1' })
    const show = async () => {
      t.inline.trigger()
      await t.settle()
      expect(t.inline.ghost).toBeDefined()
    }
    await show()
    t.dispatch({ selection: { anchor: 0 }, userEvent: 'move' })
    expect(t.inline.ghost).toBeUndefined()
    t.dispatch({ selection: { anchor: 4 } })
    await show()
    expect(t.inline.dismiss()).toBe(true)
    expect(t.inline.ghost).toBeUndefined()
    expect(t.inline.dismiss()).toBe(false)
    t.type(' ')
    await show()
    t.run(undo)
    expect(t.inline.ghost).toBeUndefined()
    await t.settle()
    expect(t.provider.requests).toHaveLength(3)
  })

  it('accepts it all as one undo step, or a word or a line at a time', async () => {
    const t = setup('function f() {\n    \n}', 19, { suggest: () => 'const total = items.length\n    return total' })
    t.inline.trigger()
    await t.settle()
    t.dispatch(t.inline.accept('word'))
    expect(t.state().sliceDoc(19, 24)).toBe('const')
    t.dispatch(t.inline.accept('word'))
    expect(t.inline.ghost?.text.startsWith('total')).toBe(true)
    t.dispatch(t.inline.accept('line'))
    expect(t.state().doc.line(2).text).toBe('    const total = items.length')
    expect(t.inline.ghost?.text).toBe('    return total')
    t.dispatch(t.inline.accept('all'))
    expect(t.state().doc.toString()).toBe('function f() {\n    const total = items.length\n    return total\n}')
    expect(t.state().selection.main.head).toBe(t.state().doc.line(3).to)
    expect(t.inline.ghost).toBeUndefined()
    expect(t.provider.accepted.map((a) => a.part)).toEqual(['word', 'word', 'line', 'all'])
    expect(t.provider.dismissed).toHaveLength(0)
    // Each accept is its own undo step.
    t.run(undo)
    expect(t.state().doc.line(3).text).toBe('')
    t.run(undo)
    t.run(undo)
    t.run(undo)
    expect(t.state().doc.toString()).toBe('function f() {\n    \n}')
    t.run(redo)
    expect(t.state().sliceDoc(19, 24)).toBe('const')
  })

  it('replaces a range, keeping an auto-closed bracket it ends with', async () => {
    // "foo(|)" with a suggestion for the whole call.
    const t = setup('foo()', 4, { suggest: (r) => ({ text: 'foo(a, b)', range: { from: 0, to: r.position + 1 } }) })
    t.inline.trigger()
    await t.settle()
    expect(t.inline.ghost).toMatchObject({ pos: 4, text: 'a, b' })
    t.type('a')
    expect(t.inline.ghost?.text).toBe(', b')
    t.dispatch(t.inline.accept())
    expect(t.state().doc.toString()).toBe('foo(a, b)')
    expect(t.state().selection.main.head).toBe(9)
  })

  it('shows a suggestion around an auto-closed bracket, and types and accepts through it', async () => {
    // "const [|]" after typing "[", with a suggestion for the rest of the line.
    const t = setup('const [', 7, { suggest: (r) => ({ text: 'count, setCount] = useState(0)', range: { from: r.position, to: r.doc.lineAt(r.position).to } }) })
    t.type('')
    t.dispatch({ changes: { from: 7, insert: ']' }, selection: { anchor: 7 } })
    t.inline.trigger()
    await t.settle()
    expect(t.inline.ghost?.parts).toEqual([
      { pos: 7, text: 'count, setCount' },
      { pos: 8, text: ' = useState(0)' },
    ])
    // A word at a time crosses the bracket that's there, without typing it again.
    t.dispatch(t.inline.accept('word'))
    t.dispatch(t.inline.accept('word'))
    t.dispatch(t.inline.accept('word'))
    expect(t.state().doc.toString()).toBe('const [count, setCount]')
    t.dispatch(t.inline.accept('word'))
    expect(t.state().doc.toString()).toBe('const [count, setCount] ')
    expect(t.state().selection.main.head).toBe(24)
    t.dispatch(t.inline.accept())
    expect(t.state().doc.toString()).toBe('const [count, setCount] = useState(0)')
  })

  it('keeps it while typing over the closing bracket', async () => {
    let state = EditorState.create({ doc: 'f()', selection: 2, language: 'typescript' })
    const provider = new ScriptedCompletionProvider({ suggest: (r) => ({ text: 'x) + 1', range: { from: r.position, to: r.position + 1 } }) })
    const inline = new InlineCompletions({ provider }, () => state)
    const step = (spec: TransactionSpec | null) => {
      const tr = state.update(spec!)
      state = tr.state
      inline.handleTransaction(tr)
    }
    inline.trigger()
    await vi.advanceTimersByTimeAsync(1)
    expect(inline.ghost?.parts).toEqual([{ pos: 2, text: 'x' }, { pos: 3, text: ' + 1' }])
    step(insertText('x')(state))
    // Typing ")" steps over the one that's there.
    step(insertText(')')(state))
    expect(state.doc.toString()).toBe('f(x)')
    expect(inline.ghost?.parts).toEqual([{ pos: 4, text: ' + 1' }])
  })

  it('goes through several suggestions', async () => {
    const t = setup('', 0, { suggest: () => [{ text: 'one' }, { text: 'two' }, { text: 'three' }] })
    t.inline.trigger()
    await t.settle()
    expect(t.inline.ghost).toMatchObject({ text: 'one', count: 3 })
    expect(t.inline.cycle(1)).toBe(true)
    expect(t.inline.ghost?.text).toBe('two')
    t.inline.cycle(-1)
    t.inline.cycle(-1)
    expect(t.inline.ghost?.text).toBe('three')
    // Typing that fits only one of them moves to it.
    t.type('o')
    expect(t.inline.ghost?.text).toBe('ne')
  })

  it('passes the host’s context, and survives a provider that fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const provider = {
      // eslint-disable-next-line require-yield
      async *provide(): AsyncIterable<{ text: string }> {
        throw new Error('offline')
      },
    }
    const state = EditorState.create({ doc: 'x' })
    const inline = new InlineCompletions({ provider, completionContext: (s) => ({ length: s.doc.length }) }, () => state)
    inline.trigger()
    await vi.advanceTimersByTimeAsync(1)
    expect(warn).toHaveBeenCalled()
    expect(inline.ghost).toBeUndefined()
    warn.mockRestore()

    const t = setup('', 0, { suggest: () => 'a' })
    const withContext = new InlineCompletions({ provider: t.provider, completionContext: () => ({ open: ['b.ts'] }) }, t.state)
    withContext.trigger()
    await t.settle()
    expect(t.provider.requests[0]!.context).toEqual({ open: ['b.ts'] })
  })
})

describe('partial accepts', () => {
  const state = EditorState.create({ language: 'typescript' })
  it('takes words and lines', () => {
    expect(nextWordLength('foo bar', state)).toBe(3)
    expect(nextWordLength(' bar', state)).toBe(1)
    expect(nextWordLength('(a, b)', state)).toBe(1)
    expect(nextWordLength('\n    x', state)).toBe(5)
    expect(nextLineLength('a\nb')).toBe(2)
    expect(nextLineLength('ab')).toBe(2)
  })
})

describe('next edits', () => {
  // A rename of `count` to `total` on line 1, with the matching change on line 3 to suggest.
  const doc = 'let total = 0\nfoo()\nreturn count'
  const edit = { from: 20, to: 32, insert: 'return total' }

  it('goes to an edit elsewhere with Tab, makes it with Tab again, and asks again for the next one', async () => {
    const t = setup(doc, 9, { suggest: (r) => (r.position === 9 ? { text: '', nextEdit: edit } : undefined) })
    t.inline.trigger()
    await t.settle()
    expect(t.inline.ghost).toBeUndefined()
    expect(t.inline.nextEdit).toEqual({ from: 20, to: 32, insert: 'return total', removed: 'return count', action: 'jump' })
    expect(t.provider.shown).toHaveLength(1)
    t.dispatch(t.inline.tab())
    expect(t.state().selection.main.head).toBe(20)
    expect(t.inline.nextEdit?.action).toBe('accept')
    t.dispatch(t.inline.tab())
    expect(t.state().doc.toString()).toBe('let total = 0\nfoo()\nreturn total')
    expect(t.state().selection.main.head).toBe(32)
    expect(t.inline.nextEdit).toBeUndefined()
    expect(t.provider.accepted.map((a) => a.part)).toEqual(['edit'])
    // The next one is asked for at once, even with the cursor against a word.
    await vi.advanceTimersByTimeAsync(1)
    expect(t.provider.requests).toHaveLength(2)
    expect(t.provider.requests[1]!.position).toBe(32)
    // Making it was its own undo step.
    t.run(undo)
    expect(t.state().doc.toString()).toBe(doc)
  })

  it('comes after the ghost text it arrives with, moved through the accept', async () => {
    const t = setup('let \nreturn count', 4, { suggest: () => ({ text: 'total = 0', nextEdit: { from: 5, to: 17, insert: 'return total' } }) })
    t.inline.trigger()
    await t.settle()
    expect(t.inline.ghost?.text).toBe('total = 0')
    expect(t.inline.nextEdit).toMatchObject({ from: 5, to: 17 })
    t.dispatch(t.inline.tab())
    expect(t.state().doc.toString()).toBe('let total = 0\nreturn count')
    expect(t.inline.nextEdit).toMatchObject({ from: 14, to: 26, action: 'jump' })
    t.dispatch(t.inline.tab())
    t.dispatch(t.inline.tab())
    expect(t.state().doc.toString()).toBe('let total = 0\nreturn total')
    expect(t.provider.accepted.map((a) => a.part)).toEqual(['all', 'edit'])
    expect(t.provider.dismissed).toHaveLength(0)
  })

  it('stays while the cursor moves and other text changes, and goes once its text changes', async () => {
    const t = setup(doc, 9, { suggest: (r) => (r.position === 9 ? { text: '', nextEdit: edit } : undefined) })
    t.inline.trigger()
    await t.settle()
    t.dispatch({ selection: { anchor: 0 }, userEvent: 'move' })
    expect(t.inline.nextEdit).toBeDefined()
    // Typing above it moves it down.
    t.dispatch({ changes: { from: 14, insert: 'bar();\n' }, userEvent: 'input.type' })
    expect(t.inline.nextEdit).toMatchObject({ from: 27, to: 39 })
    // Changing the text it would replace drops it.
    t.dispatch({ changes: { from: 34, to: 39, insert: 'x' }, userEvent: 'input.type' })
    expect(t.inline.nextEdit).toBeUndefined()
  })

  it('is dismissed by Esc after the ghost text, and by undo', async () => {
    const t = setup('let \nreturn count', 4, { suggest: (r) => (r.position === 4 ? { text: 'total = 0', nextEdit: { from: 5, to: 17, insert: 'return total' } } : undefined) })
    t.inline.trigger()
    await t.settle()
    expect(t.inline.dismiss()).toBe(true)
    expect(t.inline.ghost).toBeUndefined()
    expect(t.inline.nextEdit).toBeDefined()
    expect(t.inline.dismiss()).toBe(true)
    expect(t.inline.nextEdit).toBeUndefined()
    expect(t.inline.dismiss()).toBe(false)
    expect(t.provider.dismissed).toHaveLength(2)

    t.inline.trigger()
    await t.settle()
    t.type('x')
    t.run(undo)
    expect(t.inline.nextEdit).toBeUndefined()
  })

  it('ignores an edit outside the document it was asked about', async () => {
    const t = setup('abc', 3, { suggest: () => ({ text: '', nextEdit: { from: 2, to: 9, insert: 'x' } }) })
    t.inline.trigger()
    await t.settle()
    expect(t.inline.nextEdit).toBeUndefined()
    expect(t.inline.tab()).toBeNull()
  })
})
