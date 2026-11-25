import type { CompletionItem } from '@tensorai-workspace/host'
import { ScriptedLanguageService, type ScriptedLanguageOptions } from '@tensorai-workspace/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteBackward, Diagnostics, EditorState, fuzzyScore, fuzzyScoreGraceful, insertText, Suggest, type Command, type TransactionSpec } from '../src/core/index.js'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('fuzzy matching', () => {
  const order = (pattern: string, labels: string[]) =>
    labels
      .map((label) => ({ label, match: fuzzyScoreGraceful(pattern, label) }))
      .filter((x) => x.match)
      .sort((a, b) => b.match!.score - a.match!.score || (a.label < b.label ? -1 : 1))
      .map((x) => x.label)

  it('orders for "lo" in Math’s members', () => {
    // The list for `Math.lo`, measured.
    expect(order('lo', ['abs', 'floor', 'LOG10E', 'log', 'log10', 'log1p', 'log2', 'LOG2E', 'PI', 'Symbol'])).toEqual(['log', 'log10', 'log1p', 'log2', 'LOG10E', 'LOG2E', 'floor', 'Symbol'])
  })

  it('matches word parts and marks what matched', () => {
    expect(fuzzyScore('gebi', 'getElementById')!.matches).toEqual([
      [0, 1],
      [3, 4],
      [10, 11],
      [12, 13],
    ])
    expect(fuzzyScore('ab', 'ba')).toBeUndefined()
    expect(fuzzyScore('', 'anything')).toEqual({ score: 0, matches: [] })
    // A run beats scattered letters.
    expect(fuzzyScore('set', 'setCount')!.score).toBeGreaterThan(fuzzyScore('set', 'useState')!.score)
  })

  it('matches long paths in time that grows with their length, not its square', () => {
    const path = 'packages/' + 'nested/'.repeat(40) + 'components/ButtonGroup.tsx'
    expect(fuzzyScore('btngrp', path)!.matches.length).toBeGreaterThan(0)
    const t = performance.now()
    for (let i = 0; i < 20_000; i++) fuzzyScore('btngrp', path)
    expect(performance.now() - t).toBeLessThan(2000)
  })
})

/** An editor with no view: a state, and controllers that follow it. */
function setup(doc: string, cursor: number, options: ScriptedLanguageOptions) {
  const service = new ScriptedLanguageService(options)
  let state = EditorState.create({ doc, selection: cursor, language: 'typescript' })
  const suggest = new Suggest({ service, path: '/a.ts', delay: 10 }, () => state)
  const dispatch = (spec: TransactionSpec | null | undefined) => {
    if (!spec) return false
    const tr = state.update(spec)
    state = tr.state
    suggest.handleTransaction(tr)
    return true
  }
  const run = (command: Command) => dispatch(command(state))
  const type = (text: string) => {
    for (const ch of text) run(insertText(ch))
  }
  const labels = () => suggest.view?.rows.map((r) => r.item.label)
  return { service, suggest, dispatch, run, type, labels, state: () => state, settle: () => vi.advanceTimersByTimeAsync(20) }
}

const items = (...labels: string[]): CompletionItem[] => labels.map((label) => ({ label }))

describe('suggest', () => {
  it('asks as a word starts, and filters as it grows without asking again', async () => {
    const t = setup('', 0, { completions: items('count', 'console', 'const', 'setCount') })
    t.type('c')
    await t.settle()
    expect(t.service.of('completions')).toHaveLength(1)
    expect(t.service.of('completions')[0]).toMatchObject({ position: 1, trigger: 'typing', language: 'typescript', path: '/a.ts' })
    expect(t.labels()).toEqual(['console', 'const', 'count', 'setCount'])
    t.type('ou')
    await t.settle()
    expect(t.labels()).toEqual(['count', 'setCount'])
    expect(t.suggest.view!.rows[0]!.matches).toEqual([[0, 3]])
    expect(t.service.of('completions')).toHaveLength(1)
  })

  it('asks after a trigger character, and puts the picked item in with Enter’s edit', async () => {
    const t = setup('Math', 4, { triggerCharacters: ['.'], completions: items('abs', 'floor', 'PI') })
    t.type('.')
    await t.settle()
    expect(t.service.of('completions')[0]).toMatchObject({ trigger: 'character', character: '.' })
    expect(t.labels()).toEqual(['PI', 'abs', 'floor'])
    t.type('fl')
    t.dispatch(t.suggest.accept())
    expect(t.state().doc.toString()).toBe('Math.floor')
    expect(t.state().selection.main.head).toBe(10)
    expect(t.suggest.isOpen).toBe(false)
  })

  it('goes round the list, and closes on Esc, a space, or the cursor leaving the word', async () => {
    const t = setup('', 0, { completions: items('alpha', 'alpine', 'also') })
    t.type('al')
    await t.settle()
    t.suggest.move(-1)
    expect(t.suggest.selected!.label).toBe('also')
    t.suggest.move(1)
    expect(t.suggest.selected!.label).toBe('alpha')
    t.type(' ')
    expect(t.suggest.isOpen).toBe(false)
    t.type('a')
    await t.settle()
    expect(t.suggest.isOpen).toBe(true)
    t.run(deleteBackward)
    expect(t.suggest.isOpen).toBe(false)
    t.type('a')
    await t.settle()
    t.dispatch({ selection: { anchor: 0 } })
    expect(t.suggest.isOpen).toBe(false)
  })

  it('says so when asked and there’s nothing, and doesn’t when typing', async () => {
    const t = setup('x', 1, { completions: [] })
    t.suggest.trigger()
    await t.settle()
    expect(t.suggest.view).toMatchObject({ rows: [], message: 'No suggestions.' })
    t.suggest.close()
    t.type('y')
    await t.settle()
    expect(t.suggest.view).toBeUndefined()
  })

  it('replaces the item’s own range, and makes its other edits too', async () => {
    const t = setup('let a = fo', 10, {
      completions: () => [{ label: 'format', insertText: 'formatDate', range: { from: 8, to: 10 }, additionalEdits: [{ from: 0, to: 0, insert: "import { formatDate } from './date'\n" }] }],
    })
    t.suggest.trigger()
    await t.settle()
    t.dispatch(t.suggest.accept())
    expect(t.state().doc.toString()).toBe("import { formatDate } from './date'\nlet a = formatDate")
    expect(t.state().selection.main.head).toBe(t.state().doc.length)
  })

  it('asks again as the word grows when the list is incomplete', async () => {
    const t = setup('', 0, { completions: (r) => ({ items: items(`a${r.position}`, `ab${r.position}`), incomplete: true }) })
    t.type('a')
    await t.settle()
    t.type('b')
    await t.settle()
    expect(t.service.of('completions')).toHaveLength(2)
    expect(t.labels()).toEqual(['ab2'])
  })

  it('fills in the selected item, and shows or hides its details on ⌃Space', async () => {
    const t = setup('', 0, { completions: items('one', 'onto'), resolveCompletion: (item) => ({ ...item, detail: `${item.label}: string` }) })
    t.type('o')
    await t.settle()
    expect(t.suggest.selected!.detail).toBe('one: string')
    expect(t.suggest.view!.details).toBe(false)
    t.suggest.trigger()
    expect(t.suggest.view!.details).toBe(true)
    t.suggest.move(1)
    await t.settle()
    expect(t.suggest.selected!.detail).toBe('onto: string')
  })

  it('stays quiet in comments and strings while typing', async () => {
    const service = new ScriptedLanguageService({ completions: items('word') })
    let state = EditorState.create({ doc: '', language: 'typescript' })
    const suggest = new Suggest({ service, delay: 0 }, () => state, () => true)
    const tr = state.update(insertText('w')(state)!)
    state = tr.state
    suggest.handleTransaction(tr)
    await vi.advanceTimersByTimeAsync(20)
    expect(service.requests).toHaveLength(0)
  })
})

describe('diagnostics', () => {
  it('asks when made and after edits, and keeps problems on their text meanwhile', async () => {
    const service = new ScriptedLanguageService({
      diagnostics: ({ doc }) => {
        const at = doc.toString().indexOf('bad')
        return at < 0 ? [] : [{ from: at, to: at + 3, severity: 'error', message: 'Bad.' }]
      },
    })
    let state = EditorState.create({ doc: 'a bad b', language: 'typescript' })
    const diagnostics = new Diagnostics({ service, delay: 500 }, () => state)
    await vi.advanceTimersByTimeAsync(0)
    expect(diagnostics.all).toMatchObject([{ from: 2, to: 5 }])
    expect(diagnostics.counts).toEqual({ errors: 1, warnings: 0, infos: 0 })
    const tr = state.update({ changes: { from: 0, insert: 'xx' } })
    state = tr.state
    diagnostics.handleTransaction(tr)
    // Moved with the text at once; asked again later.
    expect(diagnostics.all).toMatchObject([{ from: 4, to: 7 }])
    expect(diagnostics.at(5)).toHaveLength(1)
    expect(diagnostics.at(8)).toHaveLength(0)
    expect(service.of('diagnostics')).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(500)
    expect(service.of('diagnostics')).toHaveLength(2)
    diagnostics.destroy()
  })

  it('maps an answer that comes after more edits onto the text as it is', async () => {
    const service = new ScriptedLanguageService({ delay: 100, diagnostics: [{ from: 0, to: 1, severity: 'warning', message: 'W' }] })
    let state = EditorState.create({ doc: 'w', language: 'typescript' })
    const diagnostics = new Diagnostics({ service }, () => state)
    const tr = state.update({ changes: { from: 0, insert: '12' } })
    state = tr.state
    diagnostics.handleTransaction(tr)
    // The first answer was for "w": it lands on "w", now at 2.
    await vi.advanceTimersByTimeAsync(100)
    expect(service.aborted).toHaveLength(0)
    expect(diagnostics.all).toMatchObject([{ from: 2, to: 3, severity: 'warning' }])
    expect(diagnostics.next(0)).toMatchObject({ from: 2 })
    diagnostics.destroy()
  })
})
