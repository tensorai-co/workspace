// The Markdown parser: CommonMark with GitHub's tables, task lists, strikethrough and autolinks. No DOM.

export type * from './ast.js'
export { MAX_DEPTH, MAX_PADDED_CELLS } from './blocks.js'
export { MAX_LENGTH, parse, type ParseOptions } from './parse.js'
export { encodeUrl, safeUrl } from './url.js'
