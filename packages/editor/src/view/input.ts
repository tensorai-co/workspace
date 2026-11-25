import * as cmd from '../core/commands.js'
import type { Command } from '../core/commands.js'
import type { EditorState } from '../core/state.js'

/** What the input needs from the view. */
export interface InputHost {
  readonly readOnly: boolean
  readonly state: EditorState
  /** Whether an input method is composing text now. */
  composing: boolean
  setFocused(focused: boolean): void
  /** The textarea lost the focus. */
  blurred(): void
  /** Keys the view's widgets and features take first. Returns whether one did. */
  handleKey(e: KeyboardEvent): boolean
  /** The command a key runs, from the keymap. */
  commandFor(e: KeyboardEvent): Command | undefined
  run(command: Command): boolean
}

/** Marks text copied as whole lines, so pasting it puts the lines above the cursor's. */
const LINES_MIME = 'application/x-ws-lines'

/**
 * Typing, input methods and the clipboard, through a hidden textarea: keys go to the view's features, then the
 * keymap; text goes in as commands, so nothing reaches the document without a transaction. Returns a function that
 * stops listening.
 */
export function bindInput(input: HTMLTextAreaElement, host: InputHost): () => void {
  input.addEventListener('focus', () => host.setFocused(true))
  input.addEventListener('blur', () => {
    host.setFocused(false)
    host.blurred()
  })
  const windowFocus = () => host.setFocused(document.activeElement === input)
  window.addEventListener('focus', windowFocus)
  input.addEventListener('keydown', (e) => {
    if (host.composing || e.isComposing || e.keyCode === 229) return
    if (host.handleKey(e)) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    const command = host.commandFor(e)
    if (!command) return
    e.preventDefault()
    if (!host.readOnly || !isEditCommand(command)) host.run(command)
  })
  input.addEventListener('beforeinput', (e) => {
    if (host.composing) return
    if (e.inputType === 'insertText' || e.inputType === 'insertReplacementText') {
      e.preventDefault()
      const text = e.data ?? e.dataTransfer?.getData('text/plain') ?? ''
      if (text && !host.readOnly) host.run(cmd.insertText(text))
    } else if (e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph') {
      e.preventDefault()
      if (!host.readOnly) host.run(cmd.insertNewline)
    } else if (e.inputType.startsWith('delete')) {
      // Deletions come through keydown; anything else (a context-menu delete) is handled here.
      e.preventDefault()
      if (!host.readOnly) host.run(e.inputType.includes('Forward') ? cmd.deleteForward : cmd.deleteBackward)
    }
  })
  input.addEventListener('compositionstart', () => {
    host.composing = true
  })
  input.addEventListener('compositionend', (e) => {
    host.composing = false
    input.value = ''
    if (e.data && !host.readOnly) host.run(cmd.insertText(e.data))
  })
  input.addEventListener('input', () => {
    // Anything that reached the textarea without beforeinput (some IMEs, autofill): take it and clear.
    if (host.composing || !input.value) return
    const text = input.value
    input.value = ''
    if (!host.readOnly) host.run(cmd.insertText(text))
  })
  const copy = (e: ClipboardEvent, cutting: boolean) => {
    e.preventDefault()
    const { text, lines } = cmd.copyText(host.state)
    e.clipboardData?.setData('text/plain', text)
    if (lines) e.clipboardData?.setData(LINES_MIME, '1')
    if (cutting && !host.readOnly) host.run(cmd.cut)
  }
  input.addEventListener('copy', (e) => copy(e, false))
  input.addEventListener('cut', (e) => copy(e, true))
  input.addEventListener('paste', (e) => {
    e.preventDefault()
    if (host.readOnly) return
    const text = e.clipboardData?.getData('text/plain') ?? ''
    const lines = e.clipboardData?.getData(LINES_MIME) === '1'
    if (text) host.run(cmd.paste(text, lines))
  })
  return () => window.removeEventListener('focus', windowFocus)
}

/** Commands that only move the cursor or select: the ones a read-only editor still runs. */
const MOVES = new Set<Command>([
  cmd.cursorLeft, cmd.cursorRight, cmd.cursorUp, cmd.cursorDown, cmd.cursorWordLeft, cmd.cursorWordRight, cmd.cursorLineStart, cmd.cursorLineEnd,
  cmd.cursorDocStart, cmd.cursorDocEnd, cmd.cursorPageUp, cmd.cursorPageDown, cmd.selectLeft, cmd.selectRight, cmd.selectUp, cmd.selectDown,
  cmd.selectWordLeft, cmd.selectWordRight, cmd.selectLineStart, cmd.selectLineEnd, cmd.selectDocStart, cmd.selectDocEnd, cmd.selectPageUp,
  cmd.selectPageDown, cmd.selectAll, cmd.selectLine, cmd.collapseSelections, cmd.selectNextOccurrence, cmd.selectAllOccurrences,
])

function isEditCommand(command: Command): boolean {
  return !MOVES.has(command)
}
