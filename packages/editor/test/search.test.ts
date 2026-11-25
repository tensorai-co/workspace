import { Text } from '@tensorai-co/workspace/text'
import { describe, expect, it } from 'vitest'
import { EditorState, findMatches, findNext, findPrevious, matchIndex, preserveCase, replaceAll, replacementFor, replaceNext, selectAllMatches, undo, type SearchQuery } from '../src/core/index.js'

const doc = Text.of('const count = 1\nlet Counter = count + 1\n// counted')
const spans = (q: SearchQuery, d = doc) => findMatches(d, q).matches.map((m) => d.slice(m.from, m.to) + '@' + m.from)

describe('finding', () => {
  it('finds text, ignoring case unless asked', () => {
    expect(spans({ search: 'count' })).toEqual(['count@6', 'Count@20', 'count@30', 'count@43'])
    expect(spans({ search: 'count', caseSensitive: true })).toEqual(['count@6', 'count@30', 'count@43'])
    expect(spans({ search: '' })).toEqual([])
  })

  it('matches whole words by the default word separators', () => {
    expect(spans({ search: 'count', wholeWord: true })).toEqual(['count@6', 'count@30'])
    // A match that starts or ends with a separator stands on that side.
    expect(spans({ search: '= count', wholeWord: true })).toEqual(['= count@28'])
    expect(spans({ search: '= c', wholeWord: true })).toEqual([])
  })

  it('takes regular expressions line by line, and over lines when they can match a line break', () => {
    expect(spans({ search: '^\\w+', regexp: true })).toEqual(['const@0', 'let@16'])
    expect(spans({ search: '1$', regexp: true })).toEqual(['1@14', '1@38'])
    expect(spans({ search: '1\\nlet', regexp: true })).toEqual(['1\nlet@14'])
    expect(spans({ search: 'count\n', regexp: false }, Text.of('count\ncount'))).toEqual(['count\n@0'])
    expect(findMatches(doc, { search: '(', regexp: true }).error).toMatch(/./)
    // An empty match doesn't loop.
    expect(findMatches(Text.of('ab'), { search: 'x*', regexp: true }).matches).toHaveLength(3)
  })

  it('stops at the limit, and searches within a range', () => {
    const many = Text.of('a'.repeat(30))
    const result = findMatches(many, { search: 'a' }, undefined, 10)
    expect(result.matches).toHaveLength(10)
    expect(result.limited).toBe(true)
    expect(spans({ search: 'count' }).length).toBe(4)
    expect(findMatches(doc, { search: 'count' }, { from: 16, to: 40 }).matches.map((m) => m.from)).toEqual([20, 30])
  })

  it('goes to the next and previous match, round the ends', () => {
    let state = EditorState.create({ doc: doc.toString(), selection: 0 })
    const { matches } = findMatches(state.doc, { search: 'count' })
    state = state.apply(findNext(state, matches)!)
    expect(matchIndex(matches, state)).toBe(0)
    state = state.apply(findNext(state, matches)!)
    expect(state.selection.main.from).toBe(20)
    state = state.apply(findPrevious(state, matches)!)
    state = state.apply(findPrevious(state, matches)!)
    expect(matchIndex(matches, state)).toBe(3)
    expect(selectAllMatches(matches)!.selection).toMatchObject({ ranges: { length: 4 } })
  })
})

describe('replacing', () => {
  it('builds replacements with groups, escapes and case changes', () => {
    const q = (replace: string): SearchQuery => ({ search: '(\\w+)-(\\w+)', regexp: true, replace })
    expect(replacementFor(q('$2-$1'), 'foo-bar', ['foo-bar', 'foo', 'bar'])).toBe('bar-foo')
    expect(replacementFor(q('[$&] [$0] $$1'), 'foo-bar', ['foo-bar', 'foo', 'bar'])).toBe('[foo-bar] [foo-bar] $1')
    expect(replacementFor(q('\\u$1\\U$2'), 'foo-bar', ['foo-bar', 'foo', 'bar'])).toBe('FooBAR')
    expect(replacementFor(q('\\L$0\\n\\t\\\\'), 'Foo-Bar', ['Foo-Bar', 'Foo', 'Bar'])).toBe('foo-bar\n\t\\')
    expect(replacementFor({ search: 'x', replace: '$1\\n' }, 'x')).toBe('$1\\n')
  })

  it('keeps case when asked', () => {
    expect(preserveCase('Foo', 'bar')).toBe('Bar')
    expect(preserveCase('FOO', 'bar')).toBe('BAR')
    expect(preserveCase('foo', 'Bar')).toBe('bar')
    expect(preserveCase('foo-Bar', 'baz-qux')).toBe('baz-Qux')
    expect(preserveCase('FOO_bar', 'baz_qux')).toBe('BAZ_qux')
  })

  it('replaces the selected match and moves on, and replaces them all as one undo step', () => {
    const query: SearchQuery = { search: 'count', caseSensitive: true, replace: 'total' }
    let state = EditorState.create({ doc: doc.toString(), selection: 0 })
    let matches = findMatches(state.doc, query).matches
    // Not on a match: it only goes to the next one.
    state = state.apply(replaceNext(state, query, matches)!)
    expect(state.sliceDoc(state.selection.main.from, state.selection.main.to)).toBe('count')
    state = state.apply(replaceNext(state, query, matches)!)
    expect(state.doc.line(1).text).toBe('const total = 1')
    matches = findMatches(state.doc, query).matches
    expect(matchIndex(matches, state)).toBe(0)
    expect(state.selection.main.from).toBe(30)

    state = state.apply(replaceAll(state, query)!)
    expect(state.doc.toString()).toBe('const total = 1\nlet Counter = total + 1\n// totaled')
    state = state.apply(undo(state)!)
    expect(state.doc.toString()).toBe('const total = 1\nlet Counter = count + 1\n// counted')
    expect(replaceAll(state, { search: 'nothing', replace: 'x' })).toBeNull()
  })
})
