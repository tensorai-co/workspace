// The shape of the language definitions in data/languages.ts.

/** A regular expression as the definitions write it: its source, and its flags. */
export interface RegexSource {
  source: string
  flags?: string
}

export interface Pair {
  open: string
  close: string
  /** Token kinds where the pair doesn't auto-close, such as "string" or "comment". */
  notIn?: string[]
}

export interface OnEnterRule {
  beforeText?: RegexSource
  afterText?: RegexSource
  previousLineText?: RegexSource
  action: { indent: 'none' | 'indent' | 'indentOutdent' | 'outdent'; appendText?: string; removeText?: number }
}

/** One language's editing rules, as in its language-configuration.json. */
export interface LanguageConfiguration {
  lineComment?: string
  blockComment?: { open: string; close: string }
  brackets?: { open: string; close: string }[]
  autoClosingPairs?: Pair[]
  surroundingPairs?: Pair[]
  autoCloseBefore?: string
  wordPattern?: RegexSource
  indentationRules?: {
    increaseIndentPattern?: RegexSource
    decreaseIndentPattern?: RegexSource
    indentNextLinePattern?: RegexSource
    unIndentedLinePattern?: RegexSource
  }
  onEnterRules?: OnEnterRule[]
  folding?: { start?: RegexSource; end?: RegexSource; offSide?: boolean }
}

/** One language: its id, the files it claims, and its rules. */
export interface LanguageDefinition {
  id: string
  aliases?: string[]
  extensions?: string[]
  filenames?: string[]
  filenamePatterns?: string[]
  firstLine?: string
  rules?: LanguageConfiguration
}
