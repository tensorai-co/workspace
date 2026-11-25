import { LANGUAGES, loadLanguage, tokenize, type LanguageId } from '@tensorai-co/workspace/highlight'
import { ChangeSet, Text } from '@tensorai-co/workspace/text'
import { describe, expect, it } from 'vitest'
import { allLanguages, detectLanguage, languageById, loadGrammar, Tokenizer } from '../src/index.js'

describe('detectLanguage', () => {
  it('picks languages by file name, pattern, extension and first line', () => {
    expect(detectLanguage('src/App.tsx').id).toBe('typescriptreact')
    expect(detectLanguage('src/App.tsx').grammar).toBe('tsx')
    expect(detectLanguage('types.d.ts').id).toBe('typescript')
    expect(detectLanguage('package.json').id).toBe('json')
    expect(detectLanguage('tsconfig.json').id).toBe('jsonc')
    expect(detectLanguage('Dockerfile').id).toBe('dockerfile')
    expect(detectLanguage('.bashrc').id).toBe('shellscript')
    expect(detectLanguage('script', '#!/usr/bin/env python3').id).toBe('python')
    expect(detectLanguage('Cargo.toml').grammar).toBe('toml')
    expect(detectLanguage('notes.unknownext').id).toBe('plaintext')
  })

  it('has TSX editing rules', () => {
    const tsx = languageById('tsx')
    expect(tsx.id).toBe('typescriptreact')
    expect(tsx.rules.lineComment).toBe('//')
    expect(tsx.rules.blockComment).toEqual({ open: '/*', close: '*/' })
    expect(tsx.rules.autoClosingPairs.map((p) => p.open)).toContain('{')
    expect(tsx.rules.increaseIndent?.test('function f() {')).toBe(true)
    expect(tsx.rules.onEnter.length).toBeGreaterThan(0)
  })

  it('covers every highlight language', () => {
    const grammars = new Set(allLanguages().map((l) => l.grammar))
    for (const id of Object.keys(LANGUAGES)) expect(grammars.has(id as LanguageId)).toBe(true)
  })
})

describe('Tokenizer', () => {
  it('matches tokenizing from scratch after random edits', async () => {
    const grammar = await loadGrammar(languageById('tsx'))
    const source = [
      'import { useState } from "react"',
      '/* a block',
      '   comment */',
      'export function App({ name }: { name: string }) {',
      '  const [n, setN] = useState(0) // count',
      '  return <button onClick={() => setN(n + 1)}>{`Hi ${name}`}</button>',
      '}',
    ].join('\n')
    let doc = Text.of(source)
    const tk = new Tokenizer(doc, grammar)
    tk.all()
    let seed = 3
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0), seed / 2 ** 32)
    const pieces = ['/*', '*/', '`', '"', '\n', '{', '}', 'x', ' ', '// c\n', '<div>']
    for (let round = 0; round < 3000; round++) {
      const from = Math.floor(random() * (doc.length + 1))
      const to = Math.min(doc.length, from + Math.floor(random() * 3))
      const changes = ChangeSet.of({ from, to, insert: pieces[Math.floor(random() * pieces.length)]! }, doc.length)
      doc = changes.apply(doc)
      tk.update(changes, doc)
      // Sometimes edit again before any work runs, as fast typing does.
      if (round % 3 !== 0) tk.work(Math.floor(random() * doc.lines) + 1, Infinity)
      if (round % 7 === 0) expect(tk.all()).toEqual(tokenize(doc.toString(), grammar!))
    }
    expect(tk.all()).toEqual(tokenize(doc.toString(), grammar!))
  })

  it('re-tokenizes only the edited line when states converge', async () => {
    const grammar = (await loadLanguage('typescript')).grammar
    let doc = Text.of(Array.from({ length: 2000 }, (_, i) => `const v${i} = ${i}`))
    const tk = new Tokenizer(doc, grammar)
    tk.all()
    const changes = ChangeSet.of({ from: doc.line(1000).to, insert: ' + 1' }, doc.length)
    doc = changes.apply(doc)
    tk.update(changes, doc)
    const changed = tk.work(doc.lines, Infinity)
    expect(changed).toEqual({ from: 1000, to: 2000 })
    expect(tk.done).toBe(true)
    expect(tk.lineTokens(1000)?.map((t) => t.text).join('')).toBe('const v999 = 999 + 1')
  })
})

describe('previews', () => {
  it('tokenizes lines that aren’t in the document as if they began at a line, once the line before is done', async () => {
    const grammar = await loadGrammar(languageById('typescript'))
    const doc = Text.of('const s = `start\nend`\nx')
    const tokenizer = new Tokenizer(doc, grammar)
    expect(tokenizer.preview(3, ['y'])).toBeUndefined()
    tokenizer.all()
    // Line 2 begins inside the template string: so does the preview.
    const inside = tokenizer.preview(2, ['more`', 'let y'])!
    expect(inside[0]![0]!.type).toBe('string')
    expect(inside[1]!.find((t) => t.text === 'let')?.type).toBe('keyword')
    expect(new Tokenizer(doc, undefined).preview(1, ['a'])).toBeUndefined()
  })
})
