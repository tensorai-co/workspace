import { MemoryFileSystem, MemoryStorage } from '@tensorai-co/workspace/testing'
import { StatusItem, Workspace, type WorkspaceApi } from '@tensorai-co/workspace'
import type { Appearance } from '@tensorai-co/workspace/theme'
import { useState, useSyncExternalStore } from 'react'
import { AppearancePanel } from './AppearancePanel'
import { pretendModel } from './completions'
import { pretendLanguages } from './languages'
import { samples } from './samples'
import { shells } from './shells'

const ROOT = '/playground'
const query = new URLSearchParams(location.search)

/** Files in memory. `?big` adds a folder of 100,000 files; `?delay=1000` makes every call that slow. */
const fs = new MemoryFileSystem(
  {
    ...Object.fromEntries(Object.entries(samples).map(([path, text]) => [`${ROOT}/${path}`, text])),
    ...(query.has('big') ? Object.fromEntries(Array.from({ length: 100_000 }, (_, i) => [`${ROOT}/big/file${i}.ts`, ''])) : {}),
  },
  { delay: Number(query.get('delay') ?? 0) },
)

/** A pretend shell, or real ones with `npm run playground:shell`. Made once, so terminals outlive a hidden panel. */
const host = shells(fs, ROOT)

/** Ghost text from a pretend model that repeats what's in the sample files. `?nocomplete` turns it off. */
const completions = query.has('nocomplete') ? undefined : pretendModel(samples)

/** Completions, hovers, problems and definitions from a pretend language service. `?nolanguages` turns it off. */
const languages = query.has('nolanguages') ? undefined : pretendLanguages(fs)

/** `?check` is the layout check's: nothing kept, and the secondary side bar open. */
const checking = query.has('check')

/** Reading localStorage can throw, in a private window for instance. */
const storage = checking ? new MemoryStorage() : {
  getItem(key: string) {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem(key: string, value: string) {
    try {
      localStorage.setItem(key, value)
    } catch {
      // Nowhere to keep it.
    }
  },
}

/** The secondary side bar's content here: every command and its key, to try them. */
function Commands({ api }: { api: WorkspaceApi | null }) {
  useSyncExternalStore(api?.commands.subscribe ?? (() => () => {}), () => api?.commands.version ?? 0)
  if (!api) return null
  return (
    <ul className="commands">
      {api.commands
        .list()
        .filter((c) => c.category)
        .map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => void api.commands.execute(c.id)} title={c.id}>
              <span>
                {c.category}: {c.title}
              </span>
              <kbd>{api.commands.keyLabel(c.id)}</kbd>
            </button>
          </li>
        ))}
    </ul>
  )
}

/** The appearance picked in its view, kept between visits. */
function savedAppearance(): Appearance {
  try {
    return JSON.parse(storage.getItem('playground.appearance') ?? '{}') as Appearance
  } catch {
    return {}
  }
}

/** The whole IDE from this repo's pieces, over files in memory. */
export function App() {
  const [api, setApi] = useState<WorkspaceApi | null>(null)
  const [appearance, setAppearance] = useState<Appearance>(() => (checking ? {} : savedAppearance()))
  const changeAppearance = (next: Appearance) => {
    setAppearance(next)
    storage.setItem('playground.appearance', JSON.stringify(next))
  }
  return (
    <Workspace
      fs={fs}
      root={ROOT}
      terminals={host}
      completions={completions}
      languages={languages}
      appearance={appearance}
      views={[{ id: 'appearance', title: 'Appearance', icon: 'settings-gear', content: <AppearancePanel value={appearance} onChange={changeAppearance} /> }]}
      storage={storage}
      storageKey="playground"
      initialFiles={[`${ROOT}/src/App.tsx`, `${ROOT}/src/server.ts`, `${ROOT}/README.md`]}
      expanded={[`${ROOT}/src`]}
      initialLayout={checking ? { auxiliaryBar: true } : undefined}
      auxiliaryBar={{ title: 'Commands', content: <Commands api={api} /> }}
      slots={{ statusLeft: <StatusItem kind="remote" icon="remote" text="Playground" tooltip="Files in memory" /> }}
      onReady={(ready) => {
        setApi(ready)
        // For checks from the browser console.
        Object.assign(window, { workspace: ready, fs, completions, languages })
      }}
    />
  )
}
