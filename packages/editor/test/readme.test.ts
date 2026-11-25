import { expect, it } from 'vitest'
import { EditorState, insertNewline } from '../src/core/index.js'

it('runs the README example', () => {
  let state = EditorState.create({ doc: 'function f() {}', language: 'tsx', selection: 14 })
  state = state.apply(insertNewline(state)!)
  expect(state.doc.toString()).toBe('function f() {\n    \n}')
})
