// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Highlighted } from '../src/react.js'

afterEach(cleanup)

describe('Highlighted', () => {
  it('colors code by language id, once its grammar has loaded', async () => {
    const { container } = render(<pre className="ws-syntax"><Highlighted text={'const a = 1\nreturn a'} language="ts" /></pre>)
    await waitFor(() => expect(container.querySelector('.t-storage, .t-keyword')).not.toBeNull())
    expect(container.textContent).toBe('const a = 1\nreturn a')
  })

  it('finds the language from a path, and leaves unknown text plain', async () => {
    const { container } = render(<pre><Highlighted text="fn main() {}" path="src/main.rs" /></pre>)
    await waitFor(() => expect(container.querySelector('span')).not.toBeNull())
    const plain = render(<pre><Highlighted text="just words" path="notes.unknownext" /></pre>)
    expect(plain.container.querySelector('span')).toBeNull()
    expect(plain.container.textContent).toBe('just words')
  })
})
