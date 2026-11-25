import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  процедура procedure конецпроцедуры endprocedure функция function конецфункции endfunction если if
  тогда then иначеесли elsif иначе else конецесли endif для for каждого each из in по to пока while
  цикл do конеццикла enddo прервать break продолжить continue возврат return перем var экспорт
  export новый new попытка try исключение except конецпопытки endtry вызватьисключение raise знач
  val и and или or не not перейти goto выполнить execute асинх async ждать await
`)
const CONSTANTS = words('истина true ложь false неопределено undefined null')
const BUILTINS = words(`
  сообщить message строка string число number дата date текущаядата currentdate стрдлина strlen
  стрнайти strfind формат format значениезаполнено valueisfilled типзнч typeof тип type окр round
  мин min макс max
`)
const VARIABLES = words('ЭтотОбъект ThisObject')

function name(text: string): TokenType | undefined {
  const w = text.toLowerCase()
  if (VARIABLES.has(w)) return 'variable'
  if (KEYWORDS.has(w)) return 'keyword'
  if (CONSTANTS.has(w)) return 'constant'
  return undefined
}

const IDENT = /[A-Za-zА-яЁё_][\wА-яЁё]*/.source

// 1C:Enterprise (BSL): procedures and functions in Russian or English keywords, &directives, #regions and | continued strings.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /#[A-Za-zА-яЁё]+.*/, token: 'meta', after: (p) => p === undefined }, // #Область, #Если Сервер Тогда
      { match: /'\d{8,14}'/, token: 'number' }, // a date: '20260101'
      { match: /\/\/.*/, token: 'comment' },
      { match: /"/, token: 'string', push: 'string0' },
      { match: /&[A-Za-zА-яЁё_][\wА-яЁё]*/, token: 'meta' },
      { match: new RegExp(`(Процедура|Procedure|Функция|Function)(\\s+)(${IDENT})`, 'i'), groups: ['keyword', undefined, 'function'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})(?=\\s*\\()`), groups: ['punctuation', 'function'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})`), groups: ['punctuation', 'property'] },
      { match: new RegExp(`${IDENT}(?=\\s*\\()`), token: (t) => name(t) ?? (BUILTINS.has(t.toLowerCase()) ? 'builtin' : 'function') },
      { match: new RegExp(IDENT), token: (t) => name(t) ?? (BUILTINS.has(t.toLowerCase()) ? 'builtin' : undefined) },
      { match: /0[xX][\da-fA-F_]+\w*|0[bB][01_]+\w*|0[oO][0-7_]+\w*|(?:\d[\d_]*(?:\.(?![.A-Za-z_])[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?\w*/, token: 'number' },
      { match: /<>|<=|>=|[-+*/%<>=?]/, token: 'operator' },
      { match: /[()[\]{},;.]/, token: 'punctuation' },
    ],
    string0: [
      { match: /"/, token: 'string', pop: true },
      { match: /[^"]+/, token: 'string' },
      { match: /./, token: 'string' },
    ],
  },
}
