import '@tensorai-workspace/theme/styles.css'
import '@tensorai-workspace/editor/styles.css'
import '@tensorai-workspace/explorer/styles.css'
import '@tensorai-workspace/terminal/styles.css'
import './layout.css'
import '@tensorai-workspace/markdown/styles.css'
import '@tensorai-workspace/split/styles.css'
import '@tensorai-workspace/tabs/styles.css'
import { Explorer, type ExplorerModel } from '@tensorai-workspace/explorer'
import { Codicon, FileIcon } from '@tensorai-workspace/icons/react'
import { MarkdownPreview } from '@tensorai-workspace/markdown'
import { Pane, Split } from '@tensorai-workspace/split'
import { TabAction, TabsModel, TabStrip } from '@tensorai-workspace/tabs'
import { TerminalPanel, Terminals } from '@tensorai-workspace/terminal'
import { MemoryFileSystem, ScriptedTerminalHost } from '@tensorai-workspace/testing'
import { createRoot } from 'react-dom/client'
import { check } from './check'
import { markdown } from './markdown'
import type { Result } from './measure'
import { files } from './reference'

// Measures the components against the reference values, in this browser. The page must have the focus, or :focus styles don't
// apply: it waits for that. Keep the pointer off the tree while it runs.

let model: ExplorerModel | null = null
const fs = new MemoryFileSystem(files)

const tabs = new TabsModel<string>((name) => name)
for (const name of ['[Preview] README.md', 'Cargo.toml']) tabs.open(name)
tabs.open('LICENSE', { preview: true })

const terminals = new Terminals(new ScriptedTerminalHost({ name: 'bash', output: '$ ' }))

/** The pieces the check measures besides the explorer. */
const pieces = (line: number) => (
  <>
    <div id="check-tabs">
      <TabStrip
        model={tabs}
        label="Tabs"
        describe={(tab) => ({ label: tab.id, icon: tab.id.startsWith('[Preview]') ? <Codicon name="preview" className="ws-preview-icon" /> : <FileIcon name={tab.id} /> })}
        actions={
          <>
            <TabAction icon="open-preview" label="Preview" onClick={() => {}} />
            <TabAction icon="preview" label="Preview" onClick={() => {}} />
            <TabAction icon="split-horizontal" label="Split" onClick={() => {}} />
            <TabAction icon="ellipsis" label="More" onClick={() => {}} />
          </>
        }
      />
    </div>
    <div id="check-gaps">
      <Split direction="row" gap={4}>
        <Pane id="a" size={170} />
        <Pane id="b" grow />
      </Split>
    </div>
    <div id="check-terminal">
      <TerminalPanel terminals={terminals} actions={<TabAction icon="close" label="Hide" onClick={() => {}} />} />
    </div>
    <div id="check-markdown">
      <MarkdownPreview text={markdown} activeLine={line} />
    </div>
    <div id="check-lines">
      <Split direction="row">
        <Pane id="a" />
        <Pane id="b" />
      </Split>
    </div>
  </>
)

const root = createRoot(document.getElementById('root')!)

const page = (results: Result[] | undefined, line = 9) => (
  <div className="check">
    <div className="check-explorer">
      <Explorer fs={fs} root="/" title="ui" expanded={['/crates', '/crates/ui']} onModel={(m) => (model = m)} />
    </div>
    <main className="check-results">
      {!results ? (
        <p>Measuring… (click here if nothing happens)</p>
      ) : (
        <>
          <h1>
            {results.filter((r) => r.ok).length} of {results.length} match
          </h1>
          <table>
            <tbody>
              {results
                .filter((r) => !r.ok)
                .map((r) => (
                  <tr key={r.what}>
                    <th>{r.what}</th>
                    <td>reference: {r.expected}</td>
                    <td>Ours: {r.actual}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </>
      )}
      {pieces(line)}
    </main>
  </div>
)

root.render(page(undefined))
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
while (!(model as ExplorerModel | null)?.tree.rows.some((n) => n.id === '/crates/ui/Cargo.toml')) await wait(20)
while (!document.hasFocus()) await wait(100)
const results = await check(model!, terminals, (line) => root.render(page(undefined, line)))
Object.assign(window, { results })
root.render(page(results))
