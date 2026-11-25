import { beforeAll, describe, expect, it } from 'vitest'
import type { Grammar } from '../src/engine/grammar.js'
import { MAX_LINE_LENGTH, MAX_LINES, Session, tokenize, tokenizeLine } from '../src/engine/tokenizer.js'
import { LANGUAGES, loadLanguage, resolveGrammar, type LanguageId } from '../src/languages/index.js'
import type { Token } from '../src/tokens.js'

/** Tokens as text: a typed token as ‹type|text›, plain text as it is. */
const show = (lines: Token[][]) => lines.map((line) => line.map((t) => (t.type ? `‹${t.type}|${t.text}›` : t.text)).join('')).join('\n') + '\n'
/** Loads every language, so embedded code can be colored. */
const loadAll = () => Promise.all((Object.keys(LANGUAGES) as LanguageId[]).map(loadLanguage))

const tiny: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /#.*/, token: 'comment' },
      { match: /"/, token: 'string', push: 'str' },
      { match: /(fn)(\s+)(\w+)/, groups: ['keyword', undefined, 'function'] },
      { match: /\//, token: 'regexp', after: (p) => p === undefined || p.text === '(' },
      { match: /\//, token: 'operator' },
      { match: /\w+/ },
      { match: /[()]/, token: 'punctuation' },
    ],
    str: [
      { match: /[^"]+/, token: 'string' },
      { match: /"/, token: 'string', pop: true },
    ],
  },
}

describe('engine', () => {
  it('carries states from line to line', () => {
    expect(show(tokenize('a "b\nc" d', tiny))).toBe('a ‹string|"b›\n‹string|c"› d\n')
  })

  it('gives capture groups their own types', () => {
    expect(show(tokenize('fn main', tiny))).toBe('‹keyword|fn› ‹function|main›\n')
  })

  it('tells rules the previous significant token, skipping comments and spaces', () => {
    expect(show(tokenize('/ x / ( /', tiny))).toBe('‹regexp|/› x ‹operator|/› ‹punctuation|(› ‹regexp|/›\n')
  })

  it('emits what nothing matches as plain text, whole code points', () => {
    const lines = tokenize('😀€', tiny)
    expect(lines[0]).toEqual([{ text: '😀€' }])
  })

  it('gives up on rules that only bounce between states', () => {
    const loop: Grammar = {
      states: {
        root: [{ match: /(?=a)/, push: 'b' }],
        b: [{ match: /(?=a)/, pop: true }],
      },
    }
    expect(tokenize('aaa', loop)[0]!.map((t) => t.text).join('')).toBe('aaa')
  })

  it('tokenizes long lines and many lines only so far, then shows plain text', () => {
    const long = 'x '.repeat(MAX_LINE_LENGTH)
    const [line] = tokenize('fn ' + long, tiny)
    expect(line!.map((t) => t.text).join('')).toBe('fn ' + long)
    const many = tokenize('fn a\n'.repeat(MAX_LINES + 2), tiny)
    expect(many[MAX_LINES + 1]).toEqual([{ text: 'fn a' }])
  })

  it('refuses grammars with missing or circular states', () => {
    expect(() => tokenizeLine('x', [], { states: { root: [{ include: 'nope' }] } })).toThrow(/no state "nope"/)
    expect(() => tokenizeLine('x', [], { states: { root: [{ include: 'a' }], a: [{ include: 'root' }] } })).toThrow(/includes itself/)
  })
})

// A host that embeds tiny in <x>…</x>, a fence's language until ```, and tiny to a line's end after $.
const host: Grammar = {
  states: {
    root: [
      { match: /<x>/, token: 'tag', push: '@x' },
      { match: /```\w+$/, token: 'meta', push: (t) => `@fence/${t.slice(3)}` },
      { match: /\$ /, token: 'meta', push: '@line' },
      { match: /[^<`$]+|[<`$]/ },
    ],
  },
  embeds: {
    x: { language: 'tiny', end: /<\/x>/ },
    fence: { language: (arg) => arg, end: (line, from) => (from === 0 && line === '```' ? 0 : -1) },
    line: { language: 'tiny', end: /$/ },
  },
}
const resolveTiny = (name: string) => (name === 'tiny' ? tiny : name === 'host' ? host : undefined)

describe('embeds', () => {
  it('runs another language inside, until the embed ends', () => {
    expect(show(tokenize('a <x>fn f</x> b', host, resolveTiny))).toBe('a ‹tag|<x>›‹keyword|fn› ‹function|f›</x> b\n')
  })

  it('ends an embed even inside the other language\'s string, as HTML does', () => {
    expect(show(tokenize('<x>"open</x> b', host, resolveTiny))).toBe('‹tag|<x>›‹string|"open›</x> b\n')
  })

  it('carries an embed and its states across lines', () => {
    expect(show(tokenize('```tiny\n"a\nb"\n```\nfn', host, resolveTiny))).toBe('‹meta|```tiny›\n‹string|"a›\n‹string|b"›\n```\nfn\n')
  })

  it('nests embeds', () => {
    expect(show(tokenize('```host\n<x>fn g</x>\n```', host, resolveTiny))).toBe('‹meta|```host›\n‹tag|<x>›‹keyword|fn› ‹function|g›</x>\n```\n')
  })

  it("shows a language it can't resolve as plain text, to the end", () => {
    expect(show(tokenize('```nope\nfn "a\n```\nfn', host, resolveTiny))).toBe('‹meta|```nope›\nfn "a\n```\nfn\n')
  })

  it('can end with the line', () => {
    expect(show(tokenize('$ fn a\nfn', host, resolveTiny))).toBe('‹meta|$ ›‹keyword|fn› ‹function|a›\nfn\n')
  })
})

const ids = Object.keys(LANGUAGES) as LanguageId[]
describe('every language', () => {
  beforeAll(loadAll)

  for (const id of ids) {
    it(`${id}: survives hostile lines`, async () => {
      const lang = await loadLanguage(id)
      for (const unit of ['"', "'", '`', '\\', '/*', '${', '$(', '{', '(', '[', '<<', '"\\', '#', 'f"{', '/a', '0x']) {
        const line = unit.repeat(MAX_LINE_LENGTH / unit.length)
        const t = performance.now()
        const out = tokenize(`${line}\n${line}`, lang.grammar, resolveGrammar)
        expect(out.map((l) => l.map((x) => x.text).join('')).join('\n')).toBe(`${line}\n${line}`)
        expect(performance.now() - t, `${id} ${unit}`).toBeLessThan(500)
      }
    })
  }
})
