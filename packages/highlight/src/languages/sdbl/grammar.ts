import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  выбрать select различные distinct первые top из from где where как as и and или or не not в in
  иерархии hierarchy между between подобно like есть is null левое left правое right полное full
  внутреннее inner соединение join по on сгруппировать group упорядочить order имеющие having
  объединить union все all возр asc убыв desc поместить into индексировать index выбор case когда
  when тогда then иначе else конец end итоги totals для for изменения update разрешенные allowed by
`)
const CONSTANTS = words('истина true ложь false неопределено undefined')

function name(text: string): TokenType | undefined {
  const w = text.toLowerCase()
  if (KEYWORDS.has(w)) return 'keyword'
  if (CONSTANTS.has(w)) return 'constant'
  return undefined
}

const IDENT = /[A-Za-zА-яЁё_][\wА-яЁё]*/.source

// 1C:Enterprise queries: SELECT … FROM in Russian or English, &Parameters, virtual tables and AS aliases.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /(?:СУММА|SUM|КОЛИЧЕСТВО|COUNT|МАКСИМУМ|MAX|МИНИМУМ|MIN|СРЕДНЕЕ|AVG|ЕСТЬNULL|ISNULL|ПРЕДСТАВЛЕНИЕ|PRESENTATION|ЗНАЧЕНИЕ|VALUE|ТИП|TYPE|ВЫРАЗИТЬ|CAST|НАЧАЛОПЕРИОДА|BEGINOFPERIOD|КОНЕЦПЕРИОДА|ENDOFPERIOD|ДАТАВРЕМЯ|DATETIME|ПОДСТРОКА|SUBSTRING)(?=\s*\()/i, token: 'builtin' },
      { match: /\/\/.*/, token: 'comment' },
      { match: /"/, token: 'string', push: 'string0' },
      { match: /&[A-Za-zА-яЁё_][\wА-яЁё]*/, token: 'meta' },
      { match: new RegExp(`(\\??\\.)(${IDENT})(?=\\s*\\()`), groups: ['punctuation', 'function'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})`), groups: ['punctuation', 'property'] },
      { match: new RegExp(`${IDENT}(?=\\s*\\()`), token: (t) => name(t) ?? 'function' },
      { match: new RegExp(IDENT), token: name },
      { match: /0[xX][\da-fA-F_]+\w*|0[bB][01_]+\w*|0[oO][0-7_]+\w*|(?:\d[\d_]*(?:\.(?![.A-Za-z_])[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?\w*/, token: 'number' },
      { match: /<>|<=|>=|[-+*/<>=]/, token: 'operator' },
      { match: /[()[\]{},;.]/, token: 'punctuation' },
    ],
    string0: [
      { match: /"/, token: 'string', pop: true },
      { match: /[^"]+/, token: 'string' },
      { match: /./, token: 'string' },
    ],
  },
}
