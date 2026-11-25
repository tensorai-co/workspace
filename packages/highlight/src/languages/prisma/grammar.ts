import type { Grammar } from '../../engine/grammar.js'
import { words } from '../../language.js'

const SCALARS = words('String Boolean Int BigInt Float Decimal DateTime Json Bytes Unsupported')

// Prisma schemas: datasources, generators, models, enums and their fields.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /(model|enum|type|view|datasource|generator)(\s+)([A-Za-z_]\w*)/, groups: ['keyword', undefined, 'type'] },
      { match: /@@?[\w.]+/, token: 'meta' }, // @id, @@index, @db.VarChar
      { match: /"(?:[^"\\\n]|\\.)*"?/, token: 'string' },
      // A field: name Type? @attributes, or a setting: name = value
      { match: /([A-Za-z_]\w*)(\s+)([A-Z]\w*)(\[\])?(\?)?/, groups: ['property', undefined, 'type', 'punctuation', 'operator'], after: (p) => p === undefined || p.text === '{' },
      { match: /[A-Za-z_]\w*(?=\s*=)/, token: 'property', after: (p) => p === undefined || p.text === '{' || p.text === ',' || p.text === '(' },
      { match: /[A-Za-z_]\w*(?=\s*:)/, token: 'property' }, // fields: [a], onDelete: Cascade
      { match: /[A-Za-z_]\w*(?=\()/, token: 'function' }, // autoincrement(), now(), env()
      { match: /true|false|null/, token: 'constant' },
      { match: /[A-Z]\w*/, token: (t) => (SCALARS.has(t) ? 'builtin' : 'type') },
      { match: /[A-Za-z_]\w*/ },
      { match: /-?\d+(?:\.\d+)?/, token: 'number' },
      { match: /[=?:]/, token: 'operator' },
      { match: /[()[\]{},.]/, token: 'punctuation' },
    ],
  },
}
