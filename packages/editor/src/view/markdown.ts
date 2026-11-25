import { parse, safeUrl, type Block, type Inline } from '@tensorai-workspace/markdown-parser'
import { grammarOf, languageById, loadGrammar, paintLine, Tokenizer } from '@tensorai-workspace/languages'
import { Text } from '@tensorai-workspace/text'

/**
 * Markdown from a language service in hovers and suggestion docs: paragraphs, lists, emphasis,
 * links, inline code, and code blocks colored as the editor colors code. HTML shows as text; nothing runs.
 * `language` colors fences that don't name one.
 */
export function renderMarkdown(source: string, language?: string): HTMLDivElement {
  const root = document.createElement('div')
  root.className = 'ws-rendered-markdown ws-syntax'
  for (const block of parse(source).children) root.append(renderBlock(block, language))
  return root
}

function renderBlock(block: Block, language: string | undefined): Node {
  switch (block.type) {
    case 'paragraph':
      return withInlines(document.createElement('p'), block.children)
    case 'heading':
      return withInlines(document.createElement(`h${block.depth}`), block.children)
    case 'thematicBreak':
      return document.createElement('hr')
    case 'blockquote': {
      const el = document.createElement('blockquote')
      for (const child of block.children) el.append(renderBlock(child, language))
      return el
    }
    case 'list': {
      const el = document.createElement(block.ordered ? 'ol' : 'ul')
      if (block.ordered && block.start !== undefined && block.start !== 1) el.setAttribute('start', String(block.start))
      for (const item of block.children) {
        const li = document.createElement('li')
        for (const child of item.children) li.append(child.type === 'paragraph' && !block.spread ? withInlines(document.createElement('span'), child.children) : renderBlock(child, language))
        el.append(li)
      }
      return el
    }
    case 'code':
      return renderCode(block.value.replace(/\n$/, ''), block.lang ?? language)
    case 'html': {
      const el = document.createElement('p')
      el.textContent = block.value
      return el
    }
    case 'table': {
      const el = document.createElement('table')
      block.children.forEach((row, r) => {
        const tr = document.createElement('tr')
        for (const cell of row.children) tr.append(withInlines(document.createElement(r ? 'td' : 'th'), cell.children))
        el.append(tr)
      })
      return el
    }
  }
}

function withInlines<T extends HTMLElement>(el: T, inlines: readonly Inline[]): T {
  for (const inline of inlines) el.append(renderInline(inline))
  return el
}

function renderInline(inline: Inline): Node {
  switch (inline.type) {
    case 'text':
      return document.createTextNode(inline.value)
    case 'emphasis':
      return withInlines(document.createElement('em'), inline.children)
    case 'strong':
      return withInlines(document.createElement('strong'), inline.children)
    case 'delete':
      return withInlines(document.createElement('del'), inline.children)
    case 'inlineCode': {
      const el = document.createElement('code')
      el.textContent = inline.value
      return el
    }
    case 'break':
      return document.createElement('br')
    case 'link': {
      const url = safeUrl(inline.url)
      if (!url) return withInlines(document.createElement('span'), inline.children)
      const a = withInlines(document.createElement('a'), inline.children)
      a.href = url
      a.target = '_blank'
      a.rel = 'noreferrer noopener'
      if (inline.title) a.title = inline.title
      return a
    }
    case 'image':
      return document.createTextNode(inline.alt)
    case 'inlineHtml':
      return document.createTextNode(inline.value)
  }
}

/** A code block in the editor's colors; plain until its grammar loads. */
function renderCode(code: string, lang: string | undefined): HTMLElement {
  const el = document.createElement('div')
  el.className = 'ws-rendered-code'
  el.textContent = code
  const info = lang ? languageById(lang) : undefined
  if (!info?.grammar) return el
  const paint = () => {
    const grammar = grammarOf(info)
    if (!grammar) return false
    el.textContent = ''
    new Tokenizer(Text.of(code), grammar).all().forEach((tokens, i) => {
      if (i) el.append('\n')
      for (const run of paintLine(tokens)) {
        if (!run.className) {
          el.append(run.text)
          continue
        }
        const span = document.createElement('span')
        span.className = run.className
        span.textContent = run.text
        el.append(span)
      }
    })
    return true
  }
  if (!paint()) void loadGrammar(info).then(paint, () => {})
  return el
}
