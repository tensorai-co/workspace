// The token types grammars emit. The list is fixed: a grammar can't invent
// one, and each maps to one CSS class (tl-keyword…) that styles.css colors.

export const TOKEN_TYPES = [
  'keyword', // if, def, func, return
  'string', // "text", 'c', `raw`
  'escape', // \n and interpolation markers inside strings: ${ }, { } in f-strings
  'number', // 42, 0xff, 1e-3
  'comment', // # and // and /* */
  'function', // a name being defined or called
  'type', // a class or type name
  'constant', // true, None, nil, iota
  'builtin', // print, len, console, echo
  'variable', // self, this, $HOME
  'property', // a JSON key, obj.field
  'tag', // <div>, </item>: markup's element names
  'operator', // + - * / = == => && |
  'punctuation', // ( ) [ ] { } , ; .
  'regexp', // /a+b/g
  'meta', // decorators, shebangs, directives
  'inserted', // a diff's + lines
  'deleted', // a diff's - lines
] as const

export type TokenType = (typeof TOKEN_TYPES)[number]

/** A run of a line's text, and its type. Plain text has no type. */
export interface Token {
  text: string
  type?: TokenType
}
