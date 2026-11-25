import { createElement, memo, useContext, type ReactNode } from 'react'
import type { ViewElement, ViewNode } from '../core/nodes.js'
import { Highlighted } from '@tensorai-co/workspace/languages/react'
import { CopyButton } from './Code.js'
import { Preview } from './context.js'
import { Image, Link } from './Media.js'

const PROPS: Record<string, string> = { colspan: 'colSpan', rowspan: 'rowSpan', datetime: 'dateTime', valign: 'vAlign' }
const FLAGS = new Set(['open', 'reversed', 'checked'])

function propsOf(node: ViewElement): Record<string, unknown> {
  const props: Record<string, unknown> = {}
  for (const [name, value] of Object.entries(node.attrs ?? {})) props[PROPS[name] ?? name] = FLAGS.has(name) ? true : value
  if (node.anchor !== undefined) props['data-anchor'] = node.anchor
  const classes: string[] = []
  if (node.frontMatter) classes.push('ws-md-front')
  if (node.checked !== undefined) classes.push('ws-md-task')
  if (node.line !== undefined && !node.frontMatter) {
    classes.push('ws-md-line')
    props.dir ??= 'auto'
    Object.assign(props, lineProps(node))
  }
  if (classes.length) props.className = classes.join(' ')
  return props
}

const lineProps = (node: ViewElement) => ({ 'data-line': node.line, 'data-end-line': node.endLine })

export function renderNodes(nodes: ViewNode[]): ReactNode[] {
  return nodes.map((node, i) => (typeof node === 'string' ? node : renderNode(node, i)))
}

function renderNode(node: ViewElement, key: number): ReactNode {
  if (node.code) return <CodeBlock key={key} node={node} />
  const props = propsOf(node)
  switch (node.tag) {
    case 'a':
      if (node.attrs?.href !== undefined) {
        return (
          <Link key={key} {...props} href={node.attrs.href}>
            {renderNodes(node.children)}
          </Link>
        )
      }
      break
    case 'img':
      return <Image key={key} {...props} src={node.attrs?.src ?? ''} />
    case 'input':
      return <input key={key} {...props} disabled readOnly />
  }
  // Void elements must have no children at all.
  return node.children.length ? createElement(node.tag, { ...props, key }, ...renderNodes(node.children)) : createElement(node.tag, { ...props, key })
}

/** One of the document's own blocks: drawn again only when it's a different one. */
export const Block = memo(function Block({ node }: { node: ViewElement }) {
  return renderNode(node, 0)
})

function CodeBlock({ node }: { node: ViewElement }) {
  const { clipboard } = useContext(Preview)
  const { text, lang, fenced } = node.code!
  const line = { className: 'ws-md-line', dir: 'auto', ...lineProps(node) }
  // A fenced block's code has its line; an indented one's block has it.
  return (
    <pre className={node.frontMatter ? 'ws-md-front' : undefined} {...(!fenced && line)}>
      <code {...(fenced && !node.frontMatter && line)}>
        <Highlighted text={text} language={lang} />
      </code>
      <CopyButton text={text} clipboard={clipboard} />
    </pre>
  )
}
