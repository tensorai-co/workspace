/** A heading's text as the anchor GitHub gives it: "What's new?" → "whats-new". */
export function slug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{Alphabetic}\p{M}\p{Nd}\p{Nl}\p{Pc}\- ]/gu, '')
    .replace(/ /g, '-')
}

/** Slugs for one document: a repeated heading's get -1, -2 and so on. */
export class Slugs {
  private readonly counts = new Map<string, number>()

  add(text: string): string {
    const value = slug(text)
    const count = this.counts.get(value)
    this.counts.set(value, count === undefined ? 0 : count + 1)
    return count === undefined ? value : `${value}-${count + 1}`
  }
}
