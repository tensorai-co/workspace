import type { Grammar } from '../../engine/grammar.js'

// Log files: timestamps, levels, quoted values, key=value pairs, URLs,
// numbers, IDs, and stack traces.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+at\s.+/, token: 'comment', after: (p) => p === undefined }, // a stack frame:   at a.b(C.java:1)
      { match: /\s+/ },
      // 2024-06-01T12:00:00.123Z, 2024-06-01 12:00:00,123, Jun  1 12:00:00, [01/Jun/2024:12:00:00 +0000]
      { match: /\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?/, token: 'comment' },
      { match: /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}/, token: 'comment' },
      { match: /\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2}(?: [+-]\d{4})?/, token: 'comment' },
      { match: /\d{2}:\d{2}:\d{2}(?:[.,]\d+)?/, token: 'comment' },
      // Levels, by how loud they are.
      { match: /\b(?:FATAL|CRITICAL|CRIT|ALERT|EMERG|ERROR|ERR|SEVERE|Error|Fatal|Exception|PANIC|Traceback)\b/, token: 'deleted' },
      { match: /\b(?:WARNING|WARN|Warning)\b/, token: 'type' },
      { match: /\b(?:INFO|NOTICE|Info)\b/, token: 'function' },
      { match: /\b(?:DEBUG|TRACE|VERBOSE|FINE|Debug)\b/, token: 'comment' },
      { match: /\b[EWIDV](?=\/|\s)/, token: 'meta', after: (p) => !!p && p.type === 'comment' }, // Android's E/Tag
      { match: /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/, token: 'string' },
      { match: /[a-z][\w+.-]*:\/\/[^\s"'<>]+/, token: 'regexp' }, // a URL
      { match: /\b[\da-fA-F]{8}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{12}\b/, token: 'constant' }, // a UUID
      { match: /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/, token: 'number' }, // an IP address
      { match: /([\w.-]+)(=)/, groups: ['property', 'operator'] }, // key=value
      { match: /\b0x[\da-fA-F]+\b|\b[\da-fA-F]{12,}\b/, token: 'constant' }, // hashes, addresses
      { match: /\b\d+(?:\.\d+)?(?:ms|s|m|h|KB|MB|GB|kB|B|%)?\b/, token: 'number' },
      { match: /\b(?:true|false|null|None|nil)\b/, token: 'constant' },
      { match: /\[[^\]\n]*\]/, token: 'meta' }, // [main], [req-42]
      { match: /[A-Za-z_][\w.$]*(?:Exception|Error)\b/, token: 'deleted' },
      { match: /[^\s"'[\]=]+|./ },
    ],
  },
}
