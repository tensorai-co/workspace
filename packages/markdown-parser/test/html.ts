// A test-only HTML renderer, matching the output of CommonMark's reference
// renderer, so parse() can be checked against the spec's examples. The
// package itself never builds HTML.

import type { Block, Inline, ListItem, Root, Table } from '../src/ast.js'

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

export function toHtml(root: Root): string {
  const r = new Renderer()
  for (const b of root.children) r.block(b, false)
  return r.out
}

class Renderer {
  out = ''

  private cr(): void {
    if (this.out !== '' && !this.out.endsWith('\n')) this.out += '\n'
  }

  block(b: Block, tight: boolean): void {
    switch (b.type) {
      case 'paragraph':
        if (tight) {
          this.inlines(b.children)
          return
        }
        this.cr()
        this.out += '<p>'
        this.inlines(b.children)
        this.out += '</p>'
        this.cr()
        return
      case 'heading':
        this.cr()
        this.out += `<h${b.depth}>`
        this.inlines(b.children)
        this.out += `</h${b.depth}>`
        this.cr()
        return
      case 'thematicBreak':
        this.cr()
        this.out += '<hr />'
        this.cr()
        return
      case 'blockquote':
        this.cr()
        this.out += '<blockquote>'
        this.cr()
        for (const c of b.children) this.block(c, false)
        this.cr()
        this.out += '</blockquote>'
        this.cr()
        return
      case 'list': {
        const tag = b.ordered ? 'ol' : 'ul'
        this.cr()
        this.out += b.ordered && b.start !== undefined && b.start !== 1 ? `<ol start="${b.start}">` : `<${tag}>`
        this.cr()
        for (const item of b.children) this.item(item, !b.spread)
        this.cr()
        this.out += `</${tag}>`
        this.cr()
        return
      }
      case 'code':
        this.cr()
        this.out += b.lang ? `<pre><code class="language-${escape(b.lang)}">` : '<pre><code>'
        this.out += escape(b.value)
        this.out += '</code></pre>'
        this.cr()
        return
      case 'html':
        this.cr()
        this.out += b.value
        this.cr()
        return
      case 'table':
        this.table(b)
        return
    }
  }

  private item(item: ListItem, tight: boolean): void {
    this.out += '<li>'
    for (const c of item.children) this.block(c, tight)
    this.out += '</li>'
    this.cr()
  }

  private table(t: Table): void {
    const cell = (tag: string, i: number, children: Inline[]) => {
      const a = t.align[i]
      this.out += a ? `<${tag} align="${a}">` : `<${tag}>`
      this.inlines(children)
      this.out += `</${tag}>\n`
    }
    const [head, ...body] = t.children
    this.cr()
    this.out += '<table>\n<thead>\n<tr>\n'
    head!.children.forEach((c, i) => cell('th', i, c.children))
    this.out += '</tr>\n</thead>\n'
    if (body.length > 0) {
      this.out += '<tbody>\n'
      for (const row of body) {
        this.out += '<tr>\n'
        row.children.forEach((c, i) => cell('td', i, c.children))
        this.out += '</tr>\n'
      }
      this.out += '</tbody>\n'
    }
    this.out += '</table>\n'
  }

  private inlines(nodes: Inline[]): void {
    for (const n of nodes) {
      switch (n.type) {
        case 'text':
          this.out += escape(n.value)
          break
        case 'inlineCode':
          this.out += `<code>${escape(n.value)}</code>`
          break
        case 'inlineHtml':
          this.out += n.value
          break
        case 'break':
          this.out += '<br />\n'
          break
        case 'emphasis':
        case 'strong':
        case 'delete': {
          const tag = { emphasis: 'em', strong: 'strong', delete: 'del' }[n.type]
          this.out += `<${tag}>`
          this.inlines(n.children)
          this.out += `</${tag}>`
          break
        }
        case 'link':
          this.out += `<a href="${escape(n.url)}"${n.title ? ` title="${escape(n.title)}"` : ''}>`
          this.inlines(n.children)
          this.out += '</a>'
          break
        case 'image':
          this.out += `<img src="${escape(n.url)}" alt="${escape(n.alt)}"${n.title ? ` title="${escape(n.title)}"` : ''} />`
          break
      }
    }
  }
}
