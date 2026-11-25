import type { Grammar } from '../../engine/grammar.js'
import { lengthAt, words } from '../../language.js'

const INSTRUCTIONS = words(`
  ADD ARG CMD COPY ENTRYPOINT ENV EXPOSE FROM HEALTHCHECK LABEL MAINTAINER ONBUILD RUN SHELL
  STOPSIGNAL USER VOLUME WORKDIR
`)

/** Instructions whose arguments are KEY=value pairs. */
const KEYED = words('ARG ENV LABEL')
const KEY = /[A-Za-z_][\w.-]*(?==)/y
const COMMENT = /#.*/y

// A Dockerfile: one instruction per line, continued with a trailing \.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      // Parser directives come first: # syntax=docker/dockerfile:1
      { match: /#\s*(?:syntax|escape|check)\s*=.*/i, token: 'meta', after: (p) => p === undefined },
      { match: /#.*/, token: 'comment', after: (p) => p === undefined },
      { match: /[A-Za-z]+(?=\s|$)/, token: (t) => (INSTRUCTIONS.has(t.toUpperCase()) ? 'keyword' : undefined), push: (t) => `arguments/${t.toUpperCase()}`, after: (p) => p === undefined },
      { match: /\S+/ },
    ],
    // An instruction's arguments, to the end of the line or past a \. The state's argument is the instruction.
    arguments: [
      { match: /\\$/, token: 'escape' },
      { match: (line, pos) => (pos === line.length && !/\\$/.test(line) ? 0 : -1), pop: true },
      // A comment line inside a continued instruction.
      { match: (line, pos) => (line.search(/\S|$/) >= pos ? lengthAt(COMMENT, line, pos) : -1), token: 'comment' },
      { match: /\s+/ },
      { match: /--[\w-]+(?:=)?/, token: 'property' }, // --from=build, --mount=type=cache
      { match: /(?<=\s|^)(?:AS|as)(?=\s)/, token: 'keyword' },
      { match: /(?<=\s)(?:CMD)(?=\s)/, token: 'keyword' }, // HEALTHCHECK … CMD
      { match: /"/, token: 'string', push: 'double' },
      { match: /'[^'\n]*'?/, token: 'string' },
      { match: /\$\{[^}\n]*\}|\$[A-Za-z_]\w*/, token: 'variable' },
      // ENV KEY=value, ARG NAME=default, LABEL key=value
      { match: (line, pos, instruction) => (KEYED.has(instruction) ? lengthAt(KEY, line, pos) : -1), token: 'variable' },
      { match: /&&|\|\||[|;=<>]/, token: 'operator' },
      { match: /[[\],]/, token: 'punctuation' },
      { match: /\d+(?:\.\d+)?(?:\/(?:tcp|udp))?(?=\s|$)/, token: 'number' },
      { match: /[^\s"'$\\&|;=<>[\],]+|[$\\&]/ },
    ],
    double: [
      { match: /[^"\\$]+/, token: 'string' },
      { match: /\\./, token: 'escape' },
      { match: /\$\{[^}\n]*\}|\$[A-Za-z_]\w*/, token: 'variable' },
      { match: /\\$|\$/, token: 'string' },
      { match: /"/, token: 'string', pop: true },
    ],
  },
}
