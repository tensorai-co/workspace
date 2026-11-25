import type { Grammar } from '../../engine/grammar.js'
import { words } from '../../language.js'

const DIAGRAMS = words(`
  graph flowchart sequenceDiagram classDiagram classDiagram-v2 stateDiagram stateDiagram-v2
  erDiagram gantt pie journey gitGraph mindmap timeline quadrantChart requirementDiagram C4Context
  sankey-beta xychart-beta block-beta packet-beta architecture-beta kanban
`)
const KEYWORDS = words(`
  subgraph end direction participant actor as note over left of right loop alt else opt par and
  critical break rect activate deactivate autonumber class classDef style linkStyle click call
  callback title section dateFormat axisFormat excludes todayMarker state commit branch checkout
  merge cherry-pick showData accTitle accDescr interface namespace TD TB BT RL LR
`)

// Mermaid diagrams, shown as their source.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /%%\{.*\}%%/, token: 'meta' }, // %%{init: …}%%
      { match: /%%.*/, token: 'comment' },
      { match: /"[^"\n]*"?/, token: 'string' },
      // A name: dashes join words (stateDiagram-v2), but never start an arrow.
      { match: /[A-Za-z_]\w*(?:-(?![->.=])\w+)*/, token: (t) => (DIAGRAMS.has(t) || KEYWORDS.has(t) ? 'keyword' : undefined) },
      // A node's shape and label: A[label], B(label), C{label}, D((label)), E>label]
      { match: /(\(\(|\[\[|\[\(|\(\[|\{\{|\[\/|\[\\|[[({>])([^\]){}|\n]*)(\)\)|\]\]|\)\]|\]\)|\}\}|\/\]|\\\]|[\]})])/, groups: ['punctuation', 'string', 'punctuation'] },
      { match: /\|[^|\n]*\|/, token: 'string' }, // -->|label|
      // Arrows and links: ->> -->> -x -) --> --- -.-> ==> --o <|-- *-- ..>
      { match: /(?:<<)?--?>>|--?[x)]|<?[-.=~]{2,}[>xo]?|<?[-.]+[>)x]{1,2}|<\|--|--\|>|[*o]--|--[*o]|\.\.>|<\.\.|\|\|--o\{|\}o--\|\||[|}][|o]--[|o][|{]/, token: 'operator' },
      { match: /(:)(.*)/, groups: ['punctuation', 'string'] }, // a message or label after :
      { match: /-?\d+(?:\.\d+)?%?/, token: 'number' },
      { match: /[;,&]/, token: 'punctuation' },
      { match: /[^\s\w"%[\](){}|<>:;,&-]+|./ },
    ],
  },
}
