import { MemoryClipboard, MemoryFileSystem } from '@tensorai-workspace/testing'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MarkdownPreview, type MarkdownPreviewProps, type MarkdownView } from '../src/index.js'

beforeEach(() => {
  let n = 0
  URL.createObjectURL = vi.fn(() => `blob:${++n}`)
  URL.revokeObjectURL = vi.fn()
})
afterEach(cleanup)

const element = (props: MarkdownPreviewProps) => (
  <StrictMode>
    <MarkdownPreview path="/work/a.md" root="/work" {...props} />
  </StrictMode>
)
const open = (props: MarkdownPreviewProps) => {
  const made = render(element(props))
  return { body: made.container.querySelector<HTMLElement>('.ws-markdown-body')!, rerender: (next: MarkdownPreviewProps) => made.rerender(element(next)) }
}

describe('MarkdownPreview', () => {
  it('draws Markdown, and follows it', async () => {
    const { body, rerender } = open({ text: '# One\n\ntwo **three**\n' })
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('One')
    const paragraph = body.querySelector('p')
    rerender({ text: '# One!\n\ntwo **three**\n' })
    await waitFor(() => expect(screen.getByRole('heading').textContent).toBe('One!'))
    // What didn't change is still the same element.
    expect(body.querySelector('p')).toBe(paragraph)
  })

  it('puts source lines on blocks', () => {
    const { body } = open({ text: '# a\n\n- b\n- c\n\n```\nd\n```\n' })
    expect([...body.querySelectorAll<HTMLElement>('[data-line]')].map((e) => `${e.tagName} ${e.dataset.line}`)).toEqual(['H1 1', 'UL 3', 'LI 3', 'LI 4', 'CODE 6', 'DIV 9'])
  })

  it('never makes anything that runs', () => {
    const { body } = open({ text: '<script>window.ran = 1</script>\n\n<img src=x onerror="window.ran = 1">\n\n[a](javascript:window.ran=1) <a href="javascript:window.ran=1" onclick="window.ran=1">b</a>\n\n<b style="color: red" class="c" id="root">c</b> <form action="/x"><input name="q"><button>d</button></form>' })
    expect(body.querySelectorAll('script, form, [onerror], [onclick], [style], .c, [id], a[href], input')).toHaveLength(0)
    fireEvent.click(screen.getByText('b'))
    expect('ran' in window).toBe(false)
  })

  it('opens links: to files and headings itself, to the web in a new tab', () => {
    const onOpen = vi.fn()
    open({ text: '[file](b.md#L3) [head](#two) [web](https://example.com) [out](../../x)\n\n## Two\n', onOpen })
    fireEvent.click(screen.getByText('file'))
    expect(onOpen).toHaveBeenCalledWith({ kind: 'file', path: '/work/b.md', line: 3 })
    fireEvent.keyDown(screen.getByText('file'), { key: 'Enter' })
    expect(onOpen).toHaveBeenCalledTimes(2)
    const web = screen.getByText('web')
    expect([web.getAttribute('href'), web.getAttribute('target'), web.getAttribute('rel')]).toEqual(['https://example.com/', '_blank', 'noopener noreferrer'])
    // Those that stay inside have no address, so no click can leave the page.
    expect(screen.getByText('file').hasAttribute('href')).toBe(false)
    expect(screen.getByText('out').getAttribute('role')).toBeNull()
    fireEvent.click(screen.getByText('out'))
    expect(onOpen).toHaveBeenCalledTimes(2)
  })

  it('hands web links over when asked to', () => {
    const onOpenWeb = vi.fn()
    open({ text: '<https://example.com/x>', onOpenWeb })
    expect(fireEvent.click(screen.getByRole('link'))).toBe(false)
    expect(onOpenWeb).toHaveBeenCalledWith('https://example.com/x')
  })

  it('reads images from the file system, and follows them', async () => {
    const fs = new MemoryFileSystem({ '/work/img/a.png': 'one' })
    const { body, rerender } = open({ text: '![An image](img/a.png)', fs })
    const src = () => body.querySelector('img')!.getAttribute('src')
    await waitFor(() => expect(src()).toMatch(/^blob:/))
    const first = src()
    await fs.write('/work/img/a.png', new TextEncoder().encode('two'))
    await waitFor(() => expect(src()).not.toBe(first))
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(first)
    rerender({ text: '![An image](img/missing.png)', fs })
    await waitFor(() => expect(src()).toBeNull())
    expect(screen.getByAltText('An image')).toBeTruthy()
  })

  it('reads no file that isn’t an image, or is out of the root', async () => {
    const fs = new MemoryFileSystem({ '/work/secret.txt': 'x', '/other/a.png': 'x' })
    const { body } = open({ text: '![a](secret.txt) ![b](../other/a.png)', fs })
    await new Promise((r) => setTimeout(r, 20))
    expect([...body.querySelectorAll('img')].map((i) => i.getAttribute('src'))).toEqual([null, null])
    expect(fs.calls.filter((c) => c.args[0]?.startsWith('/other'))).toEqual([])
  })

  it('loads images from the web, unless told not to', () => {
    const text = '![a](https://example.com/a.png) ![b](data:image/png;base64,AA)'
    const { body, rerender } = open({ text })
    const srcs = () => [...body.querySelectorAll('img')].map((i) => i.getAttribute('src'))
    expect(srcs()).toEqual(['https://example.com/a.png', 'data:image/png;base64,AA'])
    rerender({ text, remoteImages: false })
    expect(srcs()).toEqual([null, 'data:image/png;base64,AA'])
  })

  it('colors code as the editor does', async () => {
    const { body } = open({ text: '```ts\nconst a = "b" // (c)\n```\n\n```nope\nx\n```' })
    await waitFor(() => expect(body.querySelector('.t-storage')?.textContent).toBe('const'))
    expect(body.querySelector('.t-string')?.textContent).toContain('b')
    expect([...body.querySelectorAll('code')].map((c) => c.textContent)).toEqual(['const a = "b" // (c)', 'x'])
  })

  it('copies code', async () => {
    const clipboard = new MemoryClipboard()
    open({ text: '```\na\nb\n```', clipboard })
    const button = screen.getByRole('button', { name: 'Copy code block' })
    fireEvent.click(button)
    await waitFor(() => expect(button.className).toContain('ws-md-copied'))
    expect(await clipboard.readText()).toBe('a\nb\n')
  })

  it('marks the block the editor is in', () => {
    const { body, rerender } = open({ text: '# a\n\nb\n\n- c\n- d\n', activeLine: 4 })
    const marked = () => [...body.querySelectorAll('[data-active]')].map((e) => e.textContent)
    expect(marked()).toEqual(['b'])
    rerender({ text: '# a\n\nb\n\n- c\n- d\n', activeLine: 6 })
    expect(marked()).toEqual(['d'])
    rerender({ text: '# a\n\nb\n\n- c\n- d\n' })
    expect(marked()).toEqual([])
    expect(body.className).not.toContain('ws-md-marks')
  })

  it('gives a view, and takes it back', () => {
    const onView = vi.fn<(view: MarkdownView | null) => void>()
    open({ text: '# One\n\n## Two', onView })
    const view = onView.mock.calls.at(-1)![0]!
    expect(view.scrollToAnchor('TWO')).toBe(true)
    expect(view.scrollToAnchor('three')).toBe(false)
    cleanup()
    expect(onView).toHaveBeenLastCalledWith(null)
  })

  it('reports double clicks, though not on links', () => {
    const onDoubleClick = vi.fn()
    open({ text: 'a [b](c.md)', onDoubleClick })
    fireEvent.doubleClick(screen.getByText('b'))
    expect(onDoubleClick).not.toHaveBeenCalled()
    fireEvent.doubleClick(screen.getByText('a', { exact: false, selector: 'p' }))
    expect(onDoubleClick).toHaveBeenCalledTimes(1)
  })
})
