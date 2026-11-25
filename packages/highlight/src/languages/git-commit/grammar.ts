import type { Grammar } from '../../engine/grammar.js'

// A commit message: its subject line, the body, trailers, and git's
// # comments (with the changes it lists).
export const grammar: Grammar = {
  states: {
    // The first line is the subject; past 72 characters it's too long.
    root: [
      { match: /#.*/, token: 'comment', after: (p) => p === undefined },
      { match: /(\w+)((?:\([^)\n]*\))?)(!?)(:)(?=\s)/, groups: ['keyword', 'type', 'operator', 'punctuation'], after: (p) => p === undefined }, // feat(api)!:
      { match: (line, pos) => (pos < 72 ? Math.min(line.length, 72) - pos || -1 : -1), token: 'property', next: 'body' },
      { match: /.+/, token: 'deleted', next: 'body' },
      { match: /$/, next: 'body' },
    ],
    body: [
      { match: /(#\s*)((?:modified|new file|deleted|renamed|copied|typechange):)(\s+)(.*)/, groups: ['comment', 'comment', 'comment', 'meta'], after: (p) => p === undefined },
      { match: /#.*/, token: 'comment', after: (p) => p === undefined },
      { match: /(BREAKING[ -]CHANGE|[A-Z][\w-]*(?:-by|-to)?)(:)(\s.*)/, groups: ['property', 'punctuation', 'string'], after: (p) => p === undefined }, // Signed-off-by: …
      { match: /(?:[\w.-]+\/[\w.-]+)?#\d+|\b[\da-f]{7,40}\b/, token: 'constant' }, // #42, a commit hash
      { match: /`[^`\n]*`/, token: 'string' },
      { match: /[^#`\d\w]+|[\w-]+|./ },
    ],
  },
}
