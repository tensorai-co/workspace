import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { charWidth, Parser, parseColor, Screen, stringWidth, type ColorRequest, type Params } from '../src/core/index.js'

const make = (cols = 20, rows = 5, options = {}) => new Screen({ cols, rows, ...options })
const show = (s: Screen) => s.view.map((l) => l.text(true)).join('\n').replace(/\n+$/, '')
const run = (text: string, cols?: number, rows?: number) => {
  const s = make(cols, rows)
  s.write(text)
  return s
}
const replies = (text: string) => {
  const s = make()
  let out = ''
  s.onData.listen((d) => (out += d))
  s.write(text)
  return out
}

describe('recorded programs', () => {
  // What each program printed, and the screen another terminal (xterm.js) made of it.
  const dir = join(import.meta.dirname, 'captures')
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.vt'))) {
    for (const size of [1, 7, 1_000_000])
      it(`${file} in pieces of ${size}`, () => {
        const data = readFileSync(join(dir, file))
        const s = new Screen({ cols: 80, rows: 24 })
        for (let i = 0; i < data.length; i += size) s.write(data.subarray(i, i + size))
        const b = s.buffer
        expect(`${s.isAlternate ? 'alternate' : 'normal'} ${b.x},${b.y} base ${b.base}\n${b.lines.slice(b.base).map((l) => l.text(true)).join('\n')}\n`).toBe(readFileSync(join(dir, file.replace('.vt', '.txt')), 'utf8'))
      })
  }
})

describe('the parser', () => {
  const trace = (text: string, split = false) => {
    const seen: string[] = []
    const values = (p: Params) => Array.from({ length: p.length }, (_, i) => `${p.raw(i) ?? ''}${p.sub(i) ? `:${p.sub(i)!.join(':')}` : ''}`).join(';')
    const parser = new Parser({
      print: (codes, start, end) => seen.push(String.fromCodePoint(...codes.subarray(start, end))),
      execute: (code) => seen.push(`^${code.toString(16)}`),
      esc: (i, f) => seen.push(`ESC ${i}${f}`),
      csi: (p, i, f, params) => seen.push(`CSI ${p}${values(params)}${i}${f}`),
      osc: (data) => seen.push(`OSC ${data}`),
      dcs: (p, i, f, params, data) => seen.push(`DCS ${p}${values(params)}${i}${f} ${data}`),
    })
    const codes = Uint32Array.from(text, (c) => c.codePointAt(0)!)
    if (split) for (const code of codes) parser.parse(Uint32Array.of(code), 1)
    else parser.parse(codes, codes.length)
    return seen
  }

  it('finds sequences, whole or in pieces', () => {
    const text = 'a\x1b[1;31mb\x1b[?25l\x1b[38:2::1:2:3m\x1b[2 q\x1b]0;hi\x07\x1b]8;;u\x1b\\\x1bP1$qm\x1b\\\x1b(0\r'
    const want = ['a', 'CSI 1;31m', 'b', 'CSI ?25l', 'CSI 38:2:-1:1:2:3m', 'CSI 2 q', 'OSC 0;hi', 'OSC 8;;u', 'ESC \\', 'DCS 1$q m', 'ESC \\', 'ESC (0', '^d']
    expect(trace(text)).toEqual(want)
    expect(trace(text, true)).toEqual(want)
  })

  it('carries on after what is cut off or wrong', () => {
    expect(trace('\x1b[12\x1b[3mx')).toEqual(['CSI 3m', 'x'])
    expect(trace('\x1b[1\x18x')).toEqual(['^18', 'x'])
    expect(trace('\x1b]0;lost\x18x')).toEqual(['^18', 'x'])
    expect(trace('\x1b[1?mx')).toEqual(['x'])
    expect(trace('\x1b[1\r2mx')).toEqual(['^d', 'CSI 12m', 'x'])
    expect(trace('\x1b_private\x1b\\x')).toEqual(['ESC \\', 'x'])
    expect(trace('\x9b1mx\x9d0;t\x9cy')).toEqual(['CSI 1m', 'x', 'OSC 0;t', 'y'])
    expect(trace(`\x1b[${'1;'.repeat(100)}mx`).at(-1)).toBe('x')
  })
})

describe('text', () => {
  it('decodes UTF-8 split anywhere, and marks what is not valid', () => {
    const s = make()
    for (const byte of new TextEncoder().encode('é你😀')) s.write(Uint8Array.of(byte))
    s.write(Uint8Array.of(0xff, 0xc3, 0x41, 0xe2, 0x82))
    s.write('z')
    expect(show(s)).toBe('é你😀��A�z')
  })

  it('gives characters their widths', () => {
    expect([...'aé你ｱ😀ﬁ─'].map((c) => charWidth(c.codePointAt(0)!))).toEqual([1, 1, 2, 1, 2, 1, 1])
    expect(charWidth(0x301)).toBe(0)
    expect(charWidth(0x200d)).toBe(0)
    expect(stringWidth('你éa')).toBe(4)
  })

  it('wraps at the last column, only once there is more', () => {
    const s = run('abcde', 5, 3)
    expect(s.buffer.x).toBe(5)
    expect(s.cursor).toEqual({ x: 4, y: 0 })
    s.write('f')
    expect(show(s)).toBe('abcde\nf')
    expect(s.buffer.lines.map((l) => l.wrapped)).toEqual([false, true, false])
    expect(show(run('abcd你', 5, 3))).toBe('abcd\n你')
    expect(show(run('\x1b[?7labcdefg', 5, 3))).toBe('abcdg')
  })

  it('keeps marks with their letters', () => {
    const s = run('éx')
    expect(s.buffer.row(0).char(0)).toBe('é')
    expect(s.buffer.x).toBe(2)
    // At the last column, before wrapping.
    expect(run('abcdé', 5).buffer.row(0).char(4)).toBe('é')
  })

  it('writing over half of a wide character clears the rest of it', () => {
    expect(run('你好\x1b[1;2Hx').buffer.row(0).text(true)).toBe(' x好')
    expect(run('你好\x1b[1;1Hx').buffer.row(0).text(true)).toBe('x 好')
  })

  it('draws lines with the DEC character set', () => {
    expect(show(run('\x1b(0lqk\x1b(Blqk'))).toBe('┌─┐lqk')
    expect(show(run('\x1b)0a\x0eq\x0fq'))).toBe('a─q')
  })

  it('repeats the character before', () => {
    expect(show(run('ab\x1b[3b'))).toBe('abbbb')
    expect(show(run('a\r\x1b[3b'))).toBe('a')
  })
})

describe('moving and erasing', () => {
  it('stays on the screen', () => {
    const s = run('\x1b[99;99H')
    expect([s.buffer.x, s.buffer.y]).toEqual([19, 4])
    s.write('\x1b[99A\x1b[99D')
    expect([s.buffer.x, s.buffer.y]).toEqual([0, 0])
  })

  it('scrolls within its region, and only there', () => {
    const s = run('1\r\n2\r\n3\r\n4\r\n5\x1b[2;4r\x1b[4;1H\n')
    expect(show(s)).toBe('1\n3\n4\n\n5')
    s.write('\x1b[2;1H\x1bM')
    expect(show(s)).toBe('1\n\n3\n4\n5')
    expect(s.buffer.base).toBe(0)
  })

  it('counts from the region in origin mode', () => {
    const s = run('\x1b[2;4r\x1b[?6h\x1b[1;1Hx\x1b[9;1Hy')
    expect(show(s)).toBe('\nx\n\ny')
  })

  it('inserts and deletes', () => {
    expect(show(run('abcdef\x1b[1;3H\x1b[2@'))).toBe('ab  cdef')
    expect(show(run('abcdef\x1b[1;3H\x1b[2P'))).toBe('abef')
    expect(show(run('abcdef\x1b[1;3H\x1b[2X'))).toBe('ab  ef')
    expect(show(run('1\r\n2\r\n3\x1b[2;1H\x1b[L'))).toBe('1\n\n2\n3')
    expect(show(run('1\r\n2\r\n3\x1b[2;1H\x1b[M'))).toBe('1\n3')
    expect(show(run('abc\x1b[1;1H\x1b[4hX'))).toBe('Xabc')
  })

  it('erases in the color of now, as full-screen programs expect', () => {
    const s = run('\x1b[44m\x1b[2J')
    expect(s.buffer.row(3).bg(5) & 0xff).toBe(4)
    expect(show(run('abcdef\x1b[1;3H\x1b[K'))).toBe('ab')
    expect(show(run('abcdef\x1b[1;3H\x1b[1K'))).toBe('   def')
    expect(show(run('a\r\nb\r\nc\x1b[2;1H\x1b[J'))).toBe('a')
    expect(show(run('a\r\nb\r\nc\x1b[2;1H\x1b[1J'))).toBe('\n\nc')
  })

  it('erases above the cursor in the last corner', () => {
    expect(show(run('a\x1b[5;20Hz\x1b[1J'))).toBe('')
  })

  it('keeps protected text', () => {
    expect(show(run('a\x1b[1"qb\x1b[0"qc\x1b[?2K'))).toBe(' b')
    expect(show(run('a\x1b[1"qb\x1b[0m\x1b[0"qc\x1b[2K'))).toBe('')
  })

  it('moves by tab stops', () => {
    expect(run('\t').buffer.x).toBe(8)
    expect(run('\x1b[3g\x1b[5G\x1bH\r\t').buffer.x).toBe(4)
    expect(run('\t\t\x1b[Z').buffer.x).toBe(8)
  })

  it('saves everything about the cursor', () => {
    const s = run('\x1b[31m\x1b(0\x1b[2;3H\x1b7\x1b[m\x1b(B\x1b[4;4H\x1b8q')
    expect(show(s)).toBe('\n  ─')
    expect(s.buffer.row(1).fg(2) & 0xff).toBe(1)
  })
})

describe('colors and styles', () => {
  const cell = (text: string) => {
    const s = run(`${text}x`)
    return { fg: s.buffer.row(0).fg(0), bg: s.buffer.row(0).bg(0), ext: s.buffer.row(0).ext(0) }
  }

  it('reads colors in every form', () => {
    expect(cell('\x1b[31m').fg).toBe(0x1000001)
    expect(cell('\x1b[95m').fg).toBe(0x100000d)
    expect(cell('\x1b[38;5;200m').fg).toBe(0x10000c8)
    expect(cell('\x1b[38;2;1;2;3m').fg).toBe(0x2010203)
    expect(cell('\x1b[38:2::1:2:3m').fg).toBe(0x2010203)
    expect(cell('\x1b[38:2:1:2:3m').fg).toBe(0x2010203)
    expect(cell('\x1b[48:5:9m').bg).toBe(0x1000009)
    expect(cell('\x1b[31;39m').fg).toBe(0)
    // What comes after a color still counts.
    expect(cell('\x1b[38;5;200;1m').fg).toBe(0x80000c8 | 0x1000000)
  })

  it('reads underlines and their colors', () => {
    expect(cell('\x1b[4:3;58;5;1m').ext).toEqual({ underline: 3, underlineColor: 0x1000001, link: undefined })
    expect(cell('\x1b[4:3m\x1b[4:0m').ext).toBeUndefined()
    expect(cell('\x1b[4m').ext).toBeUndefined()
    expect(cell('\x1b[4:3;1m\x1b[0m')).toEqual({ fg: 0, bg: 0, ext: undefined })
  })

  it('answers about colors, and takes new ones', () => {
    const s = make()
    const seen: ColorRequest[] = []
    s.onColor.listen((r) => seen.push(r))
    s.write('\x1b]10;?\x07\x1b]4;1;#ff0000;2;?\x07\x1b]11;rgb:ffff/8080/0000\x1b\\\x1b]104;1\x07\x1b]112\x07')
    expect(seen).toEqual([
      { slot: 'foreground', type: 'get' },
      { slot: 1, type: 'set', rgb: 0xff0000 },
      { slot: 2, type: 'get' },
      { slot: 'background', type: 'set', rgb: 0xff8000 },
      { slot: 1, type: 'reset' },
      { slot: 'cursor', type: 'reset' },
    ])
    let out = ''
    s.onData.listen((d) => (out += d))
    s.answerColor('foreground', 0x123456)
    s.answerColor(2, 0xff0000)
    expect(out).toBe('\x1b]10;rgb:1212/3434/5656\x1b\\\x1b]4;2;rgb:ffff/0000/0000\x1b\\')
    expect(parseColor('#abc')).toBe(0xa0b0c0)
    expect(parseColor('nonsense')).toBeUndefined()
  })
})

describe('the alternate screen', () => {
  it('leaves the normal one as it was', () => {
    const s = run('before\x1b[?1049h\x1b[Hin vim')
    expect(show(s)).toBe('in vim')
    s.write('\x1b[?1049l after')
    expect(show(s)).toBe('before after')
  })

  it('starts empty every time, with no scrollback', () => {
    const s = run('\x1b[?1049hone\x1b[?1049l\x1b[?1049h')
    expect(show(s)).toBe('')
    s.write('\n'.repeat(50))
    expect(s.buffer.base).toBe(0)
  })
})

describe('scrollback', () => {
  const full = () => {
    const s = make(10, 3, { scrollback: 5 })
    s.write(Array.from({ length: 20 }, (_, i) => `line ${i}`).join('\r\n'))
    return s
  }

  it('keeps as much as it should', () => {
    const s = full()
    expect(s.buffer.lines.length).toBe(8)
    expect(s.buffer.lines[0]!.text(true)).toBe('line 12')
    expect(s.buffer.dropped).toBe(12)
    expect(show(s)).toBe('line 17\nline 18\nline 19')
  })

  it('stays where it was scrolled to while output comes', () => {
    const s = full()
    s.scrollBy(-2)
    expect(show(s)).toBe('line 15\nline 16\nline 17')
    expect(s.cursor).toBeUndefined()
    s.write('\r\nline 20')
    expect(show(s)).toBe('line 15\nline 16\nline 17')
    s.scrollToBottom()
    s.write('\r\nline 21')
    expect(show(s)).toBe('line 19\nline 20\nline 21')
  })

  it('clears to the prompt', () => {
    const s = full()
    s.write('\r\n$ ')
    s.clear()
    expect(show(s)).toBe('$ ')
    expect(s.buffer.lines.length).toBe(3)
    const t = full()
    t.write('\x1b[3J')
    expect(t.buffer.lines.length).toBe(3)
  })
})

describe('answers', () => {
  it('says what it is and where the cursor is', () => {
    expect(replies('\x1b[c')).toBe('\x1b[?1;2c')
    expect(replies('\x1b[>c')).toBe('\x1b[>0;276;0c')
    expect(replies('\x1b[5n')).toBe('\x1b[0n')
    expect(replies('ab\r\nc\x1b[6n')).toBe('\x1b[2;2R')
    expect(replies('\x1b[18t')).toBe('\x1b[8;5;20t')
    expect(replies('\x1b[?2004$p\x1b[?2004h\x1b[?2004$p\x1b[?9999$p')).toBe('\x1b[?2004;2$y\x1b[?2004;1$y\x1b[?9999;0$y')
    expect(replies('\x1bP$qr\x1b\\')).toBe('\x1bP1$r1;5r\x1b\\')
    expect(replies('\x1bP$qzzz\x1b\\')).toBe('\x1bP0$r\x1b\\')
  })

  it('never answers with what a program chose', () => {
    // Titles and the like could otherwise type commands.
    expect(replies('\x1b]2;rm -rf\x07\x1b[21t\x1b[20t')).toBe('')
    expect(replies('\x1b]52;c;?\x07')).toBe('')
  })
})

describe('titles, places and links', () => {
  it('takes titles, and keeps a stack of them', () => {
    const s = run('\x1b]0;one\x07\x1b[22t\x1b]2;two\x1b\\')
    expect(s.title).toBe('two')
    s.write('\x1b[23t')
    expect(s.title).toBe('one')
  })

  it('takes the working directory', () => {
    expect(run('\x1b]7;file://host/a%20b/c\x07').cwd).toBe('/a b/c')
    expect(run('\x1b]633;P;Cwd=/x/y\x07').cwd).toBe('/x/y')
    expect(run('\x1b]7;nonsense\x07').cwd).toBeUndefined()
  })

  it('marks links', () => {
    const s = run('\x1b]8;id=a;https://x.test/\x1b\\link\x1b]8;;\x1b\\ plain')
    expect(s.buffer.row(0).ext(0)?.link).toEqual({ uri: 'https://x.test/', id: 'a' })
    expect(s.buffer.row(0).ext(3)?.link).toBe(s.buffer.row(0).ext(0)?.link)
    expect(s.buffer.row(0).ext(5)).toBeUndefined()
  })

  it('passes on what a program copies', () => {
    const s = make()
    const copied: string[] = []
    s.onClipboard.listen((t) => copied.push(t))
    s.write(`\x1b]52;c;${btoa('copied')}\x07\x1b]52;c;!!!\x07`)
    expect(copied).toEqual(['copied'])
  })
})

it('a reset puts everything back', () => {
  const s = run('text\x1b[31;4m\x1b[?1049h\x1b[?2004h\x1b[2;3r\x1bcx')
  expect(show(s)).toBe('x')
  expect(s.isAlternate).toBe(false)
  expect(s.modes.bracketedPaste).toBe(false)
  expect(s.buffer.row(0).fg(0)).toBe(0)
  expect([s.buffer.top, s.buffer.bottom]).toEqual([0, 4])
})

it('survives anything', () => {
  let seed = 3
  const random = (n: number) => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n)
  }
  const bits = ['\x1b', '[', ']', ';', ':', '?', '>', '1', '9', '99', 'm', 'H', 'J', 'K', 'r', 'h', 'l', 'A', 'L', 'M', 'P', '@', 'S', 'T', 'X', 'b', 'c', '\n', '\r', '\b', '\t', '\x07', '\x1b\\', 'P', '$', 'q', '你', '😀', '́', 'text', '\x9b', '\x84', '(0', '1049', '\x18']
  for (let round = 0; round < 150; round++) {
    const s = new Screen({ cols: 2 + random(20), rows: 1 + random(8), scrollback: random(20) })
    for (let i = 0; i < 300; i++) {
      s.write(bits[random(bits.length)]!)
      if (random(40) === 0) s.resize(2 + random(30), 1 + random(10))
      if (random(60) === 0) s.scrollBy(random(20) - 10)
      const b = s.buffer
      if (b.lines.length !== b.base + b.rows || b.y < 0 || b.y >= b.rows || b.x < 0 || b.x > b.cols) throw new Error(JSON.stringify([b.lines.length, b.base, b.rows, b.x, b.y]))
      if (b.lines.some((l) => l.cols !== b.cols) || s.viewTop < 0 || s.viewTop > b.base) throw new Error('lines')
    }
  }
})

it('is fast: a megabyte of colored output in well under a second', () => {
  const line = '\x1b[32muser\x1b[0m \x1b[1;34m~/project\x1b[0m some ordinary output that fills up a line of the terminal here\r\n'
  const data = new TextEncoder().encode(line.repeat(Math.ceil(1_000_000 / line.length)))
  const s = new Screen({ cols: 80, rows: 24 })
  const start = performance.now()
  for (let i = 0; i < data.length; i += 65_536) s.write(data.subarray(i, i + 65_536))
  expect(performance.now() - start).toBeLessThan(600)
})
