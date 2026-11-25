import { loadLanguage, type LanguageId } from './index.js'

/** COMMON are the languages answers use most, for apps that want them loaded up front. */
export const COMMON: LanguageId[] = ['python', 'typescript', 'javascript', 'bash', 'json', 'go']

/** loadCommon loads the common languages, e.g. when the page is idle. */
export function loadCommon(): Promise<unknown> {
  return Promise.all(COMMON.map(loadLanguage))
}
