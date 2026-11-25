import type { InlineCompletion, InlineCompletionProvider, InlineCompletionRequest } from '@tensorai-co/workspace/host'

/** What a scripted provider suggests for a request. */
export type ScriptedSuggestion = string | InlineCompletion | readonly InlineCompletion[] | undefined

export interface ScriptedCompletionOptions {
  /** The suggestions for a request: text after the cursor, completions, or nothing. */
  suggest: (request: InlineCompletionRequest) => ScriptedSuggestion
  /** Characters per streamed piece. Everything at once by default. */
  chunk?: number
  /** Milliseconds before the first piece, and between pieces. */
  delay?: number
}

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (ms <= 0 || signal.aborted) return resolve()
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => (clearTimeout(timer), resolve()), { once: true })
  })

/**
 * Streams set suggestions, a few characters at a time if asked, for tests and the playground. It records every
 * request, which ones were aborted, and the events the editor sent.
 */
export class ScriptedCompletionProvider implements InlineCompletionProvider {
  readonly requests: InlineCompletionRequest[] = []
  /** Requests whose signal aborted before they finished. */
  readonly aborted: InlineCompletionRequest[] = []
  readonly shown: InlineCompletion[] = []
  readonly accepted: { completion: InlineCompletion; part: 'all' | 'word' | 'line' | 'edit' }[] = []
  readonly dismissed: InlineCompletion[] = []

  constructor(private readonly options: ScriptedCompletionOptions) {}

  async *provide(request: InlineCompletionRequest, signal: AbortSignal): AsyncIterable<InlineCompletion> {
    this.requests.push(request)
    const value = this.options.suggest(request)
    const all: InlineCompletion[] = value === undefined ? [] : typeof value === 'string' ? [{ text: value }] : Array.isArray(value) ? [...value] : [value as InlineCompletion]
    const { chunk = Infinity, delay = 0 } = this.options
    try {
      for (const [index, completion] of all.entries()) {
        const full = completion.text
        for (let at = Math.min(chunk, full.length); ; at = Math.min(at + chunk, full.length)) {
          // The edit elsewhere comes with the last piece, when the text is whole.
          await wait(delay, signal)
          if (signal.aborted) return
          const whole = at >= full.length
          yield { ...completion, index: completion.index ?? index, text: full.slice(0, at), nextEdit: whole ? completion.nextEdit : undefined }
          if (at >= full.length) break
        }
      }
    } finally {
      if (signal.aborted) this.aborted.push(request)
    }
  }

  onShown(completion: InlineCompletion): void {
    this.shown.push(completion)
  }
  onAccepted(completion: InlineCompletion, part: 'all' | 'word' | 'line' | 'edit'): void {
    this.accepted.push({ completion, part })
  }
  onDismissed(completion: InlineCompletion): void {
    this.dismissed.push(completion)
  }
}
