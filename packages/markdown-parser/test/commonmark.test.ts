// Conformance: every example in the CommonMark spec (0.31.2) and GitHub's
// extension examples. A few differ on purpose; they're listed with why.

import { describe, expect, it } from 'vitest'
import { parse } from '../src/index.js'
import { toHtml } from './html.js'
import { readExamples } from './spec.js'

/** Examples this parser answers differently on purpose, by number. */
const COMMONMARK_DIFFERENCES: Record<number, string> = {
  25: 'HTML5-only entity names stay as written; HTML 4 names decode',
  610: "GitHub's extended autolinks link a bare URL",
  613: "GitHub's extended autolinks link a bare URL",
  614: "GitHub's extended autolinks link a bare email address",
}

const GFM_DIFFERENCES: Record<number, string> = {}

describe('CommonMark spec', () => {
  const examples = readExamples('commonmark-spec.txt')
  for (const ex of examples) {
    const why = COMMONMARK_DIFFERENCES[ex.number]
    const test = why ? it.skip : it
    test(`${ex.number} ${ex.section}${why ? ` (${why})` : ''}`, () => {
      expect(toHtml(parse(ex.markdown))).toBe(ex.html)
    })
  }
})

describe('GitHub extensions', () => {
  const examples = readExamples('gfm-spec.txt').filter((e) => ['table', 'strikethrough', 'autolink'].includes(e.extension))
  for (const ex of examples) {
    const why = GFM_DIFFERENCES[ex.number]
    const test = why ? it.skip : it
    test(`${ex.number} ${ex.section}${why ? ` (${why})` : ''}`, () => {
      expect(toHtml(parse(ex.markdown))).toBe(ex.html)
    })
  }
})
