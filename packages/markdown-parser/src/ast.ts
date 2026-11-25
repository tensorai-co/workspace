// The syntax tree parse() returns. Node names follow mdast where they
// overlap, so the shapes are familiar.

/** Where a block sits in the source, as UTF-16 offsets: [start, end), whole lines. */
export interface Position {
  start: number
  end: number
}

/** Every block knows where it sits in the source. */
export interface Span {
  position: Position
}

export interface Root {
  type: 'root'
  children: Block[]
}

export type Block = Paragraph | Heading | ThematicBreak | Blockquote | List | Code | Html | Table

export interface Paragraph extends Span {
  type: 'paragraph'
  children: Inline[]
}

export interface Heading extends Span {
  type: 'heading'
  depth: 1 | 2 | 3 | 4 | 5 | 6
  children: Inline[]
}

export interface ThematicBreak extends Span {
  type: 'thematicBreak'
}

export interface Blockquote extends Span {
  type: 'blockquote'
  children: Block[]
}

export interface List extends Span {
  type: 'list'
  ordered: boolean
  /** The first number of an ordered list. */
  start?: number
  /** Loose: its items are separated by blank lines, so their text is in paragraphs. */
  spread: boolean
  children: ListItem[]
}

export interface ListItem extends Span {
  type: 'listItem'
  /** A task list item's box: true when ticked. Undefined for other items. */
  checked?: boolean
  children: Block[]
}

export interface Code extends Span {
  type: 'code'
  /** The fence's first word, e.g. "ts". Undefined for indented code and bare fences. */
  lang?: string
  /** The rest of the fence's info string. */
  meta?: string
  value: string
}

/** Raw HTML. It's shown as text, never run. */
export interface Html extends Span {
  type: 'html'
  value: string
}

export type Align = 'left' | 'right' | 'center' | null

export interface Table extends Span {
  type: 'table'
  align: Align[]
  /** The header row first, then the body rows. Every row has align.length cells. */
  children: TableRow[]
}

export interface TableRow {
  type: 'tableRow'
  children: TableCell[]
}

export interface TableCell {
  type: 'tableCell'
  children: Inline[]
}

export type Inline = Text | Emphasis | Strong | Delete | InlineCode | Break | Link | Image | InlineHtml

/** Text. A soft line break inside a paragraph is a "\n" in it. */
export interface Text {
  type: 'text'
  value: string
}

export interface Emphasis {
  type: 'emphasis'
  children: Inline[]
}

export interface Strong {
  type: 'strong'
  children: Inline[]
}

/** GitHub strikethrough: ~~text~~. */
export interface Delete {
  type: 'delete'
  children: Inline[]
}

export interface InlineCode {
  type: 'inlineCode'
  value: string
}

/** A hard line break: two spaces or a backslash at the end of a line. */
export interface Break {
  type: 'break'
}

export interface Link {
  type: 'link'
  /** As written, after unescaping: check it before linking to it (see safeUrl). */
  url: string
  title?: string
  children: Inline[]
}

export interface Image {
  type: 'image'
  url: string
  title?: string
  /** The description, as plain text. */
  alt: string
}

export interface InlineHtml {
  type: 'inlineHtml'
  value: string
}

export type Node = Root | Block | ListItem | TableRow | TableCell | Inline
export type Parent = Extract<Node, { children: unknown[] }>
