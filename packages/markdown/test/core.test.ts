import { describe, expect, it } from 'vitest'
import { blockOfLine, findFrontMatter, imageType, lineOfAnchor, readMarkdown, readYaml, resolveImage, resolveLink, ScrollMap, Slugs, syncScroll, type LineScroller, type ViewElement, type ViewNode } from '../src/core/index.js'

/** A tree as short text: `p[a "text"]`. */
const show = (nodes: ViewNode[]): string => nodes.map((n) => (typeof n === 'string' ? JSON.stringify(n) : `${n.tag}${attrs(n)}${n.children.length ? `[${show(n.children)}]` : ''}`)).join(' ')
const attrs = (n: ViewElement) => Object.entries(n.attrs ?? {}).map(([k, v]) => `{${k}=${v}}`).join('')
const read = (text: string) => show(readMarkdown(text).nodes)
const lines = (text: string) => readMarkdown(text).nodes.filter((n) => typeof n !== 'string').map((n) => `${n.tag} ${n.line}-${n.endLine}`)

describe('blocks', () => {
  it('have the lines they came from', () => {
    expect(lines('# A\n\none\ntwo\n\n```ts\nx\n```\n> q\n\n- a\n- b\n\n| a |\n| - |\n| b |\n\n---\n')).toEqual(['h1 1-1', 'p 3-4', 'pre 6-8', 'blockquote 9-9', 'ul 11-12', 'table 14-16', 'hr 18-18'])
  })

  it('have the right lines inside lists, quotes and tables', () => {
    const [ul, table] = readMarkdown('- a\n- b\n  - c\n\n| h |\n| - |\n| 1 |\n| 2 |\n').nodes as ViewElement[]
    expect((ul!.children as ViewElement[]).map((li) => [li.line, li.endLine])).toEqual([[1, 1], [2, 3]])
    const rows = (table!.children as ViewElement[]).flatMap((s) => s.children as ViewElement[])
    expect(rows.map((r) => r.line)).toEqual([5, 7, 8])
  })

  it('keep Windows line endings straight', () => {
    expect(lines('# A\r\n\r\none\r\n')).toEqual(['h1 1-1', 'p 3-3'])
  })

  it('leave out paragraphs in tight lists', () => {
    expect(read('- a\n- b')).toBe('ul[li["a"] li["b"]]')
    expect(read('- a\n\n- b')).toBe('ul[li[p["a"]] li[p["b"]]]')
    expect(read('3. a')).toBe('ol{start=3}[li["a"]]')
  })

  it('know fenced code from indented code', () => {
    const code = (text: string) => (readMarkdown(text).nodes[0] as ViewElement).code
    expect(code('```ts\nx\n```')).toEqual({ lang: 'ts', text: 'x', fenced: true })
    expect(code('    x\n    y')).toEqual({ text: 'x\ny', fenced: false })
    expect(code('```\n```')).toEqual({ text: '', fenced: true })
  })

  it('put a box in task list items', () => {
    expect(read('- [x] a\n- [ ] b')).toBe('ul[li[input{type=checkbox}{checked=} " " "a"] li[input{type=checkbox} " " "b"]]')
    expect(read('- [x] a\n\n- b')).toContain('li[p[input{type=checkbox}{checked=} " " "a"]]')
  })

  it('align table cells', () => {
    expect(read('| a | b |\n| :-: | - |\n| c | d |')).toBe('table[thead[tr[th{align=center}["a"] th["b"]]] tbody[tr[td{align=center}["c"] td["d"]]]]')
  })

  it('are the same objects when they did not change', () => {
    const a = readMarkdown('# A\n\none\n\ntwo\n')
    const b = readMarkdown('# A\n\none!\n\ntwo\n', a)
    expect(b.nodes[0]).toBe(a.nodes[0])
    expect(b.nodes[1]).not.toBe(a.nodes[1])
    expect(b.nodes[2]).toBe(a.nodes[2])
  })

  it('keep their keys when others come and go around them', () => {
    const a = readMarkdown('# A\n\none\n\n> two\n')
    const b = readMarkdown('# A\n\nnew\n\none\n\n> two\n', a)
    expect(b.keys.length).toBe(4)
    expect([b.keys[0], b.keys[2], b.keys[3]]).toEqual(a.keys)
    expect(new Set(b.keys).size).toBe(4)
    const c = readMarkdown('# A\n\n> two\n', b)
    expect(c.keys).toEqual([b.keys[0], b.keys[3]])
    // A block being written stays itself.
    expect(readMarkdown('# A\n\n> twos\n', c).keys).toEqual(c.keys)
  })

  it('of a long file are all parsed, with their lines and the definitions far below', () => {
    const part = (i: number) => `## Part ${i}\n\nSee [it][far].\n\n${'word '.repeat(2000)}\n\n`
    const text = Array.from({ length: 40 }, (_, i) => part(i)).join('') + '\n[far]: https://example.com/far\n'
    const doc = readMarkdown(text)
    const headings = (doc.nodes as ViewElement[]).filter((n) => n.tag === 'h2')
    expect(headings).toHaveLength(40)
    expect(headings.map((h) => h.line)).toEqual(Array.from({ length: 40 }, (_, i) => 1 + i * 6))
    const paragraphs = (doc.nodes as ViewElement[]).filter((n) => n.tag === 'p')
    expect(paragraphs).toHaveLength(80)
    expect(show(paragraphs[0]!.children)).toContain('a{href=https://example.com/far}')
  })

  it('of a long file are not cut inside a fence', () => {
    const text = `${'a '.repeat(10000)}\n\n\`\`\`\n${'# not a heading\n'.repeat(4000)}\`\`\`\n\n# End\n\n${'b '.repeat(20000)}\n`
    const doc = readMarkdown(text)
    expect((doc.nodes as ViewElement[]).map((n) => n.tag)).toEqual(['p', 'pre', 'h1', 'p'])
  })
})

describe('headings', () => {
  it('get GitHub’s slugs', () => {
    const slugs = new Slugs()
    expect(['What’s new?', 'A  b', 'Ünïcode_x', 'C++', 'a', 'A', 'a'].map((s) => slugs.add(s))).toEqual(['whats-new', 'a--b', 'ünïcode_x', 'c', 'a', 'a-1', 'a-2'])
  })

  it('can be found by them', () => {
    const doc = readMarkdown('# One\n\n## `Two` *and* three\n\n<a name="here"></a>\n\ntext\n')
    expect(lineOfAnchor(doc, 'two-and-three')).toBe(3)
    expect(lineOfAnchor(doc, 'ONE')).toBe(1)
    expect(lineOfAnchor(doc, 'nope')).toBeUndefined()
    expect(lineOfAnchor(doc, 'here')).toBeDefined()
  })
})

describe('HTML', () => {
  it('becomes elements', () => {
    expect(read('Press <kbd>A</kbd>.<br/>H<sub>2</sub>O')).toBe('p["Press " kbd["A"] "." br "H" sub["2"] "O"]')
    expect(read('<p align="center">\n  <img src="a.png" width=20 alt="A &amp; B">\n</p>')).toBe('div p{align=center}["\\n  " img{src=a.png}{width=20}{alt=A & B} "\\n"]')
  })

  it('holds the Markdown between its tags', () => {
    expect(read('<details>\n<summary>S</summary>\n\n**in**\n\n</details>\n\nout').replace(/"\\n+" ?/g, '')).toBe('div details[summary["S"] p[strong["in"]] div] p["out"]')
  })

  it('never runs: scripts, handlers, styles and frames go', () => {
    const out = read('<script>alert(1)</script>\n\n<b onclick="x()" style="color:red" class="y">b</b> <iframe src="x">z</iframe><object></object> <img src=x onerror=alert(1)>\n\n<style>b{}</style>\n\n<svg onload=x><circle/></svg>')
    expect(out).not.toMatch(/script|alert\(1\)\]|onclick|style|class|iframe|object|onerror|svg|circle/)
    expect(out).toContain('b["b"]')
    expect(out).not.toContain('"z"')
  })

  it('is closed where it is left open', () => {
    expect(read('a <b>b\n\nc')).toBe('p["a " b["b"]] p["c"]')
    expect(read('x </b> y')).toBe('p["x " " y"]')
    expect(read('<ul><li>a<li>b</ul>').replace('div ', '')).toBe('ul[li["a"] li["b"]]')
    expect(read('<table><tr><td>a<td>b<tr><td>c</table>').replace('div ', '')).toBe('table[tbody[tr[td["a"] td["b"]] tr[td["c"]]]]')
  })

  it('drops comments', () => {
    expect(read('a <!-- b --> c')).toBe('p["a " " c"]')
    expect(read('<!-- x -->')).toBe('div')
  })
})

describe('links', () => {
  const place = { path: '/work/docs/a.md', root: '/work' }
  const link = (href: string, p: object = place) => resolveLink(href, p)

  it('lead to files', () => {
    expect(link('b.md')).toEqual({ kind: 'file', path: '/work/docs/b.md' })
    expect(link('../src/a%20b.ts#L12')).toEqual({ kind: 'file', path: '/work/src/a b.ts', line: 12 })
    expect(link('./b.md?x#some-part')).toEqual({ kind: 'file', path: '/work/docs/b.md', anchor: 'some-part' })
    expect(link('/README.md')).toEqual({ kind: 'file', path: '/work/README.md' })
  })

  it('lead to headings and the web', () => {
    expect(link('#two')).toEqual({ kind: 'anchor', anchor: 'two' })
    expect(link('https://example.com/a')).toEqual({ kind: 'web', url: 'https://example.com/a' })
    expect(link('//example.com')).toEqual({ kind: 'web', url: 'https://example.com/' })
    expect(link('mailto:a@example.com')).toEqual({ kind: 'web', url: 'mailto:a@example.com' })
  })

  it('never lead to code, out of the root, or anywhere without a path', () => {
    for (const href of ['javascript:x', ' JavaScript:x', 'data:text/html,x', 'vbscript:x', 'file:///etc/passwd', 'command:x', '../../etc/passwd', '/../x', '%2e%2e/%2e%2e/etc', '', '#'.slice(1)]) expect(link(href), href).toBeUndefined()
    expect(link('b.md', {})).toBeUndefined()
  })

  it('find images', () => {
    expect(resolveImage('../logo.png', place)).toEqual({ kind: 'file', path: '/work/logo.png' })
    expect(resolveImage('https://example.com/a.png', place)).toEqual({ kind: 'web', url: 'https://example.com/a.png' })
    expect(resolveImage('data:image/png;base64,AA', place)).toEqual({ kind: 'web', url: 'data:image/png;base64,AA' })
    expect(resolveImage('data:text/html,x', place)).toBeUndefined()
    expect(resolveImage('mailto:a@example.com', place)).toBeUndefined()
    expect([imageType('/a.PNG'), imageType('/a.svg'), imageType('/a.txt')]).toEqual(['image/png', 'image/svg+xml', undefined])
  })
})

describe('front matter', () => {
  it('is found at the top only', () => {
    expect(findFrontMatter('---\na: 1\n---\n# x')).toEqual({ source: 'a: 1', length: 13, lines: 3 })
    expect(findFrontMatter('---\na: 1')).toBeUndefined()
    expect(findFrontMatter('\n---\na: 1\n---\n')).toBeUndefined()
    expect(lines('---\na: 1\n---\n# x')).toEqual(['table 1-3', 'h1 4-4'])
  })

  it('reads the YAML people write', () => {
    expect(readYaml('a: 1\nb: "x: y" # c\nc: \'it\'\'s\'\nd: ~\ne: true\nurl: https://example.com/a')).toEqual({ a: '1', b: 'x: y', c: "it's", d: null, e: 'true', url: 'https://example.com/a' })
    expect(readYaml('a: [x, "y, z", {b: c}]\nb:\n  - x\n  - y: 1\n    z: 2\nc:\n  d:\n    e: f\n- g'.slice(0, -4))).toEqual({ a: ['x', 'y, z', { b: 'c' }], b: ['x', { y: '1', z: '2' }], c: { d: { e: 'f' } } })
    expect(readYaml('a: |\n  one\n   two\nb: >\n  one\n  two\nc: x\n  y')).toEqual({ a: 'one\n two', b: 'one two', c: 'x y' })
    expect(readYaml('a:\n- x\n- y\nb: 2')).toEqual({ a: ['x', 'y'], b: '2' })
    expect(readYaml('# nothing')).toBeNull()
  })

  it('gives up on the rest, which shows as code', () => {
    for (const source of ['a: &x 1', 'a: [1', 'a: 1\n  b: 2', 'a: !!set {}', '{{x}}: 1']) expect(readYaml(source), source).toBeUndefined()
    expect((readMarkdown('---\na: &x 1\n---\n').nodes[0] as ViewElement).code?.text).toBe('a: &x 1')
  })

  it('is a table', () => {
    expect(read('---\na: 1\nb: [x, y]\nc:\n  d: e\n---\n')).toBe('table{title=Frontmatter}[tbody[tr[th["a"] td["1"]] tr[th["b"] td[ul[li["x"] li["y"]]]] tr[th["c"] td[code["d: e"]]]]]')
    expect(read('---\n---\nx')).toBe('p["x"]')
  })
})

describe('scrolling', () => {
  const map = new ScrollMap(
    [
      { line: 1, endLine: 1, top: 14, bottom: 60 },
      { line: 3, endLine: 4, top: 80, bottom: 120 },
      // A list, with its first item on the same line.
      { line: 6, top: 140, bottom: 200 },
      { line: 6, endLine: 6, top: 140, bottom: 160 },
      { line: 7, endLine: 7, top: 160, bottom: 200 },
      { line: 9, endLine: 13, top: 220, bottom: 300, code: { top: 236, bottom: 284, lines: 3 } },
    ],
    14,
    340,
  )

  it('finds a line’s place, and the line at a place', () => {
    expect(map.offsetOf(1)).toBe(0)
    expect(map.offsetOf(3)).toBe(80)
    expect(map.offsetOf(3.5)).toBe(90)
    expect(map.offsetOf(6)).toBe(140)
    expect(map.offsetOf(10)).toBe(236)
    expect(map.offsetOf(11)).toBe(252)
    expect(map.offsetOf(999)).toBe(340)
    for (const line of [1, 1.5, 2.25, 3, 4.9, 6, 6.5, 7, 8.5, 9, 10, 11.5, 13, 14]) expect(map.lineAt(map.offsetOf(line))).toBeCloseTo(line, 5)
    expect(map.lineAt(-50)).toBe(1)
  })

  it('finds the block a line is in', () => {
    const blocks = [{ line: 1 }, { line: 3 }, { line: 3, inner: true }, { line: 6 }]
    expect(blockOfLine(blocks, 3)).toBe(blocks[1])
    expect(blockOfLine(blocks, 5)).toBe(blocks[2])
    expect(blockOfLine(blocks, 99)).toBe(blocks[3])
    expect(blockOfLine(blocks, 0)).toBeUndefined()
  })

  it('keeps two views together, without echoes', () => {
    let time = 0
    const made = (bias: number) => {
      const listeners = new Set<() => void>()
      let top = 1
      let calls = 0
      const side: LineScroller & { user(line: number): void; calls: number } = {
        get topLine() {
          return top
        },
        get calls() {
          return calls
        },
        scrollToLine(line) {
          calls++
          // Neither side can stop exactly where it's told.
          top = line + bias
          listeners.forEach((l) => l())
        },
        onScroll(l) {
          listeners.add(l)
          return () => void listeners.delete(l)
        },
        user(line) {
          top = line
          listeners.forEach((l) => l())
        },
      }
      return side
    }
    const a = made(0.1)
    const b = made(0.2)
    a.user(5)
    const stop = syncScroll(a, b, () => time)
    expect(b.topLine).toBeCloseTo(5.2)
    time = 1000
    a.user(8)
    expect([a.topLine, b.topLine].map((n) => +n.toFixed(1))).toEqual([8, 8.2])
    expect(a.calls).toBe(0)
    time = 2000
    b.user(3)
    expect([a.topLine, b.topLine].map((n) => +n.toFixed(1))).toEqual([3.1, 3])
    stop()
    time = 3000
    a.user(20)
    expect(b.topLine).toBe(3)
  })
})
