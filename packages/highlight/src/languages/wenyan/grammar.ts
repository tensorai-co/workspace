import type { Grammar } from '../../engine/grammar.js'

// 文言 (Wenyan): a programming language in Classical Chinese. 「names」,
// 「「strings」」, numbers in Chinese numerals, and keywords like 吾有,
// 名之曰 and 書之. Comments start with 批曰, 注曰 or 疏曰.
const KEYWORDS = [
  '吾有', '今有', '有', '曰', '名之曰', '書之', '施', '以', '於', '若', '若非', '者', '云云', '也',
  '為是', '遍', '乃得', '乃行是術曰', '乃歸空', '是謂', '之術也', '之物也', '之禮也', '欲行是術', '必先得', '是術曰',
  '凡', '中之', '恆為是', '乃止', '乃止是遍', '夫', '其', '之', '充', '銜', '取', '昔之', '今', '是矣',
  '不知何禍歟', '姑妄行此', '豈', '嗚呼', '之禍', '如事不諧', '乃作罷', '或若', '若其然者', '若其不然者',
  '吾嘗觀', '之書', '方悟', '之義', '其餘', '所餘幾何', '加', '減', '乘', '除', '中有陽乎', '中無陰乎',
  '變', '等於', '不等於', '大於', '小於', '不大於', '不小於', '之長', '是也',
].sort((a, b) => b.length - a.length)
const TYPES = ['數', '言', '爻', '列', '物', '術']
const CONSTANTS = ['陰', '陽']

const KEYWORD = new RegExp(KEYWORDS.join('|'))

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /(批曰|注曰|疏曰)(。?)(「「[^」]*」」|「[^」]*」)?/, groups: ['comment', 'comment', 'comment'] },
      { match: /「「/, token: 'string', push: 'string' },
      { match: /「[^」\n]*」/, token: 'variable' }, // 「甲」: a name
      { match: /『[^』\n]*』/, token: 'string' },
      { match: KEYWORD, token: 'keyword' },
      { match: new RegExp(TYPES.join('|')), token: 'type' },
      { match: new RegExp(CONSTANTS.join('|')), token: 'constant' },
      { match: /[負]?[〇零一二三四五六七八九十百千萬億兆京垓秭穰溝澗正載極分釐毫絲忽微纖沙塵埃渺漠又]+/, token: 'number' },
      { match: /[。、，]/, token: 'punctuation' },
      { match: /./ },
    ],
    string: [
      { match: /」」/, token: 'string', pop: true },
      { match: /[^」]+|」/, token: 'string' },
    ],
  },
}
