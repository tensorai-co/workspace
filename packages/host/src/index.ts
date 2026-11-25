// What the components need from the app they run in. A host implements these over whatever it has (a disk, a remote
// machine, memory); `@tensorai-workspace/testing` has an in-memory fake of each. Paths are absolute, with "/" between
// segments.

/** Files and folders. Every method rejects when it can't do its job, with a message fit to show. */
export interface FileSystem {
  list(dir: string): Promise<DirEntry[]>
  read(path: string): Promise<Uint8Array>
  write(path: string, data: Uint8Array): Promise<void>
  /** Makes an empty file. Rejects when something is already there. */
  createFile(path: string): Promise<void>
  /** Makes a folder, and any missing folders above it. */
  createDir(path: string): Promise<void>
  /** Renames or moves a file or folder. Rejects when something is already at `to`. */
  rename(from: string, to: string): Promise<void>
  /** Deletes a file, or a folder with everything in it. */
  delete(path: string): Promise<void>
  /** Optional: changes made under `path`, by anyone. Returns a function that stops watching. */
  watch?(path: string, onChange: (event: FileChange) => void): () => void
}

export interface DirEntry {
  name: string
  path: string
  kind: 'file' | 'dir' | 'symlink'
  size: number
}

export interface FileChange {
  path: string
  kind: 'created' | 'changed' | 'deleted'
}

/** Where a terminal's processes run: a pty, a remote shell, a socket, a test script. */
export interface TerminalHost {
  open(options: { cols: number; rows: number; cwd?: string }): TerminalSession
}

/** One process behind a terminal. */
export interface TerminalSession {
  /** What the process prints. */
  readonly output: ReadableStream<Uint8Array>
  /** The process's name, such as "zsh", for the terminal's tab. */
  readonly name?: string
  /** Keys, pastes, mouse reports and answers, already encoded. */
  write(data: Uint8Array): void
  resize(cols: number, rows: number): void
  /** Ends the process. */
  close(): void
  readonly exited: Promise<{ code: number | null }>
}

/** For hosts without `navigator.clipboard` (some native web views). */
export interface Clipboard {
  readText(): Promise<string>
  writeText(text: string): Promise<void>
}

/** Where the layout, open tabs and sizes are kept between sessions. `localStorage` already fits. */
export interface Storage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** A version of a document that never changes, safe to read while the user keeps typing. The editor's `Text` is one. */
export interface TextSnapshot {
  readonly length: number
  /** How many lines; there's always at least one. */
  readonly lines: number
  slice(from: number, to?: number): string
  toString(): string
  /** A line by its number, from 1. */
  line(n: number): { number: number; from: number; to: number; text: string }
  lineAt(pos: number): { number: number; from: number; to: number; text: string }
}

/**
 * AI ghost-text completions for the editor, from any model, local or remote. The editor asks after a pause in typing
 * and shows what comes back as faded text after the cursor; `Tab` accepts it.
 */
export interface InlineCompletionProvider {
  /**
   * Suggests text for a request. Each value replaces the last one with the same `index`, so a suggestion can grow as
   * the model streams it. Stop when `signal` aborts: the user typed something else, or moved away.
   */
  provide(request: InlineCompletionRequest, signal: AbortSignal): AsyncIterable<InlineCompletion>
  /** A suggestion was first shown. The editor collects nothing itself; these are for hosts that want them. */
  onShown?(completion: InlineCompletion): void
  onAccepted?(completion: InlineCompletion, part: 'all' | 'word' | 'line' | 'edit'): void
  onDismissed?(completion: InlineCompletion): void
}

export interface InlineCompletionRequest {
  /** The document when the request was made. Read as much around `position` as the model needs. */
  doc: TextSnapshot
  /** The cursor, as an offset. */
  position: number
  /** The language's id, such as "tsx" or "python". */
  language: string
  path?: string
  /** "automatic" after a pause in typing; "explicit" when the user asked (`⌥\`). */
  trigger: 'automatic' | 'explicit'
  /** Whatever the editor's `completionContext` hook added: recent edits, open files… */
  context?: unknown
}

export interface InlineCompletion {
  /** The text, growing as the model streams. */
  text: string
  /**
   * The text it replaces, in `request.doc`; the cursor by default. Starting before the cursor lets a suggestion
   * rewrite what's typed; ending after it lets it keep text there, such as an auto-closed bracket it ends with.
   */
  range?: { from: number; to: number }
  /** Which suggestion this is when there are several, from 0. `⌥]` and `⌥[` go through them. */
  index?: number
  /**
   * An edit somewhere else in the file, in `request.doc`, such as the matching change after a rename. `Tab` goes to
   * it and `Tab` again makes it; then the editor asks again, for the next one. `text` can be empty when this is all.
   */
  nextEdit?: { from: number; to: number; insert: string }
}

/**
 * What a language server knows, for the editor: completions, hovers, problems, definitions, symbols and formatting. A
 * host wraps whatever it has (an LSP client, a worker, a model); every method is optional. Offsets are into the
 * request's `doc`; the editor maps answers onto the text as it is when they arrive. Stop when `signal` aborts.
 */
export interface LanguageService {
  /** Characters that ask for completions as soon as they're typed, such as "." in most languages. */
  triggerCharacters?: readonly string[]
  /** What could go at `position`. The editor filters the list itself as the word grows. */
  completions?(request: CompletionRequest, signal: AbortSignal): Promise<CompletionList | CompletionItem[] | undefined>
  /** Fills in an item's `detail` and `documentation` when it's selected, for services that leave them out of lists. */
  resolveCompletion?(item: CompletionItem, signal: AbortSignal): Promise<CompletionItem>
  /** What to show while the mouse rests on `position`. */
  hover?(request: LanguageRequest, signal: AbortSignal): Promise<Hover | undefined>
  /** The document's problems. Asked again a little after each edit. */
  diagnostics?(document: LanguageDocument, signal: AbortSignal): Promise<Diagnostic[]>
  /** Where the symbol at `position` is declared: F12, or ⌘-click. */
  definition?(request: LanguageRequest, signal: AbortSignal): Promise<Location[] | undefined>
  /** The document's outline: classes, functions, variables. */
  symbols?(document: LanguageDocument, signal: AbortSignal): Promise<DocumentSymbol[]>
  /** Edits that format the whole document. */
  format?(request: FormatRequest, signal: AbortSignal): Promise<TextEdit[]>
}

/** A document, as one request sees it. */
export interface LanguageDocument {
  doc: TextSnapshot
  /** The language's id, such as "typescript" or "python". */
  language: string
  path?: string
}

/** A place in a document. */
export interface LanguageRequest extends LanguageDocument {
  position: number
}

export interface CompletionRequest extends LanguageRequest {
  /** "typing" as a word grows, "character" after one of `triggerCharacters`, "explicit" with ⌃Space. */
  trigger: 'typing' | 'character' | 'explicit'
  /** The trigger character, for "character". */
  character?: string
}

export interface CompletionList {
  items: CompletionItem[]
  /** The list isn't the whole answer: the editor asks again as the word grows, instead of only filtering. */
  incomplete?: boolean
}

/** Completion kinds; each has its own icon and color. */
export type CompletionKind =
  | 'method' | 'function' | 'constructor' | 'field' | 'variable' | 'class' | 'struct' | 'interface' | 'module' | 'property'
  | 'event' | 'operator' | 'unit' | 'value' | 'constant' | 'enum' | 'enumMember' | 'keyword' | 'text' | 'color' | 'file'
  | 'reference' | 'folder' | 'typeParameter' | 'snippet' | 'user' | 'issue'

export interface CompletionItem {
  label: string
  kind?: CompletionKind
  /** A line about it, such as its type: shown beside the selected row, and above its docs. */
  detail?: string
  /** Markdown, shown beside the list for the selected item (⌃Space shows or hides it). */
  documentation?: string
  /** What goes in; the label by default. */
  insertText?: string
  /** The text it replaces, in the request's document: the word before the cursor by default. */
  range?: { from: number; to: number }
  /** What the typed word is matched against; the label by default. */
  filterText?: string
  /** How it sorts among items that match as well; the label by default. */
  sortText?: string
  /** Picked first when nothing typed favors another item. */
  preselect?: boolean
  /** More edits made with it, elsewhere in the request's document, such as an import. */
  additionalEdits?: TextEdit[]
  /** Anything the service wants back in `resolveCompletion`. */
  data?: unknown
}

export interface Hover {
  /** Markdown; each part is drawn in its own section. Code fences are colored as the editor colors code. */
  contents: string | string[]
  /** The text it's about, in the request's document; the word under the mouse by default. */
  range?: { from: number; to: number }
}

export interface Diagnostic {
  from: number
  to: number
  severity: 'error' | 'warning' | 'info' | 'hint'
  message: string
  /** Who found it, such as "ts" or "eslint". */
  source?: string
  code?: string | number
}

/** A place in a file: this one when `path` is left out. Offsets are into that file's text. */
export interface Location {
  path?: string
  from: number
  to?: number
}

/** Symbol kinds; each has its own icon and color. */
export type SymbolKind =
  | 'file' | 'module' | 'namespace' | 'package' | 'class' | 'method' | 'property' | 'field' | 'constructor' | 'enum'
  | 'interface' | 'function' | 'variable' | 'constant' | 'string' | 'number' | 'boolean' | 'array' | 'object' | 'key'
  | 'null' | 'enumMember' | 'struct' | 'event' | 'operator' | 'typeParameter'

export interface DocumentSymbol {
  name: string
  kind: SymbolKind
  /** Shown after the name, fainter: a signature or type. */
  detail?: string
  /** All of it, its body included. */
  from: number
  to: number
  /** Its name, where the cursor goes; `from` by default. */
  selection?: { from: number; to: number }
  children?: DocumentSymbol[]
}

export interface FormatRequest extends LanguageDocument {
  tabSize: number
  insertSpaces: boolean
}

/** Replaces [from, to) with `insert`. */
export interface TextEdit {
  from: number
  to: number
  insert: string
}
