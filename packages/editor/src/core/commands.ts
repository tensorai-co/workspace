import type { ChangeSpec } from '@tensorai-workspace/text'
import { EditorSelection, SelectionRange } from './selection.js'
import { EditorState, History, type TransactionSpec, type UserEvent } from './state.js'
import { columnAt, indentOf, indentString, indexAtColumn, nextGrapheme, prevGrapheme, wordLeft, wordRight } from './strings.js'

/** What a command may need from the view: the token type at a position, and how many lines a page is. */
export interface CommandEnv {
  /** The token type at pos ("string", "comment", …), when the language is tokenized there. */
  tokenTypeAt?(pos: number): string | undefined
  pageLines?: number
  /**
   * Moves up or down by rows as they're drawn, when the view wraps lines or folds them: `rows` rows from `pos`, to the
   * goal column. Without it, moves go by document lines.
   */
  moveVertically?(pos: number, rows: number, goal: number | undefined): { pos: number; goal: number }
}

/** A command: a state in, a transaction out, or null when it doesn't apply. */
export type Command = (state: EditorState, env?: CommandEnv) => TransactionSpec | null

/**
 * Applies one edit per range and places each cursor relative to its own edit. The cursor function gets the start of
 * that range's edit in the new document.
 */
function editRanges(
  state: EditorState,
  userEvent: UserEvent,
  f: (range: SelectionRange) => { from: number; to: number; insert: string; cursorFrom: number; cursorTo?: number } | null,
): TransactionSpec | null {
  const edits: { from: number; to: number; insert: string; cursorFrom: number; cursorTo: number }[] = []
  for (const range of state.selection.ranges) {
    const e = f(range)
    if (e) edits.push({ ...e, cursorTo: e.cursorTo ?? e.cursorFrom })
  }
  if (!edits.length) return null
  // Positions after earlier edits shift by their size change.
  let delta = 0
  const ranges: SelectionRange[] = []
  for (const e of [...edits].sort((a, b) => a.from - b.from)) {
    const base = e.from + delta
    ranges.push(new SelectionRange(base + e.cursorFrom, base + e.cursorTo))
    delta += e.insert.length - (e.to - e.from)
  }
  return {
    changes: edits.map(({ from, to, insert }) => ({ from, to, insert })),
    selection: EditorSelection.create(ranges, state.selection.mainIndex),
    userEvent,
    scrollIntoView: true,
  }
}

// ------------------------------------------------------------------ typing

const OPENERS_IN_WORDS = /[\w$]/

/** Types text at every cursor, with auto-close, over-type and surround. */
export function insertText(text: string): Command {
  return (state, env) => {
    const rules = state.language.rules
    const single = [...text].length === 1
    return editRanges(state, 'input.type', (range) => {
      const line = state.doc.lineAt(range.head)
      const before = line.text.slice(0, range.from - line.from)
      const after = line.text.slice(range.to - line.from)
      if (single && !range.empty) {
        // Surround the selection.
        const pair = rules.surroundingPairs.find((p) => p.open === text)
        if (pair && state.doc.lineAt(range.from).number === state.doc.lineAt(range.to).number) {
          const inner = state.sliceDoc(range.from, range.to)
          return { from: range.from, to: range.to, insert: pair.open + inner + pair.close, cursorFrom: pair.open.length, cursorTo: pair.open.length + inner.length }
        }
      }
      if (single && range.empty) {
        // Over-type a closer that's already there.
        if (after[0] === text && rules.autoClosingPairs.some((p) => p.close === text)) return { from: range.head, to: range.head + 1, insert: text, cursorFrom: 1 }
        // Auto-close: the typed character completes an opener, and what follows allows closing.
        const typed = before + text
        const pair = rules.autoClosingPairs.filter((p) => typed.endsWith(p.open)).sort((a, b) => b.open.length - a.open.length)[0]
        const nextOk = after.length === 0 || rules.autoCloseBefore.includes(after[0]!)
        const tokenType = env?.tokenTypeAt?.(Math.max(line.from, range.head - 1))
        const allowed = !pair?.notIn?.some((kind) => tokenType === kind)
        const quote = pair && pair.open === pair.close
        const quoteOk = !quote || !OPENERS_IN_WORDS.test(before.slice(-1))
        if (pair && nextOk && allowed && quoteOk) return { from: range.head, to: range.head, insert: text + pair.close, cursorFrom: text.length }
        // JSX: typing > after <Tag closes the tag.
        if (text === '>' && (state.language.id === 'typescriptreact' || state.language.id === 'javascriptreact')) {
          const tag = /(?:^|[^\w\])$.])<([A-Za-z][\w.:-]*)(?:\s(?:[^<>"'{}]|"[^"]*"|'[^']*'|\{[^{}]*\})*)?$/.exec(before)
          if (tag && !before.endsWith('/') && tokenType !== 'string' && tokenType !== 'comment') {
            return { from: range.head, to: range.head, insert: `></${tag[1]}>`, cursorFrom: 1 }
          }
        }
      }
      return { from: range.from, to: range.to, insert: text, cursorFrom: text.length }
    })
  }
}

/** Enter: a new line indented by the language's rules (its onEnterRules and indentationRules). */
export const insertNewline: Command = (state) => {
  const rules = state.language.rules
  return editRanges(state, 'input.type', (range) => {
    const line = state.doc.lineAt(range.from)
    const endLine = state.doc.lineAt(range.to)
    let beforeText = line.text.slice(0, range.from - line.from)
    const afterText = endLine.text.slice(range.to - endLine.from)
    const prevLine = line.number > 1 ? state.doc.line(line.number - 1).text : ''
    const base = indentOf(line.text).slice(0, beforeText.length)
    let from = range.from
    // A line that's only auto-indentation is left empty.
    if (beforeText.trim() === '' && beforeText.length > 0) {
      from = line.from
      beforeText = ''
    }
    // The rules: an onEnterRule first; else the indentation rules; else brackets around the cursor.
    let action: 'none' | 'indent' | 'indentOutdent' | 'outdent' = 'none'
    let append = ''
    let removeText = 0
    const rule = rules.onEnter.find((r) => (!r.beforeText || r.beforeText.test(beforeText)) && (!r.afterText || r.afterText.test(afterText)) && (!r.previousLineText || r.previousLineText.test(prevLine)))
    if (rule) {
      action = rule.action.indent
      append = rule.action.appendText ?? ''
      removeText = rule.action.removeText ?? 0
    } else if (rules.increaseIndent?.test(beforeText)) {
      const closer = afterText.trimStart()[0]
      action = closer && rules.brackets.some((b) => b.close === closer) ? 'indentOutdent' : 'indent'
    } else if (rules.indentNextLine?.test(beforeText)) {
      action = 'indent'
    } else {
      // Between a bracket pair even without indentation rules: "{|}" → indent and outdent.
      const open = beforeText.trimEnd().slice(-1)
      const close = afterText.trimStart()[0]
      if (open && rules.brackets.some((b) => b.open.endsWith(open) && b.close === close)) action = 'indentOutdent'
    }
    // An indent is a "\t" in the appended text, and leading whitespace is then normalized to the
    // editor's indentation (spaces or tabs).
    if (action === 'indent') append = '\t' + append
    if (action === 'indentOutdent' && !append) append = '\t'
    let lead = base
    if (action === 'outdent') lead = base.slice(0, Math.max(0, base.length - state.indentUnit.length))
    if (removeText) lead = lead.slice(0, Math.max(0, lead.length - removeText))
    const first = '\n' + normalizeIndent(lead + append, state)
    const insert = action === 'indentOutdent' ? first + '\n' + normalizeIndent(base, state) : first
    return { from, to: range.to, insert, cursorFrom: first.length }
  })
}

/** Leading whitespace rewritten in the editor's indentation (tabs or spaces) normalizeIndentation. */
function normalizeIndent(text: string, state: EditorState): string {
  const lead = indentOf(text)
  return indentString(columnAt(lead, lead.length, state.tabSize), state.tabSize, state.insertSpaces) + text.slice(lead.length)
}

/** Tab: indent the selected lines, or insert spaces to the next tab stop. */
export const indentMore: Command = (state) => {
  const multiLine = state.selection.ranges.some((r) => state.doc.lineAt(r.from).number !== state.doc.lineAt(r.to).number)
  if (multiLine) return indentLines(state, 1)
  return editRanges(state, 'input.indent', (range) => {
    const line = state.doc.lineAt(range.from)
    if (!state.insertSpaces) return { from: range.from, to: range.to, insert: '\t', cursorFrom: 1 }
    const col = columnAt(line.text, range.from - line.from, state.tabSize)
    const n = state.tabSize - (col % state.tabSize)
    return { from: range.from, to: range.to, insert: ' '.repeat(n), cursorFrom: n }
  })
}

/** Cmd+]: indent every line the selection touches, wherever the cursor is. */
export const indentSelectedLines: Command = (state) => indentLines(state, 1)

/** Shift+Tab: outdent every line the selection touches. */
export const indentLess: Command = (state) => indentLines(state, -1)

function selectedLines(state: EditorState): number[] {
  const lines = new Set<number>()
  for (const r of state.selection.ranges) {
    const a = state.doc.lineAt(r.from).number
    let b = state.doc.lineAt(r.to).number
    // A selection ending at column 0 doesn't include that line.
    if (b > a && state.doc.line(b).from === r.to) b--
    for (let n = a; n <= b; n++) lines.add(n)
  }
  return [...lines].sort((x, y) => x - y)
}

function indentLines(state: EditorState, dir: 1 | -1): TransactionSpec | null {
  const changes: ChangeSpec[] = []
  for (const n of selectedLines(state)) {
    const line = state.doc.line(n)
    if (dir > 0) {
      if (line.text.trim() === '' && state.selection.ranges.some((r) => !r.empty)) continue
      changes.push({ from: line.from, insert: state.indentUnit })
    } else {
      const indent = indentOf(line.text)
      if (!indent) continue
      const col = columnAt(indent, indent.length, state.tabSize)
      const target = Math.max(0, (Math.ceil(col / state.tabSize) - 1) * state.tabSize)
      const keep = indexAtColumn(indent, target, state.tabSize)
      changes.push({ from: line.from + keep, to: line.from + indent.length })
    }
  }
  if (!changes.length) return null
  return { changes, userEvent: 'input.indent' }
}

// ------------------------------------------------------------------ deleting

/** Backspace: the selection, an auto-closed pair, indentation to the previous tab stop, or one character. */
export const deleteBackward: Command = (state) => {
  const rules = state.language.rules
  return editRanges(state, 'delete.backward', (range) => {
    if (!range.empty) return { from: range.from, to: range.to, insert: '', cursorFrom: 0 }
    const pos = range.head
    if (pos === 0) return null
    const line = state.doc.lineAt(pos)
    if (pos === line.from) return { from: pos - 1, to: pos, insert: '', cursorFrom: 0 }
    const before = line.text.slice(0, pos - line.from)
    const prev = before.slice(-1)
    const next = line.text[pos - line.from]
    if (rules.autoClosingPairs.some((p) => p.open === prev && p.close === next)) return { from: pos - 1, to: pos + 1, insert: '', cursorFrom: 0 }
    if (state.insertSpaces && /^ +$/.test(before)) {
      const target = Math.floor((before.length - 1) / state.tabSize) * state.tabSize
      return { from: line.from + target, to: pos, insert: '', cursorFrom: 0 }
    }
    const from = line.from + prevGrapheme(line.text, pos - line.from)
    return { from, to: pos, insert: '', cursorFrom: 0 }
  })
}

/** Delete: the selection, or one character forward. */
export const deleteForward: Command = (state) =>
  editRanges(state, 'delete.forward', (range) => {
    if (!range.empty) return { from: range.from, to: range.to, insert: '', cursorFrom: 0 }
    const pos = range.head
    if (pos >= state.doc.length) return null
    const line = state.doc.lineAt(pos)
    if (pos === line.to) return { from: pos, to: pos + 1, insert: '', cursorFrom: 0 }
    return { from: pos, to: line.from + nextGrapheme(line.text, pos - line.from), insert: '', cursorFrom: 0 }
  })

/** Alt+Backspace: back to the start of the word. */
export const deleteWordBackward: Command = (state) =>
  editRanges(state, 'delete.backward', (range) => {
    if (!range.empty) return { from: range.from, to: range.to, insert: '', cursorFrom: 0 }
    const line = state.doc.lineAt(range.head)
    if (range.head === line.from) return range.head > 0 ? { from: range.head - 1, to: range.head, insert: '', cursorFrom: 0 } : null
    return { from: line.from + wordLeft(line.text, range.head - line.from), to: range.head, insert: '', cursorFrom: 0 }
  })

/** Alt+Delete: forward to the end of the word. */
export const deleteWordForward: Command = (state) =>
  editRanges(state, 'delete.forward', (range) => {
    if (!range.empty) return { from: range.from, to: range.to, insert: '', cursorFrom: 0 }
    const line = state.doc.lineAt(range.head)
    if (range.head === line.to) return range.head < state.doc.length ? { from: range.head, to: range.head + 1, insert: '', cursorFrom: 0 } : null
    return { from: range.head, to: line.from + wordRight(line.text, range.head - line.from), insert: '', cursorFrom: 0 }
  })

/** Cmd+Backspace: back to the start of the line. */
export const deleteToLineStart: Command = (state) =>
  editRanges(state, 'delete.backward', (range) => {
    if (!range.empty) return { from: range.from, to: range.to, insert: '', cursorFrom: 0 }
    const line = state.doc.lineAt(range.head)
    if (range.head === line.from) return range.head > 0 ? { from: range.head - 1, to: range.head, insert: '', cursorFrom: 0 } : null
    return { from: line.from, to: range.head, insert: '', cursorFrom: 0 }
  })

/** Cmd+Shift+K: delete the selected lines. */
export const deleteLine: Command = (state) => {
  const lines = selectedLines(state)
  if (!lines.length) return null
  const changes: ChangeSpec[] = []
  for (const block of blocks(lines)) {
    const first = state.doc.line(block[0]!)
    const last = state.doc.line(block[block.length - 1]!)
    const from = last.number < state.doc.lines ? first.from : Math.max(0, first.from - 1)
    const to = last.number < state.doc.lines ? last.to + 1 : last.to
    changes.push({ from, to })
  }
  const tr = state.update({ changes })
  const ranges = state.selection.ranges.map((r) => {
    const pos = Math.min(tr.changes.mapPos(r.head), tr.newDoc.length)
    const line = tr.newDoc.lineAt(pos)
    const col = r.head - state.doc.lineAt(r.head).from
    return SelectionRange.cursor(Math.min(line.from + col, line.to))
  })
  return { changes, selection: EditorSelection.create(ranges), userEvent: 'delete.line', scrollIntoView: true }
}

function blocks(lines: number[]): number[][] {
  const out: number[][] = []
  for (const n of lines) {
    const last = out[out.length - 1]
    if (last && last[last.length - 1] === n - 1) last.push(n)
    else out.push([n])
  }
  return out
}

// ------------------------------------------------------------------ lines

/** Alt+Up / Alt+Down: move the selected lines. */
export function moveLines(dir: -1 | 1): Command {
  return (state) => {
    const groups = blocks(selectedLines(state))
    if (!groups.length) return null
    if (dir < 0 && groups[0]![0] === 1) return null
    if (dir > 0 && groups[groups.length - 1]!.at(-1) === state.doc.lines) return null
    const changes: ChangeSpec[] = []
    let shiftBy = 0
    for (const g of groups) {
      const first = state.doc.line(g[0]!)
      const last = state.doc.line(g[g.length - 1]!)
      const text = state.sliceDoc(first.from, last.to)
      if (dir < 0) {
        const above = state.doc.line(first.number - 1)
        changes.push({ from: above.from, to: last.to, insert: text + '\n' + above.text })
        shiftBy = -(above.text.length + 1)
      } else {
        const below = state.doc.line(last.number + 1)
        changes.push({ from: first.from, to: below.to, insert: below.text + '\n' + text })
        shiftBy = below.text.length + 1
      }
    }
    const ranges = state.selection.ranges.map((r) => new SelectionRange(r.anchor + shiftBy, r.head + shiftBy))
    return { changes, selection: EditorSelection.create(ranges, state.selection.mainIndex), userEvent: 'input.move', scrollIntoView: true }
  }
}

/** Shift+Alt+Up / Shift+Alt+Down: duplicate the selected lines. */
export function copyLines(dir: -1 | 1): Command {
  return (state) => {
    const groups = blocks(selectedLines(state))
    const changes: ChangeSpec[] = []
    let shift = 0
    for (const g of groups) {
      const first = state.doc.line(g[0]!)
      const last = state.doc.line(g[g.length - 1]!)
      const text = state.sliceDoc(first.from, last.to)
      changes.push({ from: last.to, insert: '\n' + text })
      if (dir > 0) shift = text.length + 1
    }
    const ranges = state.selection.ranges.map((r) => new SelectionRange(r.anchor + shift, r.head + shift))
    return { changes, selection: EditorSelection.create(ranges, state.selection.mainIndex), userEvent: 'input.type', scrollIntoView: true }
  }
}

/** Cmd+Enter / Cmd+Shift+Enter: a new line below or above, keeping the current line's indentation. */
export function insertBlankLine(dir: -1 | 1): Command {
  return (state) =>
    editRanges(state, 'input.type', (range) => {
      const line = state.doc.lineAt(range.head)
      const indent = indentOf(line.text)
      if (dir > 0) return { from: line.to, to: line.to, insert: '\n' + indent, cursorFrom: 1 + indent.length }
      return { from: line.from, to: line.from, insert: indent + '\n', cursorFrom: indent.length }
    })
}

/** Cmd+/: toggle line comments on the selected lines. */
export const toggleLineComment: Command = (state) => {
  const rules = state.language.rules
  const token = rules.lineComment
  if (!token) return toggleBlockComment(state)
  const lines = selectedLines(state).map((n) => state.doc.line(n))
  const nonEmpty = lines.filter((l) => l.text.trim() !== '')
  if (!nonEmpty.length) return null
  const commented = nonEmpty.every((l) => l.text.trimStart().startsWith(token))
  const changes: ChangeSpec[] = []
  if (commented) {
    for (const l of nonEmpty) {
      const at = l.from + indentOf(l.text).length
      const after = l.text.slice(at - l.from + token.length)
      changes.push({ from: at, to: at + token.length + (after.startsWith(' ') ? 1 : 0) })
    }
  } else {
    const minIndent = Math.min(...nonEmpty.map((l) => indentOf(l.text).length))
    for (const l of nonEmpty) changes.push({ from: l.from + minIndent, insert: token + ' ' })
  }
  return { changes, userEvent: 'input.comment' }
}

/** Shift+Alt+A: wrap the selection in a block comment, or unwrap it. */
export const toggleBlockComment: Command = (state) => {
  const block = state.language.rules.blockComment
  if (!block) return null
  return editRanges(state, 'input.comment', (range) => {
    const text = state.sliceDoc(range.from, range.to)
    if (text.startsWith(block.open) && text.endsWith(block.close) && text.length >= block.open.length + block.close.length) {
      const inner = text.slice(block.open.length, text.length - block.close.length).replace(/^ /, '').replace(/ $/, '')
      return { from: range.from, to: range.to, insert: inner, cursorFrom: 0, cursorTo: inner.length }
    }
    const insert = `${block.open} ${text} ${block.close}`
    return { from: range.from, to: range.to, insert, cursorFrom: block.open.length + 1, cursorTo: block.open.length + 1 + text.length }
  })
}

// ------------------------------------------------------------------ moving the cursor

type Mover = (state: EditorState, range: SelectionRange, env?: CommandEnv) => { pos: number; goal?: number }

function moveCommand(mover: Mover, extend: boolean, collapse?: 'start' | 'end'): Command {
  return (state, env) => {
    const ranges = state.selection.ranges.map((r) => {
      if (!extend && !r.empty && collapse) return SelectionRange.cursor(collapse === 'start' ? r.from : r.to)
      const { pos, goal } = mover(state, r, env)
      return extend ? new SelectionRange(r.anchor, pos, goal) : SelectionRange.cursor(pos, goal)
    })
    return { selection: EditorSelection.create(ranges, state.selection.mainIndex), userEvent: extend ? 'select' : 'move', scrollIntoView: true }
  }
}

const charLeft: Mover = (state, r) => {
  const line = state.doc.lineAt(r.head)
  return { pos: r.head === line.from ? Math.max(0, r.head - 1) : line.from + prevGrapheme(line.text, r.head - line.from) }
}
const charRight: Mover = (state, r) => {
  const line = state.doc.lineAt(r.head)
  return { pos: r.head === line.to ? Math.min(state.doc.length, r.head + 1) : line.from + nextGrapheme(line.text, r.head - line.from) }
}
const wordLeftMover: Mover = (state, r) => {
  const line = state.doc.lineAt(r.head)
  return { pos: r.head === line.from ? Math.max(0, r.head - 1) : line.from + wordLeft(line.text, r.head - line.from) }
}
const wordRightMover: Mover = (state, r) => {
  const line = state.doc.lineAt(r.head)
  return { pos: r.head === line.to ? Math.min(state.doc.length, r.head + 1) : line.from + wordRight(line.text, r.head - line.from) }
}
function vertical(lines: (env?: CommandEnv) => number): Mover {
  return (state, r, env) => {
    if (env?.moveVertically) return env.moveVertically(r.head, lines(env), r.goalColumn)
    const line = state.doc.lineAt(r.head)
    const goal = r.goalColumn ?? columnAt(line.text, r.head - line.from, state.tabSize)
    const target = line.number + lines(env)
    if (target < 1) return { pos: 0, goal }
    if (target > state.doc.lines) return { pos: state.doc.length, goal }
    const next = state.doc.line(target)
    return { pos: next.from + indexAtColumn(next.text, goal, state.tabSize), goal }
  }
}
/** Home: the first non-blank character, or the line start if already there. */
const lineStart: Mover = (state, r) => {
  const line = state.doc.lineAt(r.head)
  const first = line.from + indentOf(line.text).length
  return { pos: r.head === first ? line.from : first }
}
const lineEnd: Mover = (state, r) => ({ pos: state.doc.lineAt(r.head).to })
const docStart: Mover = () => ({ pos: 0 })
const docEnd: Mover = (state) => ({ pos: state.doc.length })

export const cursorLeft = moveCommand(charLeft, false, 'start')
export const cursorRight = moveCommand(charRight, false, 'end')
export const cursorUp = moveCommand(vertical(() => -1), false)
export const cursorDown = moveCommand(vertical(() => 1), false)
export const cursorWordLeft = moveCommand(wordLeftMover, false)
export const cursorWordRight = moveCommand(wordRightMover, false)
export const cursorLineStart = moveCommand(lineStart, false)
export const cursorLineEnd = moveCommand(lineEnd, false)
export const cursorDocStart = moveCommand(docStart, false)
export const cursorDocEnd = moveCommand(docEnd, false)
export const cursorPageUp = moveCommand(vertical((env) => -(env?.pageLines ?? 20)), false)
export const cursorPageDown = moveCommand(vertical((env) => env?.pageLines ?? 20), false)
export const selectLeft = moveCommand(charLeft, true)
export const selectRight = moveCommand(charRight, true)
export const selectUp = moveCommand(vertical(() => -1), true)
export const selectDown = moveCommand(vertical(() => 1), true)
export const selectWordLeft = moveCommand(wordLeftMover, true)
export const selectWordRight = moveCommand(wordRightMover, true)
export const selectLineStart = moveCommand(lineStart, true)
export const selectLineEnd = moveCommand(lineEnd, true)
export const selectDocStart = moveCommand(docStart, true)
export const selectDocEnd = moveCommand(docEnd, true)
export const selectPageUp = moveCommand(vertical((env) => -(env?.pageLines ?? 20)), true)
export const selectPageDown = moveCommand(vertical((env) => env?.pageLines ?? 20), true)

export const selectAll: Command = (state) => ({ selection: EditorSelection.single(0, state.doc.length), userEvent: 'select' })

/** Cmd+L: select the whole line; again, and the next line too. */
export const selectLine: Command = (state) => {
  const startOfNext = (n: number) => (n < state.doc.lines ? state.doc.line(n + 1).from : state.doc.length)
  const ranges = state.selection.ranges.map((r) => {
    const a = state.doc.lineAt(r.from)
    const lastLine = state.doc.lineAt(r.empty ? r.to : Math.max(r.from, r.to - 1))
    const wholeLines = !r.empty && r.from === a.from && r.to === startOfNext(lastLine.number)
    return new SelectionRange(a.from, startOfNext(wholeLines ? Math.min(state.doc.lines, lastLine.number + 1) : lastLine.number))
  })
  return { selection: EditorSelection.create(ranges, state.selection.mainIndex), userEvent: 'select', scrollIntoView: true }
}

/** Escape: back to one cursor. */
export const collapseSelections: Command = (state) => {
  if (state.selection.ranges.length === 1 && state.selection.main.empty) return null
  if (state.selection.ranges.length > 1) return { selection: state.selection.asSingle(), userEvent: 'select' }
  return { selection: EditorSelection.single(state.selection.main.head), userEvent: 'select' }
}

// ------------------------------------------------------------------ multiple cursors

/** Alt+Cmd+Up / Alt+Cmd+Down: a new cursor on the line above or below, at the same column. */
export function addCursorVertical(dir: -1 | 1): Command {
  return (state) => {
    const edge = dir < 0 ? state.selection.ranges[0]! : state.selection.ranges[state.selection.ranges.length - 1]!
    const line = state.doc.lineAt(edge.head)
    const target = line.number + dir
    if (target < 1 || target > state.doc.lines) return null
    const goal = edge.goalColumn ?? columnAt(line.text, edge.head - line.from, state.tabSize)
    const next = state.doc.line(target)
    const pos = next.from + indexAtColumn(next.text, goal, state.tabSize)
    return { selection: state.selection.add(SelectionRange.cursor(pos, goal)), userEvent: 'select', scrollIntoView: true }
  }
}

/** Cmd+D: select the word at the cursor, then each next occurrence of the selection. */
export const selectNextOccurrence: Command = (state) => {
  const main = state.selection.main
  if (main.empty) {
    const word = state.wordAt(main.head)
    if (!word) return null
    return { selection: EditorSelection.create(state.selection.ranges.map((r) => (r === main ? new SelectionRange(word.from, word.to) : r)), state.selection.mainIndex), userEvent: 'select', scrollIntoView: true }
  }
  const query = state.sliceDoc(main.from, main.to)
  const text = state.doc.toString()
  const last = state.selection.ranges.reduce((m, r) => Math.max(m, r.to), 0)
  let at = text.indexOf(query, last)
  while (at >= 0 && state.selection.ranges.some((r) => r.from === at)) at = text.indexOf(query, at + 1)
  if (at < 0) {
    at = text.indexOf(query)
    while (at >= 0 && state.selection.ranges.some((r) => r.from === at)) at = text.indexOf(query, at + 1)
  }
  if (at < 0) return null
  return { selection: state.selection.add(new SelectionRange(at, at + query.length)), userEvent: 'select', scrollIntoView: true }
}

/** Cmd+Shift+L: select every occurrence of the selection (or the word at the cursor). */
export const selectAllOccurrences: Command = (state) => {
  const main = state.selection.main
  const word = main.empty ? state.wordAt(main.head) : { from: main.from, to: main.to, text: state.sliceDoc(main.from, main.to) }
  if (!word || !word.text) return null
  const text = state.doc.toString()
  const ranges: SelectionRange[] = []
  for (let at = text.indexOf(word.text); at >= 0; at = text.indexOf(word.text, at + word.text.length)) ranges.push(new SelectionRange(at, at + word.text.length))
  const mainIndex = ranges.findIndex((r) => r.from === word.from)
  return { selection: EditorSelection.create(ranges, Math.max(0, mainIndex)), userEvent: 'select' }
}

// ------------------------------------------------------------------ history

export const undo: Command = (state) => {
  const entry = state.history.done[state.history.done.length - 1]
  if (!entry) return null
  return {
    changes: entry.changes.invert(entry.before),
    selection: entry.selectionBefore,
    userEvent: 'undo',
    addToHistory: false,
    history: new History(state.history.done.slice(0, -1), [...state.history.undone, entry]),
    scrollIntoView: true,
  }
}

export const redo: Command = (state) => {
  const entry = state.history.undone[state.history.undone.length - 1]
  if (!entry) return null
  return {
    changes: entry.changes,
    selection: entry.selectionAfter,
    userEvent: 'redo',
    addToHistory: false,
    history: new History([...state.history.done, { ...entry, time: -Infinity }], state.history.undone.slice(0, -1)),
    scrollIntoView: true,
  }
}

// ------------------------------------------------------------------ clipboard

/** The text to copy, and whether it's whole lines (the line, when nothing is selected). */
export function copyText(state: EditorState): { text: string; lines: boolean; parts: string[] } {
  const ranges = state.selection.ranges
  if (ranges.every((r) => r.empty)) {
    const parts = [...new Set(ranges.map((r) => state.doc.lineAt(r.head).number))].map((n) => state.doc.line(n).text + '\n')
    return { text: parts.join(''), lines: true, parts }
  }
  const parts = ranges.filter((r) => !r.empty).map((r) => state.sliceDoc(r.from, r.to))
  return { text: parts.join('\n'), lines: false, parts }
}

/** Cut: the selection, or the whole line when nothing is selected. */
export const cut: Command = (state) => {
  if (state.selection.ranges.every((r) => r.empty)) {
    const spec = deleteLine(state)
    return spec ? { ...spec, userEvent: 'delete.cut' } : null
  }
  return editRanges(state, 'delete.cut', (range) => (range.empty ? null : { from: range.from, to: range.to, insert: '', cursorFrom: 0 }))
}

/**
 * Paste. With as many lines as cursors, each cursor gets one line. Text copied as whole lines (with
 * nothing selected) goes in above the cursor's line.
 */
export function paste(text: string, copiedLines = false): Command {
  return (state) => {
    const normalized = text.replace(/\r\n?/g, '\n')
    const lines = normalized.split('\n')
    const ranges = state.selection.ranges
    const distribute = ranges.length > 1 && lines.length === ranges.length
    let i = 0
    return editRanges(state, 'input.paste', (range) => {
      const piece = distribute ? lines[i++]! : normalized
      if (copiedLines && range.empty && !distribute) {
        const line = state.doc.lineAt(range.head)
        return { from: line.from, to: line.from, insert: piece, cursorFrom: piece.length + (range.head - line.from) }
      }
      return { from: range.from, to: range.to, insert: piece, cursorFrom: piece.length }
    })
  }
}

/** Indentation for a new line at pos, without inserting it: used by features that need it (AI accept, snippets). */
export function indentFor(state: EditorState, pos: number): string {
  const line = state.doc.lineAt(pos)
  const base = indentOf(line.text)
  return state.language.rules.increaseIndent?.test(line.text.slice(0, pos - line.from)) ? base + state.indentUnit : base
}

export { indentString }
