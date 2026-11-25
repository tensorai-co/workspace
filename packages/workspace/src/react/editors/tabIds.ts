/** A tab shows a file, or the preview of one: its id is the file's path, with a mark for previews. */
const PREVIEW = 'preview:'

export const previewId = (path: string) => PREVIEW + path
export const isPreview = (id: string) => id.startsWith(PREVIEW)
export const pathOf = (id: string) => (isPreview(id) ? id.slice(PREVIEW.length) : id)
