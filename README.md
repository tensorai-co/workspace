# workspace

**IDE components for TypeScript and React, built from the ground up with zero third-party runtime code: a code editor, a file explorer, a terminal and a Markdown preview, usable alone or as one IDE.**

Every piece is written here: the text engine, the tokenizer and its 234 grammars, the editor's state, commands, view and input, the Markdown parser, the virtualized tree and the terminal emulator. Icons, language rules and color themes are kept as plain data (see [NOTICE](NOTICE)).

---

## Install

It's one package, installed from GitHub, with an entry point for each part:

```sh
npm install github:tensorai-co/workspace          # the latest main
npm install github:tensorai-co/workspace#<commit>  # or pin a commit or tag
```

npm builds it as it installs (`prepare` runs `tsc`), so what's imported is JavaScript with type declarations, for any
bundler or Node. Each part's styles are their own `styles.css`; the whole IDE's include everything it shows.

## Packages

| Entry point | What it is |
|---|---|
| `@tensorai-co/workspace/text` | The document: a persistent B-tree of lines, change sets (apply, invert, compose, map positions) |
| `@tensorai-co/workspace/highlight` | Syntax highlighting: a line-by-line tokenizer and grammars for 234 languages, each loaded when first used |
| `@tensorai-co/workspace/languages` | Every language the editor knows: detection from file names, editing rules, and incremental tokenizing over `highlight`; `languages/react` has `Highlighted`, read-only code in the editor's colors |
| `@tensorai-co/workspace/editor` | The code editor: immutable state and transactions, undo history, commands, keymap, virtualized view, React component |
| `@tensorai-co/workspace/terminal` | A terminal emulator: parser, screen, input, DOM renderer, terminal tabs |
| `@tensorai-co/workspace/markdown-parser` | A Markdown parser: CommonMark and GitHub's tables, task lists, strikethrough and autolinks, to a syntax tree |
| `@tensorai-co/workspace/markdown` | The Markdown preview: follows its source as it changes and scrolls, with images and links from any file system |
| `@tensorai-co/workspace/tree` | A virtualized, keyboard-navigable tree with lazy children |
| `@tensorai-co/workspace/explorer` | The file explorer: new, rename, delete, open, over any file system |
| `@tensorai-co/workspace/tabs` | The tab bar: preview, unsaved, dragged and overflowing tabs |
| `@tensorai-co/workspace/split` | Resizable panes: sashes, snapping closed, saved sizes |
| `@tensorai-co/workspace/overlays` | What opens over the page: the hover, menus and dialogs |
| `@tensorai-co/workspace/host` | What a host app implements: `FileSystem`, `TerminalHost`, `Clipboard`, `Storage`, `InlineCompletionProvider` and `LanguageService` |
| `@tensorai-co/workspace/testing` | In-memory fakes of the host interfaces, `ScriptedCompletionProvider` and `ScriptedLanguageService` |
| `@tensorai-co/workspace/theme` | Light and dark color themes, fonts, sizes and shapes as CSS variables, and `Appearance` to change any of them |
| `@tensorai-co/workspace/icons` | Seti file icons and Codicons UI icons, with the name-to-icon rules; React components in `icons/react` |
| `@tensorai-co/workspace` | The whole IDE: titlebar, activity bar, sidebar, editor groups, panel, secondary side bar and status bar, with one registry of commands and keybindings |

React 19 is a peer dependency of the view parts. `host`, `text`, `highlight`, `languages`, `markdown-parser` and every `core` (`editor/core`, `tree/core`, `explorer/core`, `tabs/core`, `split/core`, `terminal/core`, `markdown/core`, `workspace/core`) use no DOM and no React.

---

## Using the whole IDE

```tsx
import '@tensorai-co/workspace/styles.css'
import { StatusItem, Workspace } from '@tensorai-co/workspace'

<Workspace
  fs={fileSystem}                     // FileSystem
  root="/project"                     // the folder the explorer shows
  terminals={shells}                  // TerminalHost; without one there's no panel
  completions={myModel}               // InlineCompletionProvider, optional: AI ghost text in every editor
  languages={myLanguageServer}        // LanguageService, optional: completions, hovers, problems, definitions
  appearance={{ layout: 'flat', theme: 'dark' }} // how it looks; see below
  storage={localStorage}              // where the layout and sizes are kept
  views={[{ id: 'search', title: 'Search', icon: 'search-large', keybinding: 'shift+mod+f', content: <MySearch /> }]}
  auxiliaryBar={{ title: 'Chat', content: <MyChat /> }}
  slots={{ statusLeft: <StatusItem kind="remote" icon="remote" text="My Server" /> }}
  commands={[{ id: 'my.hello', title: 'Hello', category: 'Help', keybinding: 'mod+shift+h', run: hello }]}
  onReady={(api) => (ide = api)}      // commands, context, layout, editor, open(path), notify(message), quickOpen(value)
/>
```

- **Commands:** every action is a command with an id, title, key and `when` clause, such as `workbench.action.togglePanel` on `⌘J`. A host's command with the same id replaces the built-in one, and `keybindings` adds keys.
- **Slots:** the titlebar's middle, more sidebar views (each with an activity bar item), buttons at the bottom of the activity bar, the secondary side bar, and the status bar's left and right.
- **The parts:** the layout, sizes and the sidebar's view are kept in `storage` under `storageKey`.
- **The secondary side bar:** `auxiliaryBar` takes a `title`, its `content`, `actions` for its title and a `size` to start at.
- **Its own bar or yours:** `titlebar={false}` leaves the titlebar out, for an app that has a bar of its own. The same commands (`workbench.action.toggleSidebarVisibility`, `togglePanel`, `toggleAuxiliaryBar`) and `api.layout` drive the parts from there.
- **The activity bar, at the side or in your bar:** `activityBar={false}` leaves it out, and `<ActivityToolbar workspace={api} />` draws its buttons (the application menu, a button per view, `activityActions`) as a row anywhere, working the same; its menus open below it. `api.views`, `api.activityActions` and `api.menu()` are there to build your own.
- **Files it can't show:** a binary file, or one the host fails to read, opens to a message saying why instead of an editor.
- **Deletes that can be undone:** a `FileSystem` with `deletes: 'trash'` gets "Move to Trash" in the explorer, as VS Code asks it, instead of "Delete Permanently".

`workspace/core` has the registry with no view: `CommandRegistry`, `Keybindings` (chords included), `ContextKeys`, `parseWhen` and `LayoutModel`.

```ts
import { CommandRegistry, ContextKeys, Keybindings } from '@tensorai-co/workspace/core'

const commands = new CommandRegistry()
const keys = new Keybindings(commands, new ContextKeys())
commands.register({ id: 'save', title: 'Save', keybinding: 'mod+s', run: save })
window.addEventListener('keydown', (e) => keys.handle(e).kind !== 'none' && e.preventDefault())
```

## Customizing the look

`appearance` takes any of these; what's left out keeps the theme's own value:

```tsx
<Workspace
  appearance={{
    theme: 'dark',                    // 'light' (the default) or 'dark'
    layout: 'flat',                   // 'rounded': cards with gaps (the default); 'flat': panes edge to edge, square corners
    radius: 6,                        // corners of cards, menus, dialogs and widgets
    smallRadius: 3,                   // corners of buttons, rows and tabs
    gap: 6,                           // space between cards, when rounded
    shadows: false,
    fonts: { ui: 'Inter, sans-serif', code: "'JetBrains Mono', monospace", codeSize: 13, lineHeight: 20 },
    colors: { 'editor.background': '#fffdf5', focusBorder: '#c2185b' }, // any theme color, by key
    syntax: { keyword: '#af00db', string: '#a31515' },
    brackets: ['#0431fa', '#319331', '#7b3814'],
  }}
/>
```

It's all CSS custom properties, so it works on any piece, not only the whole IDE: `applyAppearance(element, appearance)` from `@tensorai-co/workspace/theme` sets it on an element and everything in it, and `appearanceStyle(appearance)` gives the properties to set yourself. A color key is any token in `theme/styles.css` without its `--ws-color-` prefix. The editor and terminal measure their font again when it changes.

## Using the editor

```tsx
import '@tensorai-co/workspace/theme/styles.css'
import '@tensorai-co/workspace/editor/styles.css'
import { CodeEditor } from '@tensorai-co/workspace/editor'

<CodeEditor value={source} onChange={setSource} path="src/App.tsx" />
```

Without React, `new EditorView({ parent, state })` mounts the same editor in any element. Its find widget is `view.find`, to open or drive from outside: `view.find.open({ replace: true })`. `<CodeEditor wordWrap>` (or `view.setWordWrap(true)`) wraps lines, and `view.fold()`, `view.unfold()`, `view.foldAll()` and `view.unfoldAll()` fold from outside.

Searching works without a view too: `findMatches(doc, { search, caseSensitive, wholeWord, regexp })`, and `replaceAll(state, query)` gives one transaction.

The engine also runs without a view, for tests and scripted edits:

```ts
import { EditorState, insertNewline } from '@tensorai-co/workspace/editor/core'

let state = EditorState.create({ doc: 'function f() {}', language: 'tsx', selection: 14 })
state = state.apply(insertNewline(state)!)
state.doc.toString() // 'function f() {\n    \n}'
```

Set `data-theme="dark"` on any ancestor for the dark theme, or `applyAppearance(element, { ... })` from `theme` for anything else (see [Customizing the look](#customizing-the-look)).

## Using AI inline completions

The editor has no model of its own. Give it any model, local or remote, as an `InlineCompletionProvider`:

```tsx
import type { InlineCompletionProvider } from '@tensorai-co/workspace/host'

const myModel: InlineCompletionProvider = {
  async *provide({ doc, position, language, path }, signal) {
    const before = doc.slice(Math.max(0, position - 2000), position)
    let text = ''
    for await (const piece of streamFromMyModel({ before, language, path, signal })) {
      text += piece
      yield { text }                  // each value replaces the last, so the ghost text grows
    }
  },
}

<CodeEditor value={source} onChange={setSource} path="src/App.tsx" inlineCompletions={myModel} />
```

- **Asking:** after 150 ms without typing, with one cursor and nothing selected, and not in the middle of a word. `⌥\` asks at once. A request that's no longer wanted is aborted through its `signal`.
- **Answers:** `range` lets a suggestion replace text before the cursor, or keep text after it, such as the bracket that was closed for you. `index` gives several suggestions.
- **Next edits:** `nextEdit: { from, to, insert }` suggests an edit elsewhere in the file, such as the matching change after a rename, with or without ghost text. `Tab` goes to it, `Tab` again makes it, and the editor asks again at once, so a provider can lead through a refactor one `Tab` at a time.
- **Context:** `request.doc` is a snapshot that doesn't change while the user types. `completionContext` adds whatever else the model should see.
- **Events:** `onShown`, `onAccepted` and `onDismissed`, if the provider has them. The editor collects nothing itself.

`ScriptedCompletionProvider` in `testing` streams set suggestions, for tests and demos.

## Using a language service

Completions, hovers, problems, go to definition, the outline and formatting come from a `LanguageService`, which a host writes over whatever it has: an LSP client, a worker, a model. Every method is optional, and offsets are into the request's `doc`:

```tsx
import type { LanguageService } from '@tensorai-co/workspace/host'

const myLanguageServer: LanguageService = {
  triggerCharacters: ['.'],
  async completions({ doc, position, language }, signal) {
    return [{ label: 'log', kind: 'method', detail: '(method) Console.log(...data: any[]): void', documentation: 'Prints to the console.' }]
  },
  async hover({ doc, position }) {
    return { contents: ['```typescript\nconst total: number\n```'] }
  },
  async diagnostics({ doc, path }) {
    return [{ from: 6, to: 11, severity: 'error', message: "Type 'string' is not assignable to type 'number'.", source: 'ts', code: 2322 }]
  },
  async definition({ doc, position }) {
    return [{ path: '/project/src/other.ts', from: 120 }] // leave out `path` for this file
  },
}

<CodeEditor value={source} onChange={setSource} path="src/App.tsx" languages={myLanguageServer} onOpenLocation={openFile} />
```

- **Completions:** asked for as a word starts, after a trigger character, and on `⌃Space`. The editor filters and sorts what comes back as the word grows (`incomplete: true` asks again instead). `resolveCompletion` fills in an item's details when it's selected. `range`, `filterText`, `sortText`, `preselect` and `additionalEdits` (an import, say) work as in LSP.
- **Problems:** asked for when a file opens and half a second after each edit. Meanwhile they move with their text.
- **Answers that come late:** requests a newer one replaces are aborted through their `signal`, and answers for an older version of the text are moved onto the text as it is.
- **Hovers:** problems first, then the service's Markdown, with code fences colored as the editor colors code. HTML is shown as text and only safe links are links.

`ScriptedLanguageService` in `testing` gives set answers, for tests and demos.

## Using the explorer

```tsx
import '@tensorai-co/workspace/theme/styles.css'
import '@tensorai-co/workspace/explorer/styles.css'
import { Explorer } from '@tensorai-co/workspace/explorer'

<Explorer fs={fileSystem} root="/project" onOpen={(path, { preview }) => open(path, preview)} activePath={path} />
```

`fs` is a `FileSystem` from `host`. For a test or a demo, use the one in memory:

```ts
import { MemoryFileSystem } from '@tensorai-co/workspace/testing'

const fs = new MemoryFileSystem({ 'src/main.tsx': 'export {}\n', 'README.md': '# Hi\n' })
```

For a tree of anything else, give `<Tree>` a `TreeModel` over your own items:

```tsx
import { Tree, TreeModel } from '@tensorai-co/workspace/tree'

const model = new TreeModel({
  id: (item) => item.id,
  label: (item) => item.name,
  hasChildren: (item) => item.isGroup,
  children: async (item) => load(item), // undefined for the roots; called when first shown
})

<Tree model={model} label="Outline" onOpen={(item) => show(item)} />
```

## Using tabs

A `TabsModel` holds tabs of anything, and `<TabStrip>` draws them:

```tsx
import '@tensorai-co/workspace/tabs/styles.css'
import { TabsModel, TabStrip } from '@tensorai-co/workspace/tabs'

const tabs = new TabsModel<string>((path) => path)
tabs.open('/src/main.tsx')
tabs.open('/README.md', { preview: true })

<TabStrip model={tabs} label="Files" dragType="editor" describe={(tab) => ({ label: tab.id.split('/').pop()! })} />
```

Tabs can be dragged between strips with the same `dragType`. `onClose` lets the host ask about unsaved changes, `runTabsKey` runs the tab strip's keys, and `distinguish` gives the folders that tell same-named files apart.

## Using split panes

```tsx
import '@tensorai-co/workspace/split/styles.css'
import { Pane, Split } from '@tensorai-co/workspace/split'

<Split direction="row" gap={4} storage={localStorage} storageKey="layout">
  <Pane id="sidebar" size={256} min={170} snap visible={open} onVisibleChange={setOpen}>…</Pane>
  <Pane id="editors" min={220} grow>…</Pane>
</Split>
```

- **Sizing:** a pane with `grow` takes the room when the window changes. Panes with no `size` keep their proportions.
- **Sashes:** they light up after a short rest, and a double-click resets the pane.
- **Snapping:** a `snap` pane closes when dragged well below its minimum, and opens again from the edge.
- **Saving:** sizes and closed panes are kept in `storage`.

## Using the terminal

```tsx
import '@tensorai-co/workspace/theme/styles.css'
import '@tensorai-co/workspace/terminal/styles.css'
import { Terminal, TerminalPanel } from '@tensorai-co/workspace/terminal'

<Terminal host={host} />        // one terminal
<TerminalPanel host={host} />   // a panel: several, with a list of them
```

`host` is a `TerminalHost`: it opens sessions, which are a stream of bytes out and a `write` in. That can be a pty, a remote shell or a socket. Without React, `new TerminalView({ parent, screen, onInput })` draws a screen in any element.

The emulator also runs with no view, for tests and servers:

```ts
import { Screen } from '@tensorai-co/workspace/terminal/core'

const screen = new Screen({ cols: 80, rows: 24 })
screen.write('\x1b[1;32mhello\x1b[0m\r\n')
screen.view[0].text(true) // 'hello'
```

## Using the Markdown preview

```tsx
import '@tensorai-co/workspace/theme/styles.css'
import '@tensorai-co/workspace/markdown/styles.css'
import { MarkdownPreview, syncScroll } from '@tensorai-co/workspace/markdown'

<MarkdownPreview text={source} />   // anywhere, on its own
<MarkdownPreview                    // in an IDE
  text={source}
  path="/project/docs/guide.md"     // relative links and images start here
  root="/project"                   // and don't lead out of here
  fs={fileSystem}                   // where images are read from
  activeLine={line}                 // marks the block the cursor is in
  onOpen={({ path, line, anchor }) => open(path)}
  onDoubleClick={(line) => goTo(line)}
  onView={setPreview}
/>
```

`syncScroll(editorView, preview)` scrolls the two together, both ways, and returns a function that stops. It works between any two things that have `topLine`, `scrollToLine` and `onScroll`.

`markdown/core` does the work with no view: `readMarkdown(text)` gives a tree of elements with the source line of each block. The parser is its own package: `parse(text)` from `@tensorai-co/workspace/markdown-parser` gives the syntax tree, with no DOM.

## What the workspace does today

- **The parts:** the titlebar with back, forward and the command center, the activity bar, the sidebar, editor groups, the terminal panel, the secondary side bar and the status bar, as floating cards or flat panes.
- **Toggles:** `⌘B` the sidebar, `⌘J` the panel, `` ⌃` `` the terminal (showing it, focusing it, or hiding it), `⌥⌘B` the secondary side bar, and maximizing the panel. They are also in the titlebar and the Customize Layout menu.
- **Keys:** one place for every key, chords included. `⌘K V` waits for its second key only where it can run, so `⌘K` still clears a focused terminal, and the status bar says when it's waiting. Keys are read by their place, so `⌥⌘B` works on a Mac.
- **`when` clauses:** `editorAreaFocus`, `terminalFocus`, `sideBarVisible`, `activeEditorLangId`, `activeEditorIsDirty` and more, kept up to date as the focus moves.
- **Editors:** groups side by side, preview and pinned tabs, Markdown previews in a tab or beside the source, asking before closing changes, and going back and forward through the files that were active.
- **The application menu:** every command with a category, by category, with its key.
- **The command palette and Quick Open:**
  - `⇧⌘P` (or F1) lists every command whose `when` holds where the focus was, as "Category: Title" with its keys, matched by a stretch of the title or or the starts of words: "tog side"). The recently used come first, and are kept in `storage`
  - `⌘P` (or a click on the command center) finds files fuzzily by name and folder, the recently opened first; `:12` or `⌃G` goes to a line
  - `⇧⌘O` (or `@`) lists the active file's symbols from the language service, in document order, matched fuzzily
  - `↑` / `↓` and Enter, or a click; `Esc` closes it and gives the focus back
- **Problems** in the status bar: the errors and warnings in the files open in editors, when there's a language service.
- **Measured:** the titlebar, activity bar, sidebar title, cards, gaps, secondary side bar and status bar are checked against reference values at the same window size, in the layout check.

**Not yet:**
- a help list (`?`) in Quick Open, `@:` symbols grouped by kind, and searching across files
- more than one panel view (Problems, Output), and moving parts to other sides
- problems in files that aren't open: the status bar counts the open editors' only
- editor groups split downward, and dragging tabs between groups to make one
- a notification center (messages show for a few seconds)

The editor area lives here rather than in `editor`, because its preview tabs need `markdown`.

## What the Markdown preview does today

- **Markdown:** CommonMark, tables, task lists, strikethrough, links as they're typed, and front matter as a table. Block types and source lines match `markdown-it` on every one of 433 READMEs (22,951 blocks), and the parser passes the CommonMark and GitHub spec examples.
- **HTML:** the tags GitHub allows, such as `<details>`, `<kbd>` and `<p align>`.
- **Code:** in the editor's own colors, with a copy button.
- **Following the source:** it updates as you type, and only blocks that changed are drawn again. It scrolls with the editor to within a line, both ways, and keeps its place while images load.
- **Links:** to files, to lines (`#L12`), to headings, and to the web in a new tab. Images come from the file system, and change when their files do.
- **Safe:** nothing in a file is run or handed to the browser as HTML. Scripts, styles, event handlers and frames are dropped, only web and mail links open, and no link or image leads out of the root. `remoteImages={false}` keeps images on the web from loading.
- **Measured:** every element of a document with one of everything is checked against reference boxes, to a hundredth of a pixel, and colors, in the layout check.

**Not yet:**
- math and Mermaid diagrams
- find in the preview
- the lines a change touched, marked as in a diff

Task lists get boxes, and code has the editor's colors.

## What the terminal does today

- **Programs:** `vim`, `less`, `nano`, `top`, `git`, `bash` and `zsh` run as they should. Recordings of them are replayed in the tests, against screens made by another terminal.
- **Text:** 16, 256 and 24-bit color, every common style and underline, wide characters and emoji, marks, and DEC line drawing. Box and block characters are drawn to fill their cells, so lines meet.
- **Screen:** scroll regions, the alternate screen, scrollback that wraps again when the size changes, and synchronized frames.
- **Input:** xterm's keys and macOS editing keys, bracketed paste, mouse and focus reporting, and input methods.
- **Selection and links:** by character, word, line or block; URLs and marked links, opened with `⌘click`.
- **Contrast:** text keeps a contrast of at least 4.5 against its background. Sizes and colors are in the layout check.
- **Fast:** 300,000 lines in under a second in the playground, with no frame over 20 ms. Only rows that changed are drawn.
- **Safe with what programs print:** text is escaped, only web links open by themselves, programs can't read the clipboard, and nothing a program sets (such as a title) is ever sent back as input.

**Not yet:**
- split terminals, and find in scrollback
- shell integration marks
- image protocols and the kitty keyboard protocol
- a screen-reader mode
- `⌥click` to move the cursor

## What the explorer does today

- **Opening:** a click previews a file, and a double-click, middle click or `⌘↓` opens it for good. `Space` previews without leaving the tree.
- **Editing:** new files and folders (`a/b/c.ts` makes the folders on the way), renaming in place, and deleting after a confirmation. Names are checked before they're made.
- **Keys:** arrows, paging, type-to-find, `*` and multiple selection. Enter renames on macOS.
- **Staying current:** it reloads when the file system reports changes, keeping what's open, focused and selected.
- **The rest:** a context menu, copy path, reveal the active file, hover paths, indent guides, and ARIA tree roles.
- **Large folders:** 100,000 files open in about 110 ms, only the rows in view are in the DOM, and scrolling and arrow keys stay within a frame.
- **Measured:** sizes, positions, colors and fonts are checked in the layout check. File icons are the Seti font's glyphs.

**Not yet:**
- drag and drop, cut, copy and paste
- compact folders, sticky scroll and the filter box
- decorations (modified, error, ignored)

## What the editor does today

- **Typing:**
  - auto-close and over-type of brackets and quotes, and surrounding a selection
  - JSX tag closing in `.tsx` and `.jsx`
  - indentation on Enter from each language's own rules
  - Tab and Shift+Tab indenting
- **Multiple cursors:** `⌥⌘↑/↓`, `⌘D`, `⌘⇧L`, `⌥click`.
- **Line operations:** move, copy, delete, insert above and below; line and block comments.
- **Undo and redo,** with typing grouped into words.
- **Clipboard:** copying with nothing selected copies the whole line; pasting gives one line to each cursor.
- **Highlighting:** colors for all 234 languages, mapped to the themes' TextMate scopes, with bracket pair colors by depth.
- **Measured layout:** the 66px gutter, Menlo 12px on 18px lines, a 2px cursor, the current-line highlight, and 14px overlay scrollbars.
- **Large files:**
  - a 50,000-line file paints in about 40 ms, and a keystroke reaches the screen in under one frame
  - only visible lines are in the DOM, and the rest tokenizes in the background
- **Word wrap:** lines wrap at the editor's width, breaking before `([{`, after spaces, `)]}` and punctuation, between CJK characters, mid-word only when a word won't fit, and rows after the first keep the line's indent. `↑` / `↓` move by rows, and `⌥Z` turns it on and off. In the workspace, Markdown files wrap unless turned off
- **Folding,** by indentation and `#region` markers, with off-side languages such as Python handled their way:
  - chevrons in the gutter on hover, "⋯" after a folded line (a click unfolds), and the folded line shaded
  - `⌥⌘[` / `⌥⌘]` fold and unfold at the cursor, and `⌘K ⌘0`, `⌘K ⌘J` and `⌘K ⌘L` fold all, unfold all and toggle
  - folds follow edits around them; an edit inside one, or the cursor landing in one, unfolds it. `↑` / `↓` pass over folded lines
  - in a 50,000-line file, typing stays near 10 ms a keystroke with wrapping on or 5,000 regions folded, and folding them all takes about 20 ms
- **Find and replace:**
  - `⌘F` fills the search from the selection or the word at the cursor, and finds as you type. `Enter` / `⇧Enter` and `⌘G` / `⇧⌘G` (F3 elsewhere) go through matches, with the count in the widget
  - Match Case, Whole Word (by the default word separators), Regular Expression and Find in Selection, from the buttons or `⌥⌘C`, `⌥⌘W`, `⌥⌘R`, `⌥⌘L`
  - `⌥⌘F` (Ctrl+H elsewhere) opens Replace: `Enter` replaces the match and goes to the next, and `⌘Enter` replaces them all as one undo step. Regular expressions take `$1`, `$&`, `\n`, `\u`, `\U`, `\l` and `\L`, and Preserve Case keeps "Foo" and "FOO" as they were
  - `⌥Enter` puts a cursor on every match, and `Esc` closes it
  - every match is drawn, the current one darker. A 50,000-line file is searched in under 15 ms
- **AI ghost text,** when a host gives a provider:
  - in the file's own colors, faded and in italics. Lines below the cursor's take rows of their own and push the code down
  - it grows as the model streams. Typing what it says keeps it, and typing anything else drops it and asks again after the next pause
  - `Tab` accepts it all as one undo step, `⌘→` the next word, `⌘⇧→` the next line, `Esc` dismisses it, and `⌥]` / `⌥[` go through several
  - it's never in the document until it's accepted, and it's drawn in the frame after the model's first piece arrives
- **Language features,** when a host gives a language service:
  - the suggest widget under the cursor (over it when there's no room below), following the cursor as the word grows: kind icons and colors, the typed letters in bold blue, the selected item's detail at the right, at most 12 rows. `↑` / `↓`, Page Up / Down, Enter or Tab to put it in, `Esc` to close, and `⌃Space` again for the item's docs beside (or under) the list
  - fuzzy filtering: word starts and camelCase ("gebi" finds `getElementById`), runs over scattered letters, exact case first, and a swapped pair of letters still matching. Typing in comments and strings doesn't ask
  - problems drawn as wavy lines in the error, warning and info colors, and three dots for hints
  - the hover after the mouse rests 300 ms on a word: problems first with their source and code, then the service's Markdown. Over the line when there's room, and as wide as its content. `⌘K ⌘I` shows it at the cursor
  - `F12` or `⌘`-click goes to a definition; `⌘` over a word underlines it. One in another file goes to the host (`onOpenLocation`); the workspace opens it there
  - `⇧⌥F` formats the document with the service's edits, as one undo step
- **Next edits (`Tab`, `Tab`),** when a provider suggests an edit elsewhere:
  - drawn as an inline diff: the removed text struck through on red, the added text after it on green
  - a marker in the gutter, with the line's number: `Tab` goes there, and the marker turns solid when `Tab` will make the edit. When the edit is out of view, the marker waits at the top or bottom edge with an arrow
  - each edit is its own undo step. It stays while the cursor moves, follows edits above it, and goes once the text it would change has changed

**Not yet:**
- `→` at the end of a folded line goes into the fold and unfolds it instead of stepping over it; Home and End go by document lines, not wrapped rows
- folding from a language server, and folding levels (`⌘K ⌘1`…)
- the find widget's history (`↑` / `↓`), its resizing by dragging, and marks for matches beside the scrollbar
- the EditContext input path (input uses a hidden textarea today)
- IME composition text shown inline
- other views for larger next edits (side by side, line replacement), and a toolbar on hover over ghost text
- the hover's row of actions ("View Problem", "Quick Fix…"), with the problem peek (`F8`) and code actions it needs; signature help, rename, find references and peek definition; snippets in completions; resizing the suggest widget and the hover by dragging
- a minimap

---

## Run and test

```sh
npm install            # also builds dist/
npm test               # every package's tests; no browser needed
npm run typecheck
npm run build          # dist/: JavaScript and declarations, as installs get them
npm run playground     # the whole IDE (<Workspace>) over files in memory, with a pretend model for ghost text, at http://localhost:5173
```

In this repository the parts import each other by their published names (`@tensorai-co/workspace/text`), which
resolve to the package itself. The `source` condition in `package.json`'s exports takes them to the TypeScript, so the
tests, the typecheck and the playground run on the source; anywhere else they get `dist/`.

`npm run playground:shell` runs the same with real shells. They run through a bridge in the dev server that only this page can reach: each run has its own token, and it needs Python 3.

The playground also has:
- **`/layout.html`:** the layout check. It measures the explorer, tabs, sashes, terminal, Markdown preview, menu, dialog, the workspace's parts, find, folding, the suggest widget, the hover and problems in your browser against the reference values and lists any that differ. Keep the page in view while it runs.
- **`/?big`:** a folder of 100,000 files.
- **`/?delay=1000`:** a file system that takes that many milliseconds per call.
- **`/?nocomplete`:** no ghost text. Otherwise a pretend model suggests what follows the typed text in the sample files, and after a rename, the same rename where the old name is used next.
- **The Appearance view** (the gear in the activity bar): every appearance option, kept between visits.
- **`/?nolanguages`:** no language service. Otherwise a pretend one reads the TypeScript and JavaScript files with a few patterns: completions from what's declared and used (and `console.`, `Math.`, `JSON.`), hovers with doc comments, a few problems (unmatched brackets, `console`, `==`, `TODO`), definitions across files through relative imports, the outline and formatting.

---

## Repository layout

```text
workspace/
├── packages/
│   ├── text/          # rope, change sets
│   ├── highlight/     # engine/ (the tokenizer), languages/ (a grammar per language)
│   ├── languages/     # registry, rules, incremental tokenizer, react.tsx (Highlighted); data/ (language definitions)
│   ├── editor/        # core/ (state, commands, keymap, suggest…), view/ (view, input, mouse, folds, features, widgets), react/, styles.css
│   ├── tree/          # core/ (model, keys), view/, styles.css
│   ├── explorer/      # core/ (model, names, paths), react/, styles.css
│   ├── terminal/      # core/ (parser, screen, keys, selection…), view/, panel/, react/, data/, styles.css; test/captures/
│   ├── markdown-parser/ # blocks, inlines, tables, entities; test/ has the CommonMark and GitHub specs
│   ├── markdown/      # core/ (document, html, links, scroll…), react/, styles.css
│   ├── tabs/          # core/ (model, keys, distinguish), view/, styles.css
│   ├── split/         # core/ (model), view/, styles.css
│   ├── overlays/      # hover, menu, dialog, styles.css
│   ├── host/          # the interfaces a host implements, types only
│   ├── testing/       # in-memory and scripted fakes of the host interfaces
│   ├── theme/         # styles.css, shapes.css, appearance.ts; data/themes.css
│   ├── icons/         # resolver, react.tsx; data/ (Seti and Codicons)
│   └── workspace/     # core/ (commands, keys, when, layout), react/ (Workspace, parts, editors/), styles.css
├── apps/playground/   # Vite app for working on the components; src/layout/ is the layout check, shell/ the dev-only bridge
├── licenses/          # the licenses of the data in NOTICE
└── dist/              # built by `npm run build` (and on install); not in git
```

---

## License

MIT. Some data keeps its own license; see [NOTICE](NOTICE).
