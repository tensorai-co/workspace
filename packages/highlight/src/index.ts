// The tokenizer and the grammars: plain TypeScript, no DOM.

export type { Embed, Grammar, Matcher, Resolve, Rule } from './engine/grammar.js'
export { MAX_LINE_LENGTH, MAX_LINES, Session, tokenize, tokenizeLine, type State } from './engine/tokenizer.js'
export { lengthAt, words, type Language } from './language.js'
export { COMMON, loadCommon } from './languages/common.js'
export { LANGUAGES, loadedLanguage, loadLanguage, resolveGrammar, resolveLanguage, type LanguageEntry, type LanguageId } from './languages/index.js'
export { TOKEN_TYPES, type Token, type TokenType } from './tokens.js'
