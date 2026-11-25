import { describe, expect, it } from 'vitest'
import { contrast, encodeKey, encodeMouse, encodePaste, glyph, isGlyph, linkAt, palette, readable, Screen, Selection, type MouseTracking, type TerminalKey } from '../src/core/index.js'

const key = (key: string, mods: Partial<TerminalKey> = {}, { mac = false, app = false, optionIsMeta = false } = {}) =>
  encodeKey({ key, code: /^[a-z]$/i.test(key) ? `Key${key.toUpperCase()}` : key, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, ...mods }, { applicationCursor: app }, { mac, optionIsMeta })
const ctrl = { ctrlKey: true }
const alt = { altKey: true }
const shift = { shiftKey: true }

describe('keys', () => {
  it('sends what terminals expect', () => {
    expect(key('Enter')).toBe('\r')
    expect(key('Backspace')).toBe('\x7f')
    expect(key('Tab')).toBe('\t')
    expect(key('Tab', shift)).toBe('\x1b[Z')
    expect(key('Escape')).toBe('\x1b')
    expect(key('ArrowUp')).toBe('\x1b[A')
    expect(key('ArrowUp', {}, { app: true })).toBe('\x1bOA')
    expect(key('ArrowRight', ctrl)).toBe('\x1b[1;5C')
    expect(key('Home', shift)).toBe('\x1b[1;2H')
    expect(key('Delete')).toBe('\x1b[3~')
    expect(key('PageDown', ctrl)).toBe('\x1b[6;5~')
    expect(key('F1')).toBe('\x1bOP')
    expect(key('F1', shift)).toBe('\x1b[1;2P')
    expect(key('F5')).toBe('\x1b[15~')
    expect(key('F12', ctrl)).toBe('\x1b[24;5~')
  })

  it('leaves text to the input', () => {
    expect(key('a')).toBeUndefined()
    expect(key('A', shift)).toBeUndefined()
    expect(key('é')).toBeUndefined()
    expect(key('c', { metaKey: true }, { mac: true })).toBeUndefined()
  })

  it('makes control characters', () => {
    expect(key('c', ctrl)).toBe('\x03')
    expect(key('Z', { ...ctrl, ...shift })).toBe('\x1a')
    expect(key(' ', ctrl)).toBe('\x00')
    expect(key('[', ctrl)).toBe('\x1b')
    expect(key('/', ctrl)).toBe('\x1f')
    expect(key('1', ctrl)).toBeUndefined()
  })

  it('makes Meta sequences with Alt, and leaves Option alone on a Mac', () => {
    expect(key('f', alt)).toBe('\x1bf')
    expect(key('ƒ', { ...alt, code: 'KeyF' }, { mac: true })).toBeUndefined()
    expect(key('ƒ', { ...alt, code: 'KeyF' }, { mac: true, optionIsMeta: true })).toBe('\x1bf')
    expect(key('Backspace', alt)).toBe('\x1b\x7f')
  })

  it('edits lines on a Mac', () => {
    const mac = { mac: true }
    expect(key('ArrowLeft', alt, mac)).toBe('\x1bb')
    expect(key('ArrowRight', alt, mac)).toBe('\x1bf')
    expect(key('ArrowLeft', { metaKey: true }, mac)).toBe('\x01')
    expect(key('ArrowRight', { metaKey: true }, mac)).toBe('\x05')
    expect(key('Backspace', { metaKey: true }, mac)).toBe('\x15')
    expect(key('Backspace', alt, mac)).toBe('\x17')
  })
})

describe('pasting', () => {
  it('sends line breaks as Return, marked when asked', () => {
    expect(encodePaste('a\r\nb\nc', { bracketedPaste: false })).toBe('a\rb\rc')
    expect(encodePaste('a\nb', { bracketedPaste: true })).toBe('\x1b[200~a\rb\x1b[201~')
  })

  it('cannot end the marking early', () => {
    expect(encodePaste('x\x1b[201~rm -rf\n', { bracketedPaste: true })).toBe('\x1b[200~x␛[201~rm -rf\r\x1b[201~')
  })
})

describe('the mouse', () => {
  const at = { x: 4, y: 2, px: 30, py: 33, shiftKey: false, altKey: false, ctrlKey: false }
  const send = (mouse: MouseTracking, action: 'press' | 'release' | 'move' | 'wheel', button: number, mouseEncoding: 'default' | 'sgr' | 'pixels' = 'sgr', more = {}) => encodeMouse({ ...at, action, button, ...more }, { mouse, mouseEncoding })

  it('reports what was asked for', () => {
    expect(send('none', 'press', 0)).toBeUndefined()
    expect(send('x10', 'press', 2)).toBe('\x1b[<2;5;3M')
    expect(send('x10', 'release', 0)).toBeUndefined()
    expect(send('press', 'press', 0)).toBe('\x1b[<0;5;3M')
    expect(send('press', 'release', 0)).toBe('\x1b[<0;5;3m')
    expect(send('press', 'move', 0)).toBeUndefined()
    expect(send('drag', 'move', 0)).toBe('\x1b[<32;5;3M')
    expect(send('drag', 'move', -1)).toBeUndefined()
    expect(send('any', 'move', -1)).toBe('\x1b[<35;5;3M')
    expect(send('press', 'wheel', 1)).toBe('\x1b[<65;5;3M')
    expect(send('press', 'press', 0, 'sgr', { ctrlKey: true, shiftKey: true })).toBe('\x1b[<20;5;3M')
  })

  it('in every encoding', () => {
    expect(send('press', 'press', 0, 'default')).toBe('\x1b[M %#')
    expect(send('press', 'release', 2, 'default')).toBe('\x1b[M#%#')
    expect(send('press', 'press', 0, 'pixels')).toBe('\x1b[<0;30;33M')
    expect(send('press', 'press', 0, 'default', { x: 300 })).toBeUndefined()
  })
})

const screen = (text: string, cols = 30, rows = 6, scrollback = 100) => {
  const s = new Screen({ cols, rows, scrollback })
  s.write(text)
  return s
}

describe('selection', () => {
  const at = (line: number, x: number) => ({ line, x })

  it('takes characters, both ways', () => {
    const s = new Selection(screen('hello world\r\nsecond line'))
    s.start(at(0, 6))
    s.extend(at(1, 6))
    expect(s.text).toBe('world\nsecond')
    s.extend(at(0, 0))
    expect(s.text).toBe('hello ')
    expect(s.cells(0)).toEqual({ from: 0, to: 6 })
    expect(s.cells(1)).toBeUndefined()
    s.clear()
    expect(s.isEmpty).toBe(true)
    expect(s.text).toBe('')
  })

  it('joins wrapped rows, and leaves out blanks at the end', () => {
    const s = new Selection(screen('abcdefghij\r\nx   ', 4))
    s.selectAll()
    expect(s.text).toBe('abcdefghij\nx   \n\n')
  })

  it('takes words and whole lines', () => {
    const s = new Selection(screen('run (foo-bar/baz.ts) now'))
    s.start(at(0, 7), 'word')
    expect(s.text).toBe('foo-bar/baz.ts')
    s.start(at(0, 4), 'word')
    expect(s.text).toBe('(')
    s.extend(at(0, 22))
    expect(s.text).toBe('(foo-bar/baz.ts) now')
    s.start(at(0, 7), 'line')
    expect(s.text).toBe('run (foo-bar/baz.ts) now')
    // A word that wrapped is still one.
    const wrapped = new Selection(screen('go abcdefgh', 5))
    wrapped.start(at(1, 1), 'word')
    expect(wrapped.text).toBe('abcdefgh')
  })

  it('takes blocks', () => {
    const s = new Selection(screen('abcd\r\nefgh\r\nijkl'))
    s.start(at(0, 1), 'block')
    s.extend(at(2, 3))
    expect(s.text).toBe('bc\nfg\njk')
  })

  it('holds on to its lines as output scrolls', () => {
    const it = screen('target\r\n', 30, 3, 10)
    const s = new Selection(it)
    s.start(at(0, 0))
    s.extend(at(0, 6))
    it.write('more\r\n'.repeat(8))
    expect(s.text).toBe('target')
    it.resize(20, 3)
    expect(s.isEmpty).toBe(true)
  })

  it('includes both halves of a wide character', () => {
    const s = new Selection(screen('a你b'))
    s.start(at(0, 1))
    s.extend(at(0, 3))
    expect(s.text).toBe('你')
  })
})

describe('links', () => {
  const uri = (text: string, x: number, y = 0, cols = 60) => linkAt(screen(text, cols), x, y)?.uri

  it('finds URLs, without what follows them in a sentence', () => {
    expect(uri('see https://x.test/a?b=c, ok', 10)).toBe('https://x.test/a?b=c')
    expect(uri('see https://x.test/a?b=c, ok', 1)).toBeUndefined()
    expect(uri('(https://x.test/w_(a))', 5)).toBe('https://x.test/w_(a)')
    expect(uri('"https://x.test/"', 5)).toBe('https://x.test/')
    expect(uri('javascript:alert(1)', 5)).toBeUndefined()
  })

  it('finds them over a wrap, with their cells', () => {
    const found = linkAt(screen('at https://example.test/path', 10), 2, 1)
    expect(found?.uri).toBe('https://example.test/path')
    expect(found?.cells).toEqual([
      { index: 0, from: 3, to: 10 },
      { index: 1, from: 0, to: 10 },
      { index: 2, from: 0, to: 8 },
    ])
  })

  it('finds the ones programs mark', () => {
    const found = linkAt(screen('\x1b]8;;https://x.test/\x07here\x1b]8;;\x07 not'), 2, 0)
    expect(found).toEqual({ uri: 'https://x.test/', marked: true, cells: [{ index: 0, from: 0, to: 4 }] })
  })
})

describe('colors', () => {
  it('have the palette everyone has', () => {
    const colors = palette(Array.from({ length: 16 }, (_, i) => i))
    expect(colors).toHaveLength(256)
    expect([colors[16], colors[21], colors[196], colors[231], colors[232], colors[255]]).toEqual([0, 0x0000ff, 0xff0000, 0xffffff, 0x080808, 0xeeeeee])
  })

  it('stay readable', () => {
    expect(readable(0x202020, 0xffffff)).toBe(0x202020)
    expect(contrast(readable(0xf5f543, 0xffffff), 0xffffff)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(readable(0x000080, 0x191a1b), 0x191a1b)).toBeGreaterThanOrEqual(4.5)
    // Where one way isn't enough, the other.
    expect(contrast(readable(0x777777, 0x808080), 0x808080)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('drawn characters', () => {
  it('has a shape for every one', () => {
    for (let code = 0x2500; code <= 0x259f; code++) {
      expect(isGlyph(code)).toBe(true)
      expect(glyph(code, 7, 14), code.toString(16)).toMatch(/d="M[^"]+"/)
      expect(glyph(code, 7, 14)).not.toContain('NaN')
    }
    expect(isGlyph(0x24ff)).toBe(false)
    expect(isGlyph(0x25a0)).toBe(false)
  })

  it('reaches the edges it should', () => {
    expect(glyph(0x2588, 7, 14)).toBe('<path d="M0 0H7V14H0Z"/>')
    expect(glyph(0x2584, 7, 14)).toBe('<path d="M0 7H7V14H0Z"/>')
    // A light cross: up, down, left and right to the middle.
    const cross = glyph(0x253c, 7, 14)
    for (const edge of ['M3 0', 'V14', 'M0 6.5', 'H7']) expect(cross).toContain(edge)
  })
})
