import { MemoryClipboard, ScriptedTerminalHost } from '@tensorai-workspace/testing'
import { act, cleanup, fireEvent, render, screen as dom, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Screen, Terminal, TerminalPanel, Terminals, TerminalView } from '../src/index.js'

const decoder = new TextDecoder()
beforeEach(() => {
  // No layout here: 600×200 of room, and cells 7×14 wherever the view looks.
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(200)
  vi.stubGlobal('requestAnimationFrame', (run: () => void) => setTimeout(run) as unknown as number)
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
  HTMLCanvasElement.prototype.getContext = () => null
})
afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
const frame = () => act(() => new Promise<void>((r) => setTimeout(r, 5)))

describe('the view', () => {
  const open = (text = '', config: Partial<ConstructorParameters<typeof TerminalView>[0]> = {}) => {
    const sent: string[] = []
    const screen = new Screen({ cols: 80, rows: 24 })
    const view = new TerminalView({ parent: document.body, screen, onInput: (data) => sent.push(decoder.decode(data)), ...config })
    if (text) screen.write(text)
    const input = document.querySelector<HTMLTextAreaElement>('.ws-term-input')!
    return { view, screen, sent, input, rows: () => [...document.querySelectorAll<HTMLElement>('.ws-term-row')] }
  }

  it('fits its room', () => {
    const onResize = vi.fn()
    const { screen, view } = open('', { onResize })
    // 600 less 30 is 81 cells of 7; 200 less 16 is 13 of 14.
    expect([screen.cols, screen.rows]).toEqual([81, 13])
    expect(onResize).toHaveBeenCalledWith(81, 13)
    view.destroy()
    expect(document.querySelector('.ws-terminal')).toBeNull()
  })

  it('draws rows, and only the ones that changed', async () => {
    const { screen, rows } = open('one\r\ntwo')
    await frame()
    expect(rows().map((r) => r.textContent).slice(0, 3)).toEqual(['one', 'two', ''])
    rows()[0]!.innerHTML = 'untouched'
    screen.write('!')
    await frame()
    expect(rows().map((r) => r.textContent).slice(0, 2)).toEqual(['untouched', 'two!'])
  })

  it('shows text as text, whatever is in it', async () => {
    const { rows } = open('<img src=x onerror=alert(1)> & \x1b]8;;javascript:alert(1)\x07link\x1b]8;;\x07')
    await frame()
    expect(rows()[0]!.textContent).toBe('<img src=x onerror=alert(1)> & link')
    expect(rows()[0]!.querySelector('img, a, script')).toBeNull()
  })

  it('draws colors and styles', async () => {
    const { rows } = open('\x1b[31mred\x1b[0m \x1b[1;32mbold\x1b[0m \x1b[7minv\x1b[0m \x1b[4:3;9mcurly\x1b[0m \x1b[44mbg\x1b[0m')
    await frame()
    const style = (text: string) => [...rows()[0]!.querySelectorAll('span')].find((s) => s.textContent === text)!.getAttribute('style')!
    expect(style('red')).toContain('color:#cd3131')
    // Bold is bright, and darkened until it's readable.
    expect(style('bold')).toContain('font-weight:bold')
    expect(style('inv')).toContain('background:#3b3b3b')
    expect(style('curly')).toContain('underline wavy line-through')
    expect(style('bg')).toContain('background:#0451a5')
  })

  it('gives wide and drawn characters their own cells', async () => {
    const { rows } = open('a你──b')
    await frame()
    expect([...rows()[0]!.querySelectorAll<HTMLElement>('.ws-term-cells')].map((c) => [c.textContent, c.style.width])).toEqual([
      ['你', '14px'],
      ['──', '14px'],
    ])
  })

  it('sends what is typed', async () => {
    const { view, sent, input, screen } = open()
    view.focus()
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'c', code: 'KeyC', ctrlKey: true })
    fireEvent.input(input, { target: { value: 'ab\n' } })
    expect(input.value).toBe('')
    expect(sent).toEqual(['\x1b[A', '\x03', 'ab\r'])
    screen.write('\x1b[?2004h')
    view.paste('x\ny')
    expect(sent.at(-1)).toBe('\x1b[200~x\ry\x1b[201~')
    // And answers programs.
    screen.write('\x1b[5n')
    expect(sent.at(-1)).toBe('\x1b[0n')
  })

  it('waits for an input method to finish', () => {
    const { sent, input } = open()
    fireEvent.compositionStart(input)
    fireEvent.compositionUpdate(input, { data: 'に' })
    fireEvent.input(input, { target: { value: 'に' } })
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    expect(sent).toEqual([])
    expect(document.querySelector('.ws-term-composition')!.textContent).toBe('に')
    fireEvent.compositionEnd(input, { data: '日本' })
    expect(sent).toEqual(['日本'])
  })

  it('shows the cursor, hollow without the focus', async () => {
    const { view, screen } = open('ab\x1b[D')
    const cursor = document.querySelector<HTMLElement>('.ws-term-cursor')!
    await frame()
    expect(cursor.className).toContain('ws-outline')
    view.focus()
    await frame()
    expect(cursor.className).toContain('ws-block')
    expect(cursor.textContent).toBe('b')
    screen.write('\x1b[5 q')
    await frame()
    expect(cursor.className).toContain('ws-bar')
    expect(cursor.className).toContain('ws-cursor-blink')
    screen.write('\x1b[?25l')
    await frame()
    expect(cursor.style.display).toBe('none')
  })

  it('selects with the mouse and copies', async () => {
    const clipboard = new MemoryClipboard()
    const { view, rows } = open('hello world', { clipboard })
    const terminal = document.querySelector('.ws-terminal')!
    fireEvent.mouseDown(terminal, { button: 0, clientX: 0, clientY: 5, detail: 1 })
    fireEvent.mouseMove(document, { clientX: 35, clientY: 5 })
    fireEvent.mouseUp(document, { clientX: 35, clientY: 5 })
    await frame()
    expect(view.selection.text).toBe('hello')
    expect(rows()[0]!.querySelector('span')!.textContent).toBe('hello')
    expect(view.copy()).toBe(true)
    await frame()
    expect(clipboard.text).toBe('hello')
    fireEvent.mouseDown(terminal, { button: 0, clientX: 50, clientY: 5, detail: 2 })
    fireEvent.mouseUp(document)
    expect(view.selection.text).toBe('world')
    view.type('x')
    expect(view.selection.isEmpty).toBe(true)
  })

  it('gives programs the mouse when they ask', () => {
    const { screen, sent } = open()
    screen.write('\x1b[?1000h\x1b[?1006h')
    const terminal = document.querySelector('.ws-terminal')!
    fireEvent.mouseDown(terminal, { button: 0, clientX: 10, clientY: 20 })
    fireEvent.mouseUp(document, { button: 0, clientX: 10, clientY: 20 })
    fireEvent.wheel(terminal, { deltaY: 14, clientX: 10, clientY: 20 })
    expect(sent).toEqual(['\x1b[<0;2;2M', '\x1b[<0;2;2m', '\x1b[<65;2;2M'])
  })

  it('scrolls back with the wheel, and sends arrows in full-screen programs', async () => {
    const { screen, sent } = open(Array.from({ length: 50 }, (_, i) => `line ${i}`).join('\r\n'))
    const terminal = document.querySelector('.ws-terminal')!
    fireEvent.wheel(terminal, { deltaY: -28 })
    expect(screen.viewTop).toBe(screen.buffer.base - 2)
    screen.write('\x1b[?1049h')
    fireEvent.wheel(terminal, { deltaY: 28 })
    expect(sent).toEqual(['\x1b[B\x1b[B'])
  })

  it('opens links with the modifier, and nothing else by itself', () => {
    const openWindow = vi.spyOn(window, 'open').mockReturnValue(null)
    const { view } = open('https://x.test/a and \x1b]8;;file:///etc/passwd\x07file\x1b]8;;\x07')
    // No layout: every cell the view asks about is under the pointer.
    const terminal = document.querySelector('.ws-terminal')!
    vi.spyOn(document.querySelector('.ws-term-grid')!, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 567, 182))
    const mod = /Mac/.test(navigator.platform) ? { metaKey: true } : { ctrlKey: true }
    fireEvent.mouseMove(terminal, { clientX: 20, clientY: 5, ...mod })
    expect(terminal.className).toContain('ws-link')
    fireEvent.mouseDown(terminal, { button: 0, clientX: 20, clientY: 5, ...mod })
    expect(openWindow).toHaveBeenCalledWith('https://x.test/a', '_blank', 'noopener,noreferrer')
    fireEvent.mouseMove(terminal, { clientX: 7 * 22, clientY: 5, ...mod })
    fireEvent.mouseDown(terminal, { button: 0, clientX: 7 * 22, clientY: 5, ...mod })
    expect(openWindow).toHaveBeenCalledTimes(1)
    view.destroy()
  })

  it('holds a frame a program is drawing', async () => {
    const { screen, rows } = open('before')
    await frame()
    screen.write('\x1b[?2026h\rAFTER!')
    await frame()
    expect(rows()[0]!.textContent).toBe('before')
    screen.write('\x1b[?2026l')
    await frame()
    expect(rows()[0]!.textContent).toBe('AFTER!')
  })
})

describe('Terminal', () => {
  it('opens a session at its size, shows it and ends it', async () => {
    const host = new ScriptedTerminalHost({ output: 'ready\r\n' })
    const { unmount } = render(<Terminal host={host} cwd="/x" />)
    await frame()
    const session = host.sessions[0]!
    expect(session.sizes).toEqual([[81, 13]])
    expect(session.cwd).toBe('/x')
    await waitFor(() => expect(document.querySelector('.ws-term-row')!.textContent).toBe('ready'))
    fireEvent.input(dom.getByLabelText('Terminal'), { target: { value: 'hi' } })
    expect(session.input).toBe('hi')
    unmount()
    expect(session.closed).toBe(true)
  })

  it('leaves nothing running twice', async () => {
    const host = new ScriptedTerminalHost()
    render(
      <StrictMode>
        <Terminal host={host} />
      </StrictMode>,
    )
    await frame()
    expect(host.sessions.filter((s) => !s.closed)).toHaveLength(1)
  })
})

describe('TerminalPanel', () => {
  const open = async (options = {}) => {
    const host = new ScriptedTerminalHost({ name: 'bash', ...options })
    const terminals = new Terminals(host)
    const onEmpty = vi.fn()
    render(
      <StrictMode>
        <TerminalPanel terminals={terminals} onEmpty={onEmpty} />
      </StrictMode>,
    )
    await frame()
    return { host, terminals, onEmpty }
  }

  it('starts with one terminal, and lists them when there are more', async () => {
    const { host, terminals } = await open()
    expect(host.sessions).toHaveLength(1)
    expect(dom.queryByRole('tablist')).toBeNull()
    expect(dom.getByRole('button', { name: 'bash' })).toBeTruthy()
    fireEvent.click(dom.getByLabelText(/New Terminal/))
    await frame()
    expect(host.sessions).toHaveLength(2)
    expect(dom.getAllByRole('tab').map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true'])
    expect(document.activeElement?.tagName).toBe('TEXTAREA')
    fireEvent.click(dom.getAllByRole('tab')[0]!)
    expect(terminals.active).toBe(terminals.list[0])
    fireEvent.keyDown(dom.getAllByRole('tab')[0]!, { key: 'ArrowDown' })
    expect(terminals.active).toBe(terminals.list[1])
  })

  it('follows titles', async () => {
    const { host } = await open()
    host.sessions[0]!.print('\x1b]0;vim\x07')
    await waitFor(() => expect(dom.getByRole('button', { name: 'vim' })).toBeTruthy())
  })

  it('ends the process when a terminal is killed', async () => {
    const { host, onEmpty } = await open()
    fireEvent.click(dom.getByLabelText('Kill Terminal'))
    expect(host.sessions[0]!.closed).toBe(true)
    expect(onEmpty).toHaveBeenCalledTimes(1)
  })

  it('goes with a process that ended well, and shows one that did not', async () => {
    const { host, terminals } = await open()
    act(() => void terminals.create())
    await frame()
    act(() => host.sessions[1]!.exit(0))
    await waitFor(() => expect(terminals.list).toHaveLength(1))
    act(() => void terminals.create())
    await frame()
    act(() => host.sessions[2]!.exit(2))
    await waitFor(() => expect(dom.getByRole('tab', { name: 'bash, exited' })).toBeTruthy())
    expect(terminals.active!.screen.view.map((l) => l.text(true)).join('\n')).toContain('exited with code 2')
    // Any key closes it.
    fireEvent.keyDown(document.activeElement!, { key: 'x' })
    expect(terminals.list).toHaveLength(1)
  })

  it('keeps a terminal as it was while another shows', async () => {
    const { host, terminals } = await open()
    host.sessions[0]!.print('first')
    act(() => void terminals.create())
    await frame()
    host.sessions[0]!.print(' and more')
    await waitFor(() => expect(terminals.list[0]!.screen.view[0]!.text(true)).toBe('first and more'))
    expect([...document.querySelectorAll<HTMLElement>('.ws-terminal-slot')].map((s) => s.hidden)).toEqual([true, false])
  })

  it('says when there was nothing to open', async () => {
    const terminals = new Terminals({
      open() {
        throw new Error('No shell here')
      },
    })
    render(<TerminalPanel terminals={terminals} />)
    await frame()
    expect(terminals.active!.status).toBe('exited')
    expect(terminals.active!.screen.view.map((l) => l.text(true)).join('\n')).toContain('No shell here')
  })
})
