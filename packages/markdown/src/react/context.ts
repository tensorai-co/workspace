import type { Clipboard, FileSystem } from '@tensorai-co/workspace/host'
import { createContext } from 'react'
import type { LinkTarget, Place } from '../core/links.js'

/** What the blocks need from the preview they're in. */
export interface PreviewContext extends Place {
  fs?: FileSystem
  clipboard?: Clipboard
  remoteImages: boolean
  /** Opens a link. Returns false to let the browser open a web link in a new tab. */
  open(target: LinkTarget): boolean
}

export const Preview = createContext<PreviewContext>({ remoteImages: false, open: () => false })
