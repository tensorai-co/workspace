import type { Grammar } from '../../engine/grammar.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  report program data types type constants parameters select-options tables field-symbols class
  definition implementation endclass method methods endmethod public private protected section
  inheriting from create object new value ref to of table line key with default empty unique sorted
  standard hashed occurs begin end if elseif else endif case when others endcase do enddo while
  endwhile loop at endloop into where order by group select endselect single up rows insert update
  modify delete append read clear refresh free move write skip uline format exit continue check
  return raise exception try catch endtry cleanup call function perform form endform start-of-selection
  end-of-selection initialization event events importing exporting changing returning receiving
  raising and or not is initial bound assigned supplied in between like eq ne lt le gt ge co cn ca na
  cs ns cp np interface interfaces endinterface final abstract redefinition static class-methods
  class-data me super cast conv corresponding reduce for let base message display field-symbol
  assigning length decimals using components
`)
const TYPES = words('i int8 p f c n d t x string xstring decfloat16 decfloat34 abap_bool utclong')
const CONSTANTS = words('abap_true abap_false space sy-subrc sy-tabix sy-index sy-datum sy-uzeit sy-uname')

// ABAP: SAP's language. Statements end with a period, keywords are any case,
// * comments a whole line and " the rest of one, and |string templates|.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /^\*.*/, token: 'comment' },
      { match: /".*/, token: 'comment' },
      { match: /'(?:[^']|'')*'/, token: 'string' },
      { match: /`(?:[^`]|``)*`/, token: 'string' },
      { match: /\|/, token: 'string', push: 'template' },
      { match: /(method|form|function|class)(\s+)([\w/]+)/i, groups: ['keyword', undefined, 'function'] },
      { match: /(data|types|constants|parameters|field-symbols)(\s*\(?)/i, groups: ['keyword', undefined] },
      { match: /<[\w-]+>/, token: 'variable' }, // <fs>: a field symbol
      { match: /@\w+|@\(?/, token: 'variable' }, // @lv_x: a host variable
      { match: /[A-Za-z_][\w/]*(?:-(?!>)[\w/]+)*(?=\()/, token: (t) => (KEYWORDS.has(t.toLowerCase()) ? 'keyword' : 'function') },
      { match: /(=>|->|~)([A-Za-z_]\w*)/, groups: ['operator', 'property'] },
      { match: /(-)([A-Za-z_]\w*)/, groups: ['punctuation', 'property'], after: (p) => p?.type === 'variable' }, // <fs>-name
      { match: /[A-Za-z_][\w/]*(?:-(?!>)[\w/]+)*/, token: (t) => { const w = t.toLowerCase(); return CONSTANTS.has(w) ? 'constant' : KEYWORDS.has(w) ? 'keyword' : TYPES.has(w) ? 'builtin' : undefined } },
      { match: /\d+/, token: 'number' },
      { match: /\?=|\+=|-=|\*=|\/=|&&|<>|<=|>=|[-+*/=<>&]/, token: 'operator' },
      { match: /[().,:[\]]/, token: 'punctuation' },
    ],
    // |Hello { name }!|
    template: [
      { match: /\|/, token: 'string', pop: true },
      { match: /\\./, token: 'escape' },
      { match: /\{/, token: 'escape', push: 'embedded' },
      { match: /[^|\\{]+/, token: 'string' },
    ],
    embedded: [
      { match: /\}/, token: 'escape', pop: true },
      { include: 'root' },
    ],
  },
}
