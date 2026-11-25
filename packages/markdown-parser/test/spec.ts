// Reads the examples out of a CommonMark-style spec file (test/fixtures).
// Each is a fenced block of Markdown and the HTML it should produce, split
// by a line holding only ".". In them, → stands for a tab.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface Example {
  number: number
  section: string
  /** The example's extension: "table", "autolink", "strikethrough"… or "" for core. */
  extension: string
  markdown: string
  html: string
}

const FENCE = '`'.repeat(32)

export function readExamples(file: string): Example[] {
  const lines = readFileSync(join(import.meta.dirname, 'fixtures', file), 'utf8').split('\n')
  const out: Example[] = []
  let section = ''
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.startsWith('#')) {
      section = line.replace(/^#+\s*/, '')
      continue
    }
    if (!line.startsWith(FENCE + ' example')) continue
    const extension = line.slice((FENCE + ' example').length).trim()
    const md: string[] = []
    const html: string[] = []
    let target = md
    for (i++; i < lines.length && lines[i] !== FENCE; i++) {
      if (lines[i] === '.' && target === md) {
        target = html
        continue
      }
      target.push(lines[i]!)
    }
    const text = (ls: string[]) => (ls.length ? ls.join('\n') + '\n' : '').replace(/→/g, '\t')
    out.push({ number: out.length + 1, section, extension, markdown: text(md), html: text(html) })
  }
  return out
}
