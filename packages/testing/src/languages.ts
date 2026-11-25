import type {
  CompletionItem,
  CompletionList,
  CompletionRequest,
  Diagnostic,
  DocumentSymbol,
  FormatRequest,
  Hover,
  LanguageDocument,
  LanguageRequest,
  LanguageService,
  Location,
  TextEdit,
} from '@tensorai-co/workspace/host'

/** Each answer is a value, or a function of the request. */
type Answer<R, T> = T | ((request: R) => T)

export interface ScriptedLanguageOptions {
  triggerCharacters?: readonly string[]
  completions?: Answer<CompletionRequest, CompletionList | CompletionItem[] | undefined>
  resolveCompletion?: (item: CompletionItem) => CompletionItem
  hover?: Answer<LanguageRequest, Hover | undefined>
  diagnostics?: Answer<LanguageDocument, Diagnostic[]>
  definition?: Answer<LanguageRequest, Location[] | undefined>
  symbols?: Answer<LanguageDocument, DocumentSymbol[]>
  format?: Answer<FormatRequest, TextEdit[]>
  /** Milliseconds before each answer. At once by default. */
  delay?: number
}

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    if (ms <= 0) return resolve()
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => (clearTimeout(timer), reject(new DOMException('Aborted', 'AbortError'))), { once: true })
  })

/**
 * Set answers to every language request, for tests and the playground. Only the methods given an answer exist, as a
 * real service has only some. It records every request by method, and which ones were aborted.
 */
export class ScriptedLanguageService implements LanguageService {
  readonly triggerCharacters?: readonly string[]
  readonly requests: { method: string; request: unknown }[] = []
  readonly aborted: { method: string; request: unknown }[] = []
  completions?: LanguageService['completions']
  resolveCompletion?: LanguageService['resolveCompletion']
  hover?: LanguageService['hover']
  diagnostics?: LanguageService['diagnostics']
  definition?: LanguageService['definition']
  symbols?: LanguageService['symbols']
  format?: LanguageService['format']

  constructor(options: ScriptedLanguageOptions) {
    this.triggerCharacters = options.triggerCharacters
    const method = <R, T>(name: string, answer: Answer<R, T> | undefined) =>
      answer === undefined
        ? undefined
        : async (request: R, signal: AbortSignal): Promise<T> => {
            const record = { method: name, request }
            this.requests.push(record)
            try {
              await wait(options.delay ?? 0, signal)
            } catch (e) {
              this.aborted.push(record)
              throw e
            }
            return typeof answer === 'function' ? (answer as (request: R) => T)(request) : answer
          }
    this.completions = method('completions', options.completions)
    this.hover = method('hover', options.hover)
    this.diagnostics = method('diagnostics', options.diagnostics)
    this.definition = method('definition', options.definition)
    this.symbols = method('symbols', options.symbols)
    this.format = method('format', options.format)
    const resolve = options.resolveCompletion
    if (resolve) this.resolveCompletion = method<CompletionItem, CompletionItem>('resolveCompletion', resolve)
  }

  /** The requests one method got. */
  of(method: string): unknown[] {
    return this.requests.filter((r) => r.method === method).map((r) => r.request)
  }
}
