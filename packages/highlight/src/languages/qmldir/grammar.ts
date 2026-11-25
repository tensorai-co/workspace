import type { Grammar } from '../../engine/grammar.js'
import { words } from '../../language.js'

const COMMANDS = words('module plugin optional classname typeinfo depends import designersupported linktarget prefer internal singleton default')

// qmldir: a QML module's file, one command per line: module, plugin,
// and types with their versions and files.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /#.*/, token: 'comment' },
      { match: /(module|depends|import)(\s+)([\w.]+)/, groups: ['keyword', undefined, 'type'] },
      { match: /[\w./-]+\.(?:qml|js|mjs|qmltypes|so|dll|dylib)\b/, token: 'string' }, // a file
      { match: /[a-z]+/, token: (t) => (COMMANDS.has(t) ? 'keyword' : undefined) },
      { match: /[A-Z]\w*/, token: 'type' }, // a type: Button
      { match: /\d+(?:\.\d+)?|auto/, token: 'number' }, // a version
      { match: /[\w.]+/ },
    ],
  },
}
