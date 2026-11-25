import type { Grammar } from '../../engine/grammar.js'
import { lengthAt } from '../../language.js'

/** A space, then the next attribute: href=, :class=. */
const NEXT_ATTRIBUTE = /\s+[\w:@.-]+\s*!?=(?!=)/y

/**
 * argumentEnd finds the , or ) that ends a JavaScript argument, outside
 * any brackets or quotes, or the space before the next attribute; or -1.
 */
function argumentEnd(line: string, from: number): number {
  let depth = 0
  let quote = ''
  for (let i = from; i < line.length; i++) {
    const c = line[i]!
    if (quote) {
      if (c === '\\') i++
      else if (c === quote) quote = ''
    } else if (c === '"' || c === "'" || c === '`') quote = c
    else if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) return i
      depth--
    } else if (c === ',' && depth === 0) return i
    else if (depth === 0 && (c === ' ' || c === '\t') && lengthAt(NEXT_ATTRIBUTE, line, i) > 0) return i
  }
  return -1
}

// Pug (formerly Jade): HTML by indentation. A line starts with a tag,
// .class or #id, then (attributes), then text; = and - lines are JavaScript.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\/-?.*/, token: 'comment', after: (p) => p === undefined },
      { match: /\|/, token: 'punctuation', push: 'text', after: (p) => p === undefined }, // | piped text
      { match: /(?:doctype|extends|include|block|append|prepend|mixin|each|for|while|if|else if|else|unless|case|when|default|yield)\b/, token: 'keyword', push: '@line', after: (p) => p === undefined },
      { match: /(\+[\w-]+)(\()/, groups: ['function', 'punctuation'], push: 'call', after: (p) => p === undefined }, // +mixin(args)
      { match: /\+[\w-]+/, token: 'function', push: 'tag', after: (p) => p === undefined },
      { match: /-/, token: 'meta', push: '@line', after: (p) => p === undefined }, // - unbuffered code
      { match: /!?=/, token: 'meta', push: '@line' }, // = buffered code
      { match: /[A-Za-z][\w:-]*/, token: 'tag', push: 'tag', after: (p) => p === undefined },
      { match: /(?=[.#][\w-])/, push: 'tag', after: (p) => p === undefined },
      { include: 'text' },
    ],
    // After a tag: .class, #id, (attributes), &attributes(…), then text or = code.
    tag: [
      { match: /$/, pop: true },
      { match: /[.#][\w-]+/, token: 'function' },
      { match: /\(/, token: 'punctuation', push: 'attributes' },
      { match: /&attributes/, token: 'keyword' },
      { match: /:\s*/, token: 'punctuation', next: 'root' }, // a: b, nesting on one line
      { match: /\.$/, token: 'punctuation', pop: true },
      { match: /!?=/, token: 'meta', next: '@line' },
      { match: /\s+/, next: 'text' },
    ],
    attributes: [
      { match: /\)/, token: 'punctuation', pop: true },
      { match: /\s+|,/ },
      { match: /([\w:@.-]+)(\s*)(!?=)/, groups: ['property', undefined, 'operator'], push: 'value' },
      { match: /[\w:@.-]+/, token: 'property' },
    ],
    // A mixin's arguments, each JavaScript, to the closing ).
    call: [
      { match: /\)/, token: 'punctuation', pop: true },
      { match: /,/, token: 'punctuation' },
      { match: /(?=[^,)])/, push: '@argument' },
    ],
    // An attribute's value: JavaScript, up to the , or ) after it.
    value: [
      { match: /(?=[,)\s])/, pop: true },
      { match: /(?=.)/, push: '@argument' },
    ],
    text: [
      { match: /$/, pop: true },
      { match: /#\{/, token: 'escape', push: '@interpolation' },
      { match: /\}/, token: 'escape' },
      { match: /#\[/, token: 'escape', push: 'inlineTag' },
      { match: /[^#}]+|#/ },
    ],
    inlineTag: [
      { match: /\]/, token: 'escape', pop: true },
      { match: /[A-Za-z][\w-]*/, token: 'tag' },
      { match: /[.#][\w-]+/, token: 'function' },
      { match: /\(/, token: 'punctuation', push: 'attributes' },
      { match: /[^\]]+/ },
    ],
  },
  embeds: {
    line: { language: 'javascript', end: /$/ },
    argument: { language: 'javascript', end: argumentEnd },
    interpolation: { language: 'javascript', end: /\}/ },
  },
}
