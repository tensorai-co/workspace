// Inputs known to make Markdown parsers slow or overflow the stack, from
// cmark's pathological_tests.py, sized to fill MAX_LENGTH. Each must parse
// quickly and without throwing.

import { describe, expect, it } from 'vitest'
import { MAX_LENGTH, MAX_PADDED_CELLS, parse } from '../src/index.js'
import { toHtml } from './html.js'

const fill = (unit: string, extra = '') => unit.repeat(Math.floor((MAX_LENGTH - extra.length) / unit.length))

const CASES: Record<string, string> = {
  'nested strong emph': '*a **a '.repeat(7000) + 'b' + ' a** a*'.repeat(7000),
  'many emph closers with no openers': fill('a_ '),
  'many emph openers with no closers': fill('_a '),
  'many link closers with no openers': fill('a]'),
  'many link openers with no closers': fill('[a'),
  'mismatched openers and closers': fill('*a_ '),
  'openers and closers multiple of 3': 'a**b' + fill('c* ', 'a**b'),
  'link openers and emph closers': fill('[ a_'),
  'pattern [ (]( repeated': fill('[ (]('),
  'pattern ![[]() repeated': fill('![[]()'),
  'nested brackets': '['.repeat(49_000) + 'a' + ']'.repeat(49_000),
  'nested block quotes': fill('> ', 'a') + 'a',
  'deeply nested lists': Array.from({ length: 300 }, (_, i) => '  '.repeat(i) + '* a\n').join(''),
  'backticks': Array.from({ length: 440 }, (_, i) => 'e' + '`'.repeat(i + 1)).join(''),
  'unclosed links A': fill('[a](<b'),
  'unclosed links B': fill('[a](b'),
  'unclosed <!--': '</' + fill('<!--', '</'),
  'tables': fill('aaa\rbbb\n-\v\n'),
  'many table columns': '|' + 'a|'.repeat(20_000) + '\n|' + '-|'.repeat(20_000) + '\n',
  'short rows under many columns': '|' + 'a|'.repeat(20_000) + '\n|' + '-|'.repeat(20_000) + '\n' + 'x\n'.repeat(9_000),
  'many list items': fill('- a\n'),
  'long line of emphasis': fill('*a* '),
}

/**
 * What these catch (time that grows with the square of the input, or worse) takes many seconds. The limit leaves room
 * for the other test files running at the same time.
 */
const LIMIT = 3000

describe('pathological input', () => {
  for (const [name, input] of Object.entries(CASES)) {
    it(name, () => {
      const t = performance.now()
      const html = toHtml(parse(input))
      const ms = performance.now() - t
      expect(html.length).toBeGreaterThan(0)
      expect(ms, `${name}: ${Math.round(ms)} ms`).toBeLessThan(LIMIT)
    })
  }

  it('stops padding short table rows past MAX_PADDED_CELLS', () => {
    const root = parse('| a | b | c |\n| - | - | - |\n' + 'x\n'.repeat(MAX_PADDED_CELLS))
    const [table, paragraph] = root.children
    expect(table?.type).toBe('table')
    expect(table?.type === 'table' && table.children.length).toBe(MAX_PADDED_CELLS / 2 + 1)
    expect(paragraph?.type).toBe('paragraph')
  })

  it('streaming heals without slowing down', () => {
    for (const input of Object.values(CASES)) {
      const t = performance.now()
      parse(input, { streaming: true })
      expect(performance.now() - t).toBeLessThan(LIMIT)
    }
  })
})
