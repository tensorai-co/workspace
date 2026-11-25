/** Sample files for the playground: one per kind of language the editor is checked with, and enough folders for a tree. */
export const samples: Record<string, string> = {
  'src/App.tsx': `import { useState, type ReactNode } from 'react'
import { Button } from './Button'

/** A counter, to try typing, auto-closing and JSX tags. */
export function App({ title, children }: { title: string; children?: ReactNode }) {
  const [count, setCount] = useState(0)
  const label = \`Clicked \${count} times\`

  // Try: type <div> and press Enter between the tags.
  return (
    <main className="app">
      <h1>{title}</h1>
      <Button onClick={() => setCount((n) => n + 1)} disabled={count >= 10}>
        {label}
      </Button>
      {children}
    </main>
  )
}

export default App
`,
  'src/server.ts': `import { createServer } from 'node:http'

const PORT = Number(process.env.PORT ?? 3000)

interface Route {
  method: 'GET' | 'POST'
  path: RegExp
  handle(url: URL): Promise<string>
}

const routes: Route[] = [
  { method: 'GET', path: /^\\/health$/, handle: async () => 'ok' },
]

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', \`http://localhost:\${PORT}\`)
  const route = routes.find((r) => r.method === req.method && r.path.test(url.pathname))
  res.end(route ? await route.handle(url) : 'not found')
}).listen(PORT)

// TODO: log requests
console.log(\`Listening on \${PORT}\`)
`,
  'src/main.rs': `use std::collections::HashMap;

/// Counts words in a line of text.
fn count_words(text: &str) -> HashMap<&str, usize> {
    let mut counts = HashMap::new();
    for word in text.split_whitespace() {
        *counts.entry(word).or_insert(0) += 1;
    }
    counts
}

fn main() {
    let counts = count_words("the quick brown fox jumps over the lazy dog");
    println!("{:?}", counts.get("the"));
}
`,
  'styles.css': `.app {
  display: grid;
  gap: 8px;
  padding: 16px 24px;
  font-family: system-ui, sans-serif;
}

.app h1 {
  margin: 0;
  font-size: 20px; /* editor-sized */
  color: #202020;
}
`,
  'Cargo.toml': `[package]
name = "demo"
version = "0.1.0"
edition = "2024"

[dependencies]
serde = { version = "1", features = ["derive"] }
`,
  'README.md': `---
title: Playground
tags: [editor, preview]
---

# Playground

![The logo](docs/logo.svg)

The editor, **on its own**, with *sample* files. Open this file's preview with \`⇧⌘V\`, or beside it with \`⌘K V\`: the
two scroll together, and the block the cursor is in has a mark next to it.

## Keys

| Keys         | What they do             | Where    |
| ------------ | ------------------------ | :------: |
| \`⌘D\`         | Selects the next match   | Editor   |
| \`⌥↑\`         | Moves a line up          | Editor   |
| \`⌘\\\`         | Splits the editor        | Anywhere |

## What to try

- **Tabs** switch files. Drag one onto another group.
- Links:
  - to a file: [the app](src/App.tsx), and [line 7 of it](src/App.tsx#L7)
  - to a heading: [Keys](#keys), or [in another file](docs/guide/getting-started.md#next)
  - to the web: <https://example.com>
- [x] A finished task
- [ ] One that isn't

1. Edit this file.
2. Watch the preview follow.

> A quote, with \`code\` in it.
>
> > And another inside.

### Code

\`\`\`tsx
export function Button({ label }: { label: string }) {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>{label}: {count}</button>
}
\`\`\`

\`\`\`python
def words(text: str) -> dict[str, int]:
    """Counts words."""
    return Counter(text.split())
\`\`\`

    Indented code has no language.

#### HTML

<details>
<summary>Closed until it's clicked</summary>

Press <kbd>⌘</kbd> <kbd>S</kbd> to save. H<sub>2</sub>O, x<sup>2</sup>.

</details>

<p align="center">In the middle</p>

---

That's ~~everything~~ it.
`,
  'src/Button.tsx': `import type { ComponentProps } from 'react'

export function Button(props: ComponentProps<'button'>) {
  return <button type="button" {...props} />
}
`,
  'src/hooks/useInterval.ts': `import { useEffect } from 'react'

export function useInterval(run: () => void, ms: number) {
  useEffect(() => {
    const timer = setInterval(run, ms)
    return () => clearInterval(timer)
  }, [run, ms])
}
`,
  'src/hooks/useToggle.ts': `import { useState } from 'react'

export const useToggle = (on = false) => {
  const [value, set] = useState(on)
  return [value, () => set((v) => !v)] as const
}
`,
  'test/App.test.tsx': `import { expect, it } from 'vitest'

it('adds', () => expect(1 + 1).toBe(2))
`,
  'docs/guide/getting-started.md': '# Getting started\n\nInstall, then run.\n\n![The logo](../logo.svg)\n\n## Next\n\nGo [back](../../README.md).\n',
  'docs/guide/themes.md': '# Themes\n',
  'docs/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="48" viewBox="0 0 96 48"><rect width="96" height="48" rx="8" fill="#0069cc" /><circle cx="24" cy="24" r="12" fill="#fff" /><rect x="48" y="18" width="36" height="12" rx="6" fill="#fff" /></svg>\n',
  'scripts/build.sh': '#!/bin/sh\nset -e\nnpm run build\n',
  'scripts/release.py': 'import sys\n\nprint(sys.argv[1:])\n',
  '.gitignore': 'node_modules\ndist\n',
  LICENSE: 'MIT License\n',
  'index.html': '<!doctype html>\n<title>App</title>\n<div id="root"></div>\n',
  'package.json': '{\n  "name": "app",\n  "private": true\n}\n',
  'tsconfig.json': '{\n  "compilerOptions": { "strict": true }\n}\n',
}
